import { z } from 'zod';
import { publishStatusSchema } from './admin-content.js';

/** Podcast distribution (§11, Milestone 4). */

export const podcastEpisodeTypeSchema = z.enum(['full', 'trailer', 'bonus']);
export type PodcastEpisodeType = z.infer<typeof podcastEpisodeTypeSchema>;
export const podcastSyncStatusSchema = z.enum(['queued', 'syncing', 'synced', 'failed']);
export type PodcastSyncStatus = z.infer<typeof podcastSyncStatusSchema>;

/** Apple Podcasts categories relevant to StockTank shows (full list: podcasters.apple.com categories). */
export const PODCAST_CATEGORIES = {
  Business: ['Careers', 'Entrepreneurship', 'Investing', 'Management', 'Marketing', 'Non-Profit'],
  News: ['Business News', 'Daily News', 'News Commentary', 'Politics', 'Tech News'],
  Technology: [],
  Education: ['Courses', 'How To', 'Self-Improvement'],
  'Society & Culture': ['Documentary', 'Personal Journals', 'Philosophy'],
} as const satisfies Record<string, readonly string[]>;
export type PodcastCategory = keyof typeof PODCAST_CATEGORIES;
const categoryNames = Object.keys(PODCAST_CATEGORIES) as [PodcastCategory, ...PodcastCategory[]];

export const showPodcastSettingsInputSchema = z
  .object({
    podcastEnabled: z.boolean(),
    podcastAuthor: z.string().trim().max(120).nullable().optional(),
    podcastCategory: z.enum(categoryNames).nullable().optional(),
    podcastSubcategory: z.string().trim().max(60).nullable().optional(),
    podcastExplicit: z.boolean().default(false),
    podcastLanguage: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Use a language code such as en or en-US')
      .default('en'),
    castopodPodcastId: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (v) => !v.podcastSubcategory || (v.podcastCategory && (PODCAST_CATEGORIES[v.podcastCategory] as readonly string[]).includes(v.podcastSubcategory)),
    { message: 'Subcategory must belong to the chosen category', path: ['podcastSubcategory'] },
  )
  .refine((v) => !v.podcastEnabled || Boolean(v.podcastCategory), { message: 'Choose a category before enabling the feed', path: ['podcastCategory'] });
export type ShowPodcastSettingsInput = z.infer<typeof showPodcastSettingsInputSchema>;

export const adminPodcastShowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  status: publishStatusSchema,
  isDemo: z.boolean(),
  coverUrl: z.string().nullable(),
  podcastEnabled: z.boolean(),
  podcastAuthor: z.string().nullable(),
  podcastCategory: z.string().nullable(),
  podcastSubcategory: z.string().nullable(),
  podcastExplicit: z.boolean(),
  podcastLanguage: z.string(),
  castopodPodcastId: z.number().int().nullable(),
  /** Public feed URL; null unless the feed is enabled and the show is published. */
  feedUrl: z.string().nullable(),
  publishedEpisodes: z.number().int(),
  /** Published episodes with processed audio, i.e. what the feed contains. */
  feedEpisodes: z.number().int(),
  /** Problems that keep the feed from being accepted by podcast directories. */
  warnings: z.array(z.string()),
});
export type AdminPodcastShow = z.infer<typeof adminPodcastShowSchema>;
export const adminPodcastShowListSchema = z.object({ items: z.array(adminPodcastShowSchema) });

export const adminPodcastEpisodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  number: z.number().int().nullable(),
  status: publishStatusSchema,
  publishedAt: z.string().nullable(),
  episodeType: podcastEpisodeTypeSchema,
  hasAudio: z.boolean(),
  inFeed: z.boolean(),
  castopodEpisodeId: z.number().int().nullable(),
  podcastSyncStatus: podcastSyncStatusSchema.nullable(),
  podcastSyncError: z.string().nullable(),
  podcastSyncedAt: z.string().nullable(),
});
export type AdminPodcastEpisode = z.infer<typeof adminPodcastEpisodeSchema>;
export const adminPodcastEpisodeListSchema = z.object({ items: z.array(adminPodcastEpisodeSchema) });

export const podcastEpisodeTypeInputSchema = z.object({ episodeType: podcastEpisodeTypeSchema });

export const podcastStatusResponseSchema = z.object({
  castopodConfigured: z.boolean(),
  queueConfigured: z.boolean(),
  ownerEmailConfigured: z.boolean(),
});
export type PodcastStatusResponse = z.infer<typeof podcastStatusResponseSchema>;

export const castopodPodcastOptionSchema = z.object({ id: z.number().int(), handle: z.string(), title: z.string(), feedUrl: z.string() });
export const castopodPodcastListSchema = z.object({ items: z.array(castopodPodcastOptionSchema) });
export type CastopodPodcastOption = z.infer<typeof castopodPodcastOptionSchema>;
