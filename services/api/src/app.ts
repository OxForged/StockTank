import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { PrismaClient } from '@stocktank/database';
import type { ApiEnv } from './env.js';
import { createHttpLogger, createLogger } from './lib/logger.js';
import { attachSession } from './middleware/auth.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { DEFAULT_RATE_LIMITS, globalRateLimiter, type RateLimitConfig } from './middleware/rate-limit.js';
import { buildOpenApiDocument } from './openapi/document.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { systemRouter } from './routes/system.js';

export interface AppDeps {
  env: ApiEnv;
  prisma: PrismaClient;
  /** Optional; when absent `/ready` skips the Redis check. */
  redis?: Redis | null;
  logger?: Logger;
  rateLimits?: Partial<RateLimitConfig>;
}

/** Builds the Express app with every dependency injected, so tests can run it against a test database. */
export function createApp(deps: AppDeps): Express {
  const { env, prisma } = deps;
  const redis = deps.redis ?? null;
  const logger = deps.logger ?? createLogger({ level: env.LOG_LEVEL ?? 'info' });
  const rateLimits: RateLimitConfig = { ...DEFAULT_RATE_LIMITS, ...deps.rateLimits };
  const openApiDocument = buildOpenApiDocument({ version: env.APP_VERSION });

  const app = express();
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.set('etag', false);

  app.use(createHttpLogger(logger));
  app.use(
    helmet({
      // The API only serves JSON; a restrictive CSP blocks any accidental HTML rendering of responses.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept', 'X-Requested-With', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy'],
      maxAge: 600,
    }),
  );
  app.use(globalRateLimiter(rateLimits.global));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser(env.SESSION_SECRET));

  app.use(systemRouter({ env, prisma, redis }));
  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });

  app.use('/api', csrfProtection(env.CORS_ORIGINS));
  app.use('/api', attachSession(prisma, env));
  app.use('/api/v1/auth', authRouter({ env, prisma, rateLimits }));
  app.use('/api/v1/admin', adminRouter({ prisma }));

  app.use(notFoundHandler);
  app.use(errorHandler(logger, env.NODE_ENV === 'production'));
  return app;
}
