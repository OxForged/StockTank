import { Queue } from 'bullmq';
import type { Logger } from 'pino';
import {
  assetRenditionsSchema,
  clipRenditionsSchema,
  isStorageConfigured,
  jobIdFor,
  MEDIA_QUEUE,
  S3Storage,
  type MediaEnv,
  type MediaJob,
  type ObjectStorage,
} from '@stocktank/media';
import type { ClipMedia, EpisodeMedia, MediaKind } from '@stocktank/types';

/** Enqueues media jobs for the worker. Tests inject an in-memory implementation. */
export interface MediaQueue {
  enqueue(job: MediaJob, attempt: number): Promise<void>;
  close(): Promise<void>;
}

export interface MediaService {
  /** Null when object storage is not configured; upload endpoints then answer 503 instead of pretending. */
  storage: ObjectStorage | null;
  /** Null when Redis is not configured. */
  queue: MediaQueue | null;
  maxUploadBytes: number;
  /** Builds a public rendition URL, or null when no public media base URL is configured. */
  publicUrl(key: string | null | undefined): string | null;
}

class BullMediaQueue implements MediaQueue {
  private queue: Queue | null = null;

  constructor(
    private readonly redisUrl: string,
    private readonly logger: Logger,
  ) {}

  /** Connects on first use so API processes that never enqueue hold no extra Redis connection. */
  private get instance(): Queue {
    if (!this.queue) {
      const url = new URL(this.redisUrl);
      this.queue = new Queue(MEDIA_QUEUE, {
        connection: {
          host: url.hostname,
          port: Number(url.port || 6379),
          username: url.username || undefined,
          password: url.password ? decodeURIComponent(url.password) : undefined,
          db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
          tls: url.protocol === 'rediss:' ? {} : undefined,
        },
      });
      this.queue.on('error', (err) => this.logger.error({ err }, 'Media queue error'));
    }
    return this.queue;
  }

  async enqueue(job: MediaJob, attempt: number): Promise<void> {
    await this.instance.add(job.type, job, {
      jobId: jobIdFor(job, attempt),
      // Retries are explicit (staff press retry) so failures are visible rather than silently looping on a bad file.
      attempts: 1,
      removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    });
  }

  async close(): Promise<void> {
    await this.queue?.close();
  }
}

export function createMediaService(env: MediaEnv & { REDIS_URL?: string }, logger: Logger): MediaService {
  const base = env.MEDIA_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? null;
  return {
    storage: isStorageConfigured(env) ? new S3Storage(env) : null,
    queue: env.REDIS_URL ? new BullMediaQueue(env.REDIS_URL, logger) : null,
    maxUploadBytes: env.MEDIA_MAX_UPLOAD_MB * 1024 * 1024,
    publicUrl: (key) => (key && base ? `${base}/${key}` : null),
  };
}

type PublicUrl = MediaService['publicUrl'];

/** Public playback for a ready asset; anything else yields null so pages never show a dead player. */
export function toEpisodeMedia(
  asset: { kind: MediaKind; status: string; renditions: unknown; durationSeconds: number | null } | null | undefined,
  publicUrl: PublicUrl,
): EpisodeMedia | null {
  if (!asset || asset.status !== 'ready') return null;
  const parsed = assetRenditionsSchema.safeParse(asset.renditions);
  if (!parsed.success) return null;
  const media: EpisodeMedia = {
    kind: asset.kind,
    hlsUrl: publicUrl(parsed.data.hls),
    audioUrl: publicUrl(parsed.data.audio),
    posterUrl: publicUrl(parsed.data.poster),
    durationSeconds: asset.durationSeconds,
  };
  return media.hlsUrl || media.audioUrl ? media : null;
}

export function toClipMedia(clip: { renderStatus: string | null; renditions: unknown }, publicUrl: PublicUrl): ClipMedia | null {
  if (clip.renderStatus !== 'ready') return null;
  const parsed = clipRenditionsSchema.safeParse(clip.renditions);
  if (!parsed.success) return null;
  return {
    horizontalUrl: publicUrl(parsed.data.horizontal),
    verticalUrl: publicUrl(parsed.data.vertical),
    squareUrl: publicUrl(parsed.data.square),
    audioUrl: publicUrl(parsed.data.audio),
    thumbnailUrl: publicUrl(parsed.data.thumbnail),
  };
}
