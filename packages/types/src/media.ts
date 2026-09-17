import { z } from 'zod';

/** Upload formats accepted by the media pipeline (§13). The worker re-checks real streams with ffprobe. */
export const MEDIA_UPLOAD_MIME_TYPES = ['video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'] as const;
export const mediaUploadMimeSchema = z.enum(MEDIA_UPLOAD_MIME_TYPES);
export const mediaKindSchema = z.enum(['video', 'audio']);
export type MediaKind = z.infer<typeof mediaKindSchema>;
export const mediaStatusSchema = z.enum(['pending_upload', 'uploaded', 'processing', 'ready', 'failed']);
export type MediaStatus = z.infer<typeof mediaStatusSchema>;

// ───── Public playback ─────

export const episodeMediaSchema = z.object({
  kind: mediaKindSchema,
  hlsUrl: z.string().nullable(),
  audioUrl: z.string().nullable(),
  posterUrl: z.string().nullable(),
  durationSeconds: z.number().nullable(),
});
export type EpisodeMedia = z.infer<typeof episodeMediaSchema>;

export const clipMediaSchema = z.object({
  horizontalUrl: z.string().nullable(),
  verticalUrl: z.string().nullable(),
  squareUrl: z.string().nullable(),
  audioUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
});
export type ClipMedia = z.infer<typeof clipMediaSchema>;
