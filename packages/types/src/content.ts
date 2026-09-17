import { z } from 'zod';
import { clipMediaSchema, episodeMediaSchema } from './media.js';

/** Every public content item says whether it is seeded DEMO data (§52), so the UI can label it. */
const demoFlag = { isDemo: z.boolean() };

export const projectKindSchema = z.enum([
  'crypto_project',
  'protocol',
  'dao',
  'infrastructure',
  'rwa',
  'ecosystem',
  'application',
  'traditional_company',
]);
export type ProjectKind = z.infer<typeof projectKindSchema>;

export const showSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  coverUrl: z.string().nullable(),
  episodeCount: z.number().int(),
  ...demoFlag,
});
export type ShowSummary = z.infer<typeof showSummarySchema>;

export const episodeSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  coverUrl: z.string().nullable(),
  durationSeconds: z.number().int().nullable(),
  publishedAt: z.string().nullable(),
  show: z.object({ slug: z.string(), title: z.string() }),
  ...demoFlag,
});
export type EpisodeSummary = z.infer<typeof episodeSummarySchema>;

/** Only clips with reviewStatus=published are public (§14 human approval). */
export const clipSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  episode: z.object({ slug: z.string(), title: z.string() }),
  show: z.object({ slug: z.string(), title: z.string() }),
  /** Rendered clip files; null until the clip has been rendered. */
  media: clipMediaSchema.nullable(),
  ...demoFlag,
});
export type ClipSummary = z.infer<typeof clipSummarySchema>;

export const articleSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  publishedAt: z.string().nullable(),
  sourceName: z.string().nullable(),
  ...demoFlag,
});
export type ArticleSummary = z.infer<typeof articleSummarySchema>;

export const projectSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  symbol: z.string().nullable(),
  kind: projectKindSchema,
  description: z.string().nullable(),
  chainName: z.string().nullable(),
  logoUrl: z.string().nullable(),
  verified: z.boolean(),
  ...demoFlag,
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const companySummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  ticker: z.string().nullable(),
  exchange: z.string().nullable(),
  sector: z.string().nullable(),
  country: z.string().nullable(),
  description: z.string().nullable(),
  logoUrl: z.string().nullable(),
  ...demoFlag,
});
export type CompanySummary = z.infer<typeof companySummarySchema>;

export const livestreamStatusSchema = z.enum(['scheduled', 'live', 'ended', 'cancelled']);
export type LivestreamStatus = z.infer<typeof livestreamStatusSchema>;

export const livestreamSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: livestreamStatusSchema,
  scheduledStart: z.string(),
  scheduledEnd: z.string().nullable(),
  /** Null until media/live infrastructure exists; the UI must not pretend to play. */
  streamUrl: z.string().nullable(),
  show: z.object({ slug: z.string(), title: z.string() }).nullable(),
  segments: z.array(z.object({ position: z.number().int(), title: z.string() })),
  ...demoFlag,
});
export type LivestreamSummary = z.infer<typeof livestreamSummarySchema>;

/** Aggregated homepage payload (hybrid layout). Every list may be empty. */
export const homeResponseSchema = z.object({
  featuredShows: z.array(showSummarySchema),
  latestEpisodes: z.array(episodeSummarySchema),
  clips: z.array(clipSummarySchema),
  explainers: z.array(articleSummarySchema),
  projects: z.array(projectSummarySchema),
  companies: z.array(companySummarySchema),
  /** Current live broadcast if one has status=live, else null. */
  live: livestreamSummarySchema.nullable(),
  /** Today's and upcoming broadcasts, soonest first (max 6). */
  rundown: z.array(livestreamSummarySchema),
  generatedAt: z.string(),
});
export type HomeResponse = z.infer<typeof homeResponseSchema>;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(24),
});

const paginated = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), page: z.number(), pageSize: z.number(), total: z.number() });

export const showListResponseSchema = paginated(showSummarySchema);
export type ShowListResponse = z.infer<typeof showListResponseSchema>;
export const projectListResponseSchema = paginated(projectSummarySchema);
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;
export const companyListResponseSchema = paginated(companySummarySchema);
export const articleListResponseSchema = paginated(articleSummarySchema);
export type ArticleListResponse = z.infer<typeof articleListResponseSchema>;
export type CompanyListResponse = z.infer<typeof companyListResponseSchema>;

export const personSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  twitter: z.string().nullable(),
  /** Hosts only: AI personalities must be disclosed (§25). */
  isAi: z.boolean(),
  role: z.enum(['host', 'guest']),
  ...demoFlag,
});
export type PersonSummary = z.infer<typeof personSummarySchema>;

export const showDetailResponseSchema = z.object({
  show: showSummarySchema,
  /** Present when the show publishes a podcast feed (§11). */
  podcast: z.object({ feedUrl: z.string() }).nullable(),
  hosts: z.array(personSummarySchema),
  episodes: z.array(episodeSummarySchema),
});
export type ShowDetailResponse = z.infer<typeof showDetailResponseSchema>;

export const searchQuerySchema = z.object({ q: z.string().trim().min(1).max(100) });

/** Media graph pages (§9): each entity with everything connected to it. */
export const episodeDetailResponseSchema = z.object({
  episode: episodeSummarySchema.extend({ description: z.string().nullable(), number: z.number().int().nullable() }),
  /** Playable renditions; null until uploaded media has finished processing. */
  media: episodeMediaSchema.nullable(),
  hosts: z.array(personSummarySchema),
  guests: z.array(personSummarySchema),
  projects: z.array(projectSummarySchema),
  companies: z.array(companySummarySchema),
  clips: z.array(clipSummarySchema),
  moreFromShow: z.array(episodeSummarySchema),
});
export type EpisodeDetailResponse = z.infer<typeof episodeDetailResponseSchema>;

export const projectDetailResponseSchema = z.object({
  project: projectSummarySchema.extend({
    website: z.string().nullable(),
    twitter: z.string().nullable(),
    contractAddress: z.string().nullable(),
    explorerUrl: z.string().nullable(),
  }),
  episodes: z.array(episodeSummarySchema),
});
export type ProjectDetailResponse = z.infer<typeof projectDetailResponseSchema>;

export const companyDetailResponseSchema = z.object({
  company: companySummarySchema.extend({ industry: z.string().nullable(), website: z.string().nullable() }),
  episodes: z.array(episodeSummarySchema),
});
export type CompanyDetailResponse = z.infer<typeof companyDetailResponseSchema>;

export const personDetailResponseSchema = z.object({
  person: personSummarySchema.extend({ website: z.string().nullable() }),
  episodes: z.array(episodeSummarySchema),
});
export type PersonDetailResponse = z.infer<typeof personDetailResponseSchema>;

export const articleDetailResponseSchema = z.object({
  article: articleSummarySchema.extend({ body: z.string().nullable(), author: z.string().nullable(), originalUrl: z.string().nullable() }),
});
export type ArticleDetailResponse = z.infer<typeof articleDetailResponseSchema>;

/** Grouped search results (§10 grouping). Meilisearch when configured, Postgres otherwise. */
export const searchResponseSchema = z.object({
  query: z.string(),
  engine: z.enum(['meilisearch', 'postgres']),
  shows: z.array(showSummarySchema),
  episodes: z.array(episodeSummarySchema),
  people: z.array(personSummarySchema),
  projects: z.array(projectSummarySchema),
  companies: z.array(companySummarySchema),
  articles: z.array(articleSummarySchema),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const searchSuggestionSchema = z.object({
  type: z.enum(['show', 'episode', 'person', 'project', 'company', 'article']),
  id: z.string(),
  label: z.string(),
  /** Public path on the site. */
  path: z.string(),
});
export type SearchSuggestion = z.infer<typeof searchSuggestionSchema>;
export const searchSuggestResponseSchema = z.object({ query: z.string(), suggestions: z.array(searchSuggestionSchema) });
export type SearchSuggestResponse = z.infer<typeof searchSuggestResponseSchema>;

/** Popular queries (normalised, only queries that returned results, never tied to a person). */
export const trendingSearchesResponseSchema = z.object({ queries: z.array(z.string()) });
export type TrendingSearchesResponse = z.infer<typeof trendingSearchesResponseSchema>;
