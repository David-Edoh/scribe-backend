import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Redis } from '@upstash/redis';
import { PrismaService } from '../../prisma.service';
import { FallbackRedisClient } from './fallback-redis-client';

@Injectable()
export class UpstashService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UpstashService.name);
  private readonly redis: Redis | null;
  private readonly client: FallbackRedisClient;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {
    const url = process.env.REDIS_REST_URL;
    const token = process.env.REDIS_REST_TOKEN;

    if (!url || !token) {
      this.logger.warn(
        'REDIS_REST_URL or REDIS_REST_TOKEN is missing. Redis is not configured, running on database fallback.',
      );
      this.redis = null;
    } else {
      this.redis = new Redis({ url, token });
    }

    this.client = new FallbackRedisClient(this.redis, this.prisma, this.logger);
  }

  onModuleInit() {
    // Avoid running cleanup tasks during tests to prevent interference and keep tests fast
    if (process.env.NODE_ENV === 'test' || process.env.SKIP_DB_CONNECT === 'true') {
      return;
    }
    
    // Periodically clean up expired cache keys every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      try {
        const deleted = await this.prisma.$executeRaw`
          DELETE FROM app_cache WHERE expires_at < NOW()
        `;
        if (deleted > 0) {
          this.logger.log(`Cleaned up ${deleted} expired cache keys from app_cache`);
        }
      } catch (err: any) {
        this.logger.error(`Failed to clean up expired cache keys: ${err.message}`);
      }
    }, 5 * 60 * 1000).unref();
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  isConfigured(): boolean {
    // Fallback is always configured since PostgreSQL is always active.
    return true;
  }

  getClient(): FallbackRedisClient {
    return this.client;
  }
}
