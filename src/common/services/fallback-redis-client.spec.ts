import { FallbackRedisClient } from './fallback-redis-client';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

describe('FallbackRedisClient', () => {
  let fallbackClient: FallbackRedisClient;
  let mockRedis: any;
  let mockPrisma: any;
  let mockLogger: any;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      lpush: jest.fn(),
      rpush: jest.fn(),
      rpop: jest.fn(),
      llen: jest.fn(),
      lrange: jest.fn(),
    };

    mockPrisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    mockLogger = {
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    };

    fallbackClient = new FallbackRedisClient(
      mockRedis,
      mockPrisma as unknown as PrismaService,
      mockLogger as unknown as Logger,
    );
  });

  describe('executeWithFallback', () => {
    it('should call Redis when configured and healthy', async () => {
      mockRedis.get.mockResolvedValue('redis-value');

      const result = await fallbackClient.get('test-key');

      expect(result).toBe('redis-value');
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('should fallback to Prisma when Redis throws an error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection limit reached'));
      mockPrisma.$queryRaw.mockResolvedValue([{ value: 'db-value' }]);

      const result = await fallbackClient.get('test-key');

      expect(result).toBe('db-value');
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should fallback to Prisma directly if Redis is not configured', async () => {
      const clientNoRedis = new FallbackRedisClient(
        null,
        mockPrisma as unknown as PrismaService,
        mockLogger as unknown as Logger,
      );
      mockPrisma.$queryRaw.mockResolvedValue([{ value: 'db-value' }]);

      const result = await clientNoRedis.get('test-key');

      expect(result).toBe('db-value');
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('Key-Value operations', () => {
    it('should set value successfully on fallback', async () => {
      mockRedis.set.mockRejectedValue(new Error('Fail'));
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await fallbackClient.set('test-key', { role: 'admin' }, { ex: 3600 });

      expect(result).toBe('OK');
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('should handle nx lock sets on fallback when lock is free', async () => {
      mockRedis.set.mockRejectedValue(new Error('Fail'));
      mockPrisma.$queryRaw.mockResolvedValue([]); // lock key doesn't exist/expired
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await fallbackClient.set('lock:key', '1', { nx: true, ex: 10 });

      expect(result).toBe('OK');
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('should return null for nx lock sets on fallback when lock is active', async () => {
      mockRedis.set.mockRejectedValue(new Error('Fail'));
      mockPrisma.$queryRaw.mockResolvedValue([{ expires_at: new Date(Date.now() + 5000) }]);

      const result = await fallbackClient.set('lock:key', '1', { nx: true, ex: 10 });

      expect(result).toBeNull();
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('should delete keys successfully on fallback', async () => {
      mockRedis.del.mockRejectedValue(new Error('Fail'));
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await fallbackClient.del('test-key');

      expect(result).toBe(1);
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('should check existence on fallback', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Fail'));
      mockPrisma.$queryRaw.mockResolvedValue([{ count: 1n }]);

      const result = await fallbackClient.exists('test-key');

      expect(result).toBe(1);
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('List operations', () => {
    it('should handle lpush on fallback', async () => {
      mockRedis.lpush.mockRejectedValue(new Error('Fail'));
      mockPrisma.$queryRaw.mockResolvedValue([{ value: ['job1'], expires_at: new Date() }]);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await fallbackClient.lpush('queue', 'job2');

      expect(result).toBe(2);
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('should handle rpop on fallback', async () => {
      mockRedis.rpop.mockRejectedValue(new Error('Fail'));
      mockPrisma.$queryRaw.mockResolvedValue([{ value: ['job1', 'job2'], expires_at: new Date() }]);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await fallbackClient.rpop('queue');

      expect(result).toBe('job2');
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('should handle llen and lrange on fallback', async () => {
      mockRedis.lrange.mockRejectedValue(new Error('Fail'));
      mockPrisma.$queryRaw.mockResolvedValue([{ value: ['a', 'b', 'c'] }]);

      const range = await fallbackClient.lrange('list', 0, -1);

      expect(range).toEqual(['a', 'b', 'c']);
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });
  });
});
