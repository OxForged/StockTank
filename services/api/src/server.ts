import { createPrismaClient } from '@stocktank/database';
import { createApp } from './app.js';
import { loadEnv } from './env.js';
import { createLogger } from './lib/logger.js';
import { createRedis } from './lib/redis.js';

const env = loadEnv();
const logger = createLogger({
  level: env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug'),
  pretty: env.NODE_ENV === 'development',
});

const prisma = createPrismaClient(env.DATABASE_URL);
const redis = env.REDIS_URL ? createRedis(env.REDIS_URL, logger) : null;
redis?.connect().catch((err: unknown) => {
  logger.warn({ err }, 'Redis not reachable at startup; /ready will report it until it recovers');
});

const app = createApp({ env, prisma, redis, logger });
const server = app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT, env: env.NODE_ENV, version: env.APP_VERSION }, 'StockTank API listening');
});
// Keep the server's idle timeout above typical reverse-proxy timeouts to avoid 502s on keep-alive races.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

const SHUTDOWN_GRACE_MS = 10_000;
let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out; exiting');
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  forceExit.unref();

  server.close((closeErr) => {
    void (async () => {
      if (closeErr) logger.error({ err: closeErr }, 'HTTP server close failed');
      try {
        await prisma.$disconnect();
        if (redis) await redis.quit().catch(() => redis.disconnect());
        logger.info('Shutdown complete');
        process.exit(closeErr ? 1 : 0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    })();
  });
  server.closeIdleConnections();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err: Error) => {
  logger.fatal({ err }, 'Uncaught exception; shutting down');
  shutdown('SIGTERM');
});
