import { Worker, UnrecoverableError } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import { z } from 'zod';
import { createPrismaClient } from '@stocktank/database';
import { isStorageConfigured, loadMediaEnv, MEDIA_QUEUE, mediaJobSchema, S3Storage } from '@stocktank/media';
import { CastopodAdapter, castopodConfigFromEnv, castopodEnvSchema } from '@stocktank/podcast';
import { resolveTools, runTool } from './ffmpeg-runner.js';
import { createProcessor, PermanentMediaError } from './processor.js';

const env = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    MEDIA_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(1),
    MEDIA_WORK_DIR: z.string().optional(),
    LOG_LEVEL: z.string().optional(),
  })
  .parse(process.env);
const mediaEnv = loadMediaEnv();

const logger = pino({
  level: env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { service: 'media-worker' },
  ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
});

if (!isStorageConfigured(mediaEnv)) {
  logger.fatal('Object storage is not configured (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, MEDIA_PUBLIC_BASE_URL)');
  process.exit(1);
}

const tools = resolveTools();
try {
  const version = await runTool(tools.ffmpeg, ['-hide_banner', '-version'], { timeoutMs: 15_000 });
  logger.info({ ffmpeg: version.split('\n')[0] }, 'FFmpeg available');
} catch (err) {
  logger.fatal({ err, path: tools.ffmpeg }, 'FFmpeg is not runnable; set FFMPEG_PATH/FFPROBE_PATH');
  process.exit(1);
}

const prisma = createPrismaClient(env.DATABASE_URL);
const storage = new S3Storage(mediaEnv);
if (env.NODE_ENV !== 'production') {
  await storage.ensureBucket().catch((err: unknown) => logger.warn({ err }, 'Could not ensure the development bucket'));
}
const castopod = castopodConfigFromEnv(castopodEnvSchema.parse(process.env));
if (!castopod) logger.info('Castopod not configured; podcast-sync jobs will fail with a clear message');
const processJob = createProcessor({
  prisma,
  storage,
  tools,
  logger,
  workRoot: env.MEDIA_WORK_DIR,
  podcastHost: castopod ? new CastopodAdapter(castopod) : null,
});

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const worker = new Worker(
  MEDIA_QUEUE,
  async (job) => {
    const payload = mediaJobSchema.parse(job.data);
    try {
      await processJob(payload);
    } catch (err) {
      // Bad input will fail the same way again; do not spend retries on it.
      if (err instanceof PermanentMediaError) throw new UnrecoverableError(err.message);
      throw err;
    }
  },
  // FFmpeg jobs are long; the lock must outlive a slow rendition step between progress renewals.
  { connection, concurrency: env.MEDIA_WORKER_CONCURRENCY, lockDuration: 5 * 60_000 },
);

worker.on('ready', () => logger.info({ queue: MEDIA_QUEUE, concurrency: env.MEDIA_WORKER_CONCURRENCY }, 'Media worker ready'));
worker.on('failed', (job, err) => logger.warn({ jobId: job?.id, err: err.message }, 'Media job failed'));
worker.on('error', (err) => logger.error({ err }, 'Media worker error'));

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down media worker (waiting for active jobs)');
  const force = setTimeout(() => process.exit(1), 60_000);
  force.unref();
  await worker.close();
  await connection.quit().catch(() => connection.disconnect());
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
