import { Redis } from 'ioredis';
import type { Logger } from 'pino';

/**
 * Redis client tuned for a web API: never blocks requests while Redis is down
 * (no offline queue, single retry) and reports its state through the logger.
 */
export function createRedis(url: string, logger: Logger): Redis {
  const redis = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
  });
  redis.on('error', (err: Error) => logger.warn({ err: { message: err.message } }, 'Redis connection error'));
  redis.on('ready', () => logger.info('Redis connected'));
  return redis;
}
