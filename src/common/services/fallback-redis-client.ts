import { Logger } from '@nestjs/common';
import { Redis } from '@upstash/redis';
import { PrismaService } from '../../prisma.service';

export class FallbackRedisClient {
  constructor(
    private readonly redis: Redis | null,
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  private async executeWithFallback<T>(
    operationName: string,
    redisOp: () => Promise<T>,
    fallbackOp: () => Promise<T>,
  ): Promise<T> {
    if (!this.redis) {
      return fallbackOp();
    }
    try {
      return await redisOp();
    } catch (err: any) {
      this.logger.error(
        `Upstash Redis operation "${operationName}" failed. Falling back to PostgreSQL. Error: ${err.message}`,
        err.stack,
      );
      return fallbackOp();
    }
  }

  // --- Key Value / String operations ---

  async get<T>(key: string): Promise<T | null> {
    return this.executeWithFallback(
      'get',
      () => this.redis!.get<T>(key),
      async () => {
        const rows = await this.prisma.$queryRaw<any[]>`
          SELECT value FROM app_cache 
          WHERE key = ${key} AND expires_at > NOW()
        `;
        if (rows.length === 0) return null;
        return rows[0].value as T;
      },
    );
  }

  async set(
    key: string,
    value: any,
    options?: { nx?: boolean; ex?: number; px?: number },
  ): Promise<'OK' | any | null> {
    return this.executeWithFallback(
      'set',
      () => this.redis!.set(key, value, options as any),
      async () => {
        let expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year default
        if (options?.ex) {
          expiresAt = new Date(Date.now() + options.ex * 1000);
        } else if (options?.px) {
          expiresAt = new Date(Date.now() + options.px);
        }

        if (options?.nx) {
          return await this.prisma.$transaction(async (tx) => {
            const existing = await tx.$queryRaw<any[]>`
              SELECT expires_at FROM app_cache WHERE key = ${key} AND expires_at > NOW() FOR UPDATE
            `;
            if (existing.length > 0) {
              return null;
            }
            await tx.$executeRaw`
              INSERT INTO app_cache (key, value, expires_at)
              VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${expiresAt})
              ON CONFLICT (key) DO UPDATE SET
                value = EXCLUDED.value,
                expires_at = EXCLUDED.expires_at
            `;
            return 'OK';
          });
        } else {
          await this.prisma.$executeRaw`
            INSERT INTO app_cache (key, value, expires_at)
            VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${expiresAt})
            ON CONFLICT (key) DO UPDATE SET
              value = EXCLUDED.value,
              expires_at = EXCLUDED.expires_at
          `;
          return 'OK';
        }
      },
    );
  }

  async del(key: string | string[]): Promise<number> {
    return this.executeWithFallback(
      'del',
      () => (Array.isArray(key) ? this.redis!.del(...key) : this.redis!.del(key)),
      async () => {
        const keys = Array.isArray(key) ? key : [key];
        const count = await this.prisma.$executeRaw`
          DELETE FROM app_cache WHERE key = ANY(${keys})
        `;
        return count;
      },
    );
  }

  async exists(...keys: string[]): Promise<number> {
    return this.executeWithFallback(
      'exists',
      () => this.redis!.exists(...keys),
      async () => {
        const result = await this.prisma.$queryRaw<any[]>`
          SELECT COUNT(*)::bigint as count FROM app_cache 
          WHERE key = ANY(${keys}) AND expires_at > NOW()
        `;
        return Number(result[0].count);
      },
    );
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.executeWithFallback(
      'expire',
      () => this.redis!.expire(key, seconds),
      async () => {
        const expiresAt = new Date(Date.now() + seconds * 1000);
        const count = await this.prisma.$executeRaw`
          UPDATE app_cache SET expires_at = ${expiresAt} 
          WHERE key = ${key} AND expires_at > NOW()
        `;
        return count;
      },
    );
  }

  // --- Set operations ---

  async sadd<TData = string>(key: string, ...members: TData[]): Promise<number> {
    return this.executeWithFallback(
      'sadd',
      () => (this.redis!.sadd as any)(key, ...members),
      async () => {
        return await this.prisma.$transaction(async (tx) => {
          const existing = await tx.$queryRaw<any[]>`
            SELECT value, expires_at FROM app_cache WHERE key = ${key} AND expires_at > NOW() FOR UPDATE
          `;
          let currentSet: any[] = [];
          if (existing.length > 0 && Array.isArray(existing[0].value)) {
            currentSet = existing[0].value;
          }
          const beforeLen = currentSet.length;
          for (const member of members) {
            if (!currentSet.includes(member)) {
              currentSet.push(member);
            }
          }
          const addedCount = currentSet.length - beforeLen;
          
          let expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
          if (existing.length > 0) {
            expiresAt = new Date(existing[0].expires_at);
          }
          await tx.$executeRaw`
            INSERT INTO app_cache (key, value, expires_at)
            VALUES (${key}, ${JSON.stringify(currentSet)}::jsonb, ${expiresAt})
            ON CONFLICT (key) DO UPDATE SET
              value = EXCLUDED.value
          `;
          return addedCount;
        });
      },
    );
  }

  async srem<TData = string>(key: string, ...members: TData[]): Promise<number> {
    return this.executeWithFallback(
      'srem',
      () => (this.redis!.srem as any)(key, ...members),
      async () => {
        return await this.prisma.$transaction(async (tx) => {
          const existing = await tx.$queryRaw<any[]>`
            SELECT value, expires_at FROM app_cache WHERE key = ${key} AND expires_at > NOW() FOR UPDATE
          `;
          if (existing.length === 0) return 0;
          let currentSet: any[] = [];
          if (Array.isArray(existing[0].value)) {
            currentSet = existing[0].value;
          }
          const beforeLen = currentSet.length;
          currentSet = currentSet.filter(m => !members.includes(m));
          const removedCount = beforeLen - currentSet.length;
          if (removedCount > 0) {
            await tx.$executeRaw`
              UPDATE app_cache SET value = ${JSON.stringify(currentSet)}::jsonb 
              WHERE key = ${key}
            `;
          }
          return removedCount;
        });
      },
    );
  }

  async smembers<TData extends any[] = string[]>(key: string): Promise<TData> {
    return this.executeWithFallback(
      'smembers',
      () => this.redis!.smembers<TData>(key),
      async () => {
        const existing = await this.prisma.$queryRaw<any[]>`
          SELECT value FROM app_cache WHERE key = ${key} AND expires_at > NOW()
        `;
        if (existing.length === 0) return [] as unknown as TData;
        return existing[0].value as TData;
      },
    );
  }

  // --- List operations ---

  async lpush<TData>(key: string, ...elements: TData[]): Promise<number> {
    return this.executeWithFallback(
      'lpush',
      () => this.redis!.lpush(key, ...elements),
      async () => {
        return await this.prisma.$transaction(async (tx) => {
          const existing = await tx.$queryRaw<any[]>`
            SELECT value, expires_at FROM app_cache WHERE key = ${key} AND expires_at > NOW() FOR UPDATE
          `;
          let list: any[] = [];
          if (existing.length > 0 && Array.isArray(existing[0].value)) {
            list = existing[0].value;
          }
          list.unshift(...[...elements].reverse());
          
          let expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
          if (existing.length > 0) {
            expiresAt = new Date(existing[0].expires_at);
          }
          await tx.$executeRaw`
            INSERT INTO app_cache (key, value, expires_at)
            VALUES (${key}, ${JSON.stringify(list)}::jsonb, ${expiresAt})
            ON CONFLICT (key) DO UPDATE SET
              value = EXCLUDED.value
          `;
          return list.length;
        });
      },
    );
  }

  async rpush<TData>(key: string, ...elements: TData[]): Promise<number> {
    return this.executeWithFallback(
      'rpush',
      () => this.redis!.rpush(key, ...elements),
      async () => {
        return await this.prisma.$transaction(async (tx) => {
          const existing = await tx.$queryRaw<any[]>`
            SELECT value, expires_at FROM app_cache WHERE key = ${key} AND expires_at > NOW() FOR UPDATE
          `;
          let list: any[] = [];
          if (existing.length > 0 && Array.isArray(existing[0].value)) {
            list = existing[0].value;
          }
          list.push(...elements);
          
          let expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
          if (existing.length > 0) {
            expiresAt = new Date(existing[0].expires_at);
          }
          await tx.$executeRaw`
            INSERT INTO app_cache (key, value, expires_at)
            VALUES (${key}, ${JSON.stringify(list)}::jsonb, ${expiresAt})
            ON CONFLICT (key) DO UPDATE SET
              value = EXCLUDED.value
          `;
          return list.length;
        });
      },
    );
  }

  async rpop<TData = string>(key: string): Promise<TData | null> {
    return this.executeWithFallback(
      'rpop',
      () => this.redis!.rpop<TData>(key),
      async () => {
        return await this.prisma.$transaction(async (tx) => {
          const existing = await tx.$queryRaw<any[]>`
            SELECT value, expires_at FROM app_cache WHERE key = ${key} AND expires_at > NOW() FOR UPDATE
          `;
          if (existing.length === 0) return null;
          let list: any[] = [];
          if (Array.isArray(existing[0].value)) {
            list = existing[0].value;
          }
          if (list.length === 0) return null;
          const popped = list.pop();
          await tx.$executeRaw`
            UPDATE app_cache SET value = ${JSON.stringify(list)}::jsonb 
            WHERE key = ${key}
          `;
          return popped as TData;
        });
      },
    );
  }

  async llen(key: string): Promise<number> {
    return this.executeWithFallback(
      'llen',
      () => this.redis!.llen(key),
      async () => {
        const existing = await this.prisma.$queryRaw<any[]>`
          SELECT value FROM app_cache WHERE key = ${key} AND expires_at > NOW()
        `;
        if (existing.length === 0 || !Array.isArray(existing[0].value)) return 0;
        return existing[0].value.length;
      },
    );
  }

  async lrange<TData = string>(key: string, start: number, stop: number): Promise<TData[]> {
    return this.executeWithFallback(
      'lrange',
      () => this.redis!.lrange<TData>(key, start, stop),
      async () => {
        const existing = await this.prisma.$queryRaw<any[]>`
          SELECT value FROM app_cache WHERE key = ${key} AND expires_at > NOW()
        `;
        if (existing.length === 0 || !Array.isArray(existing[0].value)) return [];
        const list = existing[0].value;
        
        let startIdx = start < 0 ? list.length + start : start;
        let stopIdx = stop < 0 ? list.length + stop : stop;
        
        startIdx = Math.max(0, startIdx);
        stopIdx = Math.min(list.length - 1, stopIdx);
        
        if (startIdx > stopIdx) return [];
        return list.slice(startIdx, stopIdx + 1) as TData[];
      },
    );
  }
}
