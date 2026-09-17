import { z } from 'zod';

export const MEDIA_QUEUE = 'stocktank-media';

/** Accepted upload formats (§13). The worker re-validates the actual container/codec with ffprobe. */
export const ACCEPTED_MEDIA = {
  'video/mp4': { kind: 'video', extension: 'mp4' },
  'video/quicktime': { kind: 'video', extension: 'mov' },
  'audio/mpeg': { kind: 'audio', extension: 'mp3' },
  'audio/wav': { kind: 'audio', extension: 'wav' },
  'audio/x-wav': { kind: 'audio', extension: 'wav' },
  'audio/mp4': { kind: 'audio', extension: 'm4a' },
  'audio/x-m4a': { kind: 'audio', extension: 'm4a' },
} as const satisfies Record<string, { kind: 'video' | 'audio'; extension: string }>;
export type AcceptedMime = keyof typeof ACCEPTED_MEDIA;
export const acceptedMimeSchema = z.enum(Object.keys(ACCEPTED_MEDIA) as [AcceptedMime, ...AcceptedMime[]]);

export const transcodeJobSchema = z.object({ type: z.literal('transcode'), assetId: z.string().min(1) });
export const renderClipJobSchema = z.object({ type: z.literal('render-clip'), clipId: z.string().min(1) });
/** Sends a published episode's MP3 to Castopod (§11). */
export const podcastSyncJobSchema = z.object({ type: z.literal('podcast-sync'), episodeId: z.string().min(1) });
export const mediaJobSchema = z.discriminatedUnion('type', [transcodeJobSchema, renderClipJobSchema, podcastSyncJobSchema]);
export type MediaJob = z.infer<typeof mediaJobSchema>;

/** Deterministic job ids make enqueueing idempotent (a double click never starts two transcodes). */
export function jobIdFor(job: MediaJob, attempt: number): string {
  switch (job.type) {
    case 'transcode':
      return `transcode-${job.assetId}-${attempt}`;
    case 'render-clip':
      return `clip-${job.clipId}-${attempt}`;
    case 'podcast-sync':
      return `podcast-${job.episodeId}-${attempt}`;
  }
}

// ───────── Object layout ─────────

export const keys = {
  original: (assetId: string, extension: string) => `originals/${assetId}/source.${extension}`,
  renditionPrefix: (assetId: string) => `renditions/${assetId}`,
  hlsMaster: (assetId: string) => `renditions/${assetId}/hls/master.m3u8`,
  audio: (assetId: string) => `renditions/${assetId}/audio.mp3`,
  poster: (assetId: string) => `renditions/${assetId}/poster.jpg`,
  clipPrefix: (clipId: string) => `renditions/clips/${clipId}`,
};

/** Stored on MediaAsset.renditions. */
export const assetRenditionsSchema = z.object({
  hls: z.string().nullable(),
  audio: z.string().nullable(),
  /** MP3 size in bytes, used for podcast RSS enclosures. Absent on assets processed before Milestone 4. */
  audioBytes: z.number().int().nonnegative().optional(),
  poster: z.string().nullable(),
  variants: z.array(z.object({ name: z.string(), height: z.number().int(), bandwidth: z.number().int() })),
});
export type AssetRenditions = z.infer<typeof assetRenditionsSchema>;

/** Stored on Clip.renditions. */
export const clipRenditionsSchema = z.object({
  horizontal: z.string().nullable(),
  vertical: z.string().nullable(),
  square: z.string().nullable(),
  audio: z.string().nullable(),
  thumbnail: z.string().nullable(),
});
export type ClipRenditions = z.infer<typeof clipRenditionsSchema>;
