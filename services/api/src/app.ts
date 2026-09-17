import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { PrismaClient } from '@stocktank/database';
import { CastopodAdapter, castopodConfigFromEnv, type PodcastHostAdapter } from '@stocktank/podcast';
import { AzuraCastAdapter, azuracastConfigFromEnv, type RadioProvider } from '@stocktank/radio';
import { createMarketDataProvider, type MarketDataProvider } from '@stocktank/market-data';
import { marketsRouter } from './routes/markets.js';
import type { ApiEnv } from './env.js';
import { createEmailProvider, type EmailProvider } from './lib/email.js';
import { createMediaService, type MediaService } from './lib/media.js';
import { createSearchService, type SearchService } from './lib/search.js';
import { createHttpLogger, createLogger } from './lib/logger.js';
import { attachSession } from './middleware/auth.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { DEFAULT_RATE_LIMITS, globalRateLimiter, type RateLimitConfig } from './middleware/rate-limit.js';
import { buildOpenApiDocument } from './openapi/document.js';
import { adminAdvertisingRouter } from './routes/admin-advertising.js';
import { adminAiRouter } from './routes/admin-ai.js';
import { adminAiFactoryRouter } from './routes/admin-ai-factory.js';
import { adminContentRouter } from './routes/admin-content.js';
import { adminMarketingRouter } from './routes/admin-marketing.js';
import { adminMediaRouter } from './routes/admin-media.js';
import { adminPodcastRouter } from './routes/admin-podcasts.js';
import { podcastFeedRouter } from './routes/podcasts.js';
import { adminRadioRouter, radioRouter } from './routes/radio.js';
import { NowPlayingService } from './lib/radio.js';
import { adminRouter } from './routes/admin.js';
import { adminSystemRouter } from './routes/admin-system.js';
import { adminAnalyticsRouter } from './routes/admin-analytics.js';
import { analyticsRouter } from './routes/analytics.js';
import { advertisingRouter } from './routes/advertising.js';
import { authRouter } from './routes/auth.js';
import { contentRouter } from './routes/content.js';
import { meRouter } from './routes/me.js';
import { newsletterRouter } from './routes/newsletter.js';
import { seoRouter } from './routes/seo.js';
import { systemRouter } from './routes/system.js';

export interface AppDeps {
  env: ApiEnv;
  prisma: PrismaClient;
  /** Optional; when absent `/ready` skips the Redis check. */
  redis?: Redis | null;
  logger?: Logger;
  rateLimits?: Partial<RateLimitConfig>;
  /** Defaults to Meilisearch when MEILISEARCH_URL is set, otherwise Postgres. */
  search?: SearchService;
  /** Defaults to the provider configured by EMAIL_PROVIDER. */
  email?: EmailProvider;
  /** Object storage, processing queue and public media URLs; defaults to the configured S3/Redis settings. */
  media?: MediaService;
  /** Castopod adapter; defaults to the CASTOPOD_* settings, or null when they are incomplete. */
  podcastHost?: PodcastHostAdapter | null;
  /** AzuraCast adapter; defaults to AZURACAST_URL, or null when unset. */
  radio?: RadioProvider | null;
  /** Defaults to MARKET_DATA_PROVIDER (demo data unless a real provider is configured). */
  marketData?: MarketDataProvider;
  /** Public form limits (advertising inquiries, newsletter sign-ups); overridable for tests. */
  formLimits?: {
    inquiry?: { windowMs: number; limit: number };
    subscribe?: { windowMs: number; limit: number };
    analytics?: { windowMs: number; limit: number };
  };
}

/** Builds the Express app with every dependency injected, so tests can run it against a test database. */
export function createApp(deps: AppDeps): Express {
  const { env, prisma } = deps;
  const redis = deps.redis ?? null;
  const logger = deps.logger ?? createLogger({ level: env.LOG_LEVEL ?? 'info' });
  const rateLimits: RateLimitConfig = { ...DEFAULT_RATE_LIMITS, ...deps.rateLimits };
  const openApiDocument = buildOpenApiDocument({ version: env.APP_VERSION });
  const email = deps.email ?? createEmailProvider(env, logger);
  const media = deps.media ?? createMediaService(env, logger);
  const castopodConfig = castopodConfigFromEnv(env);
  const podcastHost = deps.podcastHost !== undefined ? deps.podcastHost : castopodConfig ? new CastopodAdapter(castopodConfig) : null;
  const azuracastConfig = azuracastConfigFromEnv(env);
  const radio = deps.radio !== undefined ? deps.radio : azuracastConfig ? new AzuraCastAdapter(azuracastConfig) : null;
  const nowPlaying = new NowPlayingService(radio, redis, logger);
  // Demo data treats companies flagged as meme stocks as volatile; the set is refreshed from the database lazily.
  const marketData = deps.marketData ?? createMarketDataProvider(env, new Set(['SQZM', 'DHND', 'RKTR', 'TNDY', 'APEG', 'MNWK', 'HODL', 'YOLO']));
  const search =
    deps.search ??
    createSearchService(prisma, logger, redis, { url: env.MEILISEARCH_URL, key: env.MEILISEARCH_KEY, prefix: env.MEILISEARCH_INDEX_PREFIX });

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
      allowedHeaders: ['Content-Type', 'Accept', 'X-Requested-With', 'X-Request-Id', 'Authorization'],
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
  app.use('/api/v1/seo', seoRouter({ env, prisma }));
  app.use('/api/v1', contentRouter({ env, prisma, search, media }));
  app.use('/api/v1', advertisingRouter({ env, prisma, redis, logger, email, inquiryLimit: deps.formLimits?.inquiry }));
  app.use('/api/v1/newsletter', newsletterRouter({ env, prisma, logger, email, subscribeLimit: deps.formLimits?.subscribe }));
  app.use('/api/v1/me', meRouter({ prisma }));
  app.use('/api/v1/admin/content', adminContentRouter({ prisma, search }));
  app.use('/api/v1/admin/media', adminMediaRouter({ prisma, media }));
  app.use('/api/v1/admin/podcasts', adminPodcastRouter({ env, prisma, media, podcastHost }));
  app.use('/api/v1/admin/radio', adminRadioRouter({ prisma, nowPlaying, provider: radio, apiKeyConfigured: Boolean(env.AZURACAST_API_KEY) }));
  app.use('/api/v1', radioRouter({ prisma, nowPlaying }));
  app.use('/api/v1', marketsRouter({ prisma, redis, logger, provider: marketData, media }));
  app.use('/api/v1', analyticsRouter({ env, prisma, media, ingestLimit: deps.formLimits?.analytics }));
  // Podcast enclosure downloads live on the site origin like the feeds.
  app.use(analyticsRouter({ env, prisma, media, ingestLimit: deps.formLimits?.analytics }));
  // Public feeds live on the site origin (/podcasts/<slug>/feed.xml) and under the versioned API.
  app.use(podcastFeedRouter({ env, prisma, media }));
  app.use('/api/v1', podcastFeedRouter({ env, prisma, media }));
  app.use('/api/v1/admin/advertising', adminAdvertisingRouter({ prisma }));
  app.use('/api/v1/admin', adminRouter({ prisma }));
  app.use('/api/v1/admin', adminSystemRouter({ prisma }));
  app.use('/api/v1/admin/analytics', adminAnalyticsRouter({ prisma }));
  app.use('/api/v1/admin/ai', adminAiRouter({ env, prisma }));
  app.use('/api/v1/admin/ai', adminAiFactoryRouter({ prisma, media }));
  app.use('/api/v1/admin', adminMarketingRouter({ prisma }));

  app.use(notFoundHandler);
  app.use(errorHandler(logger, env.NODE_ENV === 'production'));
  return app;
}
