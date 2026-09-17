import { z } from 'zod';
import { publishStatusSchema } from './admin-content.js';

/** Live radio (§12, Milestone 5). Now-playing data comes from AzuraCast through the API; listeners never see AzuraCast pages. */

export const radioTrackSchema = z.object({
  title: z.string(),
  artist: z.string().nullable(),
  album: z.string().nullable(),
  artUrl: z.string().nullable(),
  playlist: z.string().nullable(),
  playedAt: z.string().nullable(),
  durationSeconds: z.number().nullable(),
});
export type RadioTrack = z.infer<typeof radioTrackSchema>;

export const radioNowPlayingSchema = z.object({
  isOnline: z.boolean(),
  listeners: z.number().int(),
  live: z.object({ isLive: z.boolean(), streamerName: z.string().nullable(), startedAt: z.string().nullable() }),
  current: radioTrackSchema.extend({ elapsedSeconds: z.number().nullable(), remainingSeconds: z.number().nullable() }).nullable(),
  next: radioTrackSchema.nullable(),
  recent: z.array(radioTrackSchema),
  stream: z.object({
    hlsUrl: z.string().nullable(),
    mounts: z.array(z.object({ name: z.string().nullable(), url: z.string(), bitrate: z.number().nullable(), format: z.string().nullable(), isDefault: z.boolean() })),
  }),
  fetchedAt: z.string(),
});
export type RadioNowPlaying = z.infer<typeof radioNowPlayingSchema>;

export const radioStationSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isDemo: z.boolean(),
  /** Null when AzuraCast is unreachable or not configured; the UI must then say the station is unavailable. */
  nowPlaying: radioNowPlayingSchema.nullable(),
  /** True when now playing is served from the last good fetch because AzuraCast did not answer. */
  stale: z.boolean(),
});
export type RadioStation = z.infer<typeof radioStationSchema>;
export const radioStationListSchema = z.object({ items: z.array(radioStationSchema) });
export type RadioStationList = z.infer<typeof radioStationListSchema>;

// ───── Admin ─────

export const radioStationInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes')
    .max(100)
    .optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  azuracastShortcode: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{1,100}$/i, 'Use the station shortcode from AzuraCast'),
  status: publishStatusSchema.default('draft'),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});
export type RadioStationInput = z.infer<typeof radioStationInputSchema>;

export const adminRadioStationSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  azuracastShortcode: z.string(),
  status: publishStatusSchema,
  sortOrder: z.number().int(),
  isDemo: z.boolean(),
  updatedAt: z.string(),
  nowPlaying: radioNowPlayingSchema.nullable(),
  /** Why now playing could not be fetched, for staff only. */
  error: z.string().nullable(),
});
export type AdminRadioStation = z.infer<typeof adminRadioStationSchema>;
export const adminRadioStationListSchema = z.object({ items: z.array(adminRadioStationSchema) });

export const adminRadioStationDetailSchema = z.object({
  station: adminRadioStationSchema,
  status: z.object({ backendRunning: z.boolean(), frontendRunning: z.boolean() }).nullable(),
  playlists: z.array(z.object({ id: z.number().int(), name: z.string(), isEnabled: z.boolean(), type: z.string().nullable(), songCount: z.number().nullable() })),
  /** Errors from management endpoints (e.g. missing API key); now playing may still work without them. */
  managementError: z.string().nullable(),
});
export type AdminRadioStationDetail = z.infer<typeof adminRadioStationDetailSchema>;

export const radioStatusResponseSchema = z.object({ azuracastConfigured: z.boolean(), apiKeyConfigured: z.boolean() });
export type RadioStatusResponse = z.infer<typeof radioStatusResponseSchema>;

export const azuracastStationOptionSchema = z.object({ id: z.number().int(), name: z.string(), shortcode: z.string(), isPublic: z.boolean() });
export const azuracastStationListSchema = z.object({ items: z.array(azuracastStationOptionSchema) });
export type AzuracastStationOption = z.infer<typeof azuracastStationOptionSchema>;
