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
export const mediaJobSchema = z.discriminatedUnion('type', [transcodeJobSchema, renderClipJobSchema]);
export type MediaJob = z.infer<typeof mediaJobSchema>;

/** Deterministic job ids make enqueueing idempotent (a double click never starts two transcodes). */
export function jobIdFor(job: MediaJob, attempt: number): string {
  return job.type === 'transcode' ? `transcode-${job.assetId}-${attempt}` : `clip-${job.clipId}-${attempt}`;
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
