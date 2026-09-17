import { z } from 'zod';

/** First-party analytics (§29). Browser events are anonymous; downloads are recorded server-side. */

export const ANALYTICS_ENTITY_TYPES = ['show', 'episode', 'clip', 'radio', 'article', 'project', 'company', 'person'] as const;
export const analyticsEntityTypeSchema = z.enum(ANALYTICS_ENTITY_TYPES);
export type AnalyticsEntityType = z.infer<typeof analyticsEntityTypeSchema>;

export const clientAnalyticsEventSchema = z.object({
  type: z.enum(['page_view', 'play_start', 'play_progress', 'play_complete', 'share', 'search']),
  path: z.string().max(300).optional(),
  entityType: analyticsEntityTypeSchema.optional(),
  entityId: z.string().min(1).max(64).optional(),
  mediaKind: z.enum(['video', 'audio', 'radio']).optional(),
  /** play_progress only: seconds actually played since the previous progress event. */
  seconds: z.number().int().min(1).max(300).optional(),
  query: z.string().trim().max(100).optional(),
  channel: z.enum(['native', 'copy_link', 'x', 'linkedin', 'email']).optional(),
  /** Client clock; the server clamps it to the last 24 hours. */
  occurredAt: z.iso.datetime().optional(),
});
export type ClientAnalyticsEvent = z.infer<typeof clientAnalyticsEventSchema>;

export const analyticsBatchSchema = z.object({
  events: z.array(clientAnalyticsEventSchema).min(1).max(25),
  /** First-touch attribution captured on landing. */
  referrer: z.string().max(500).optional(),
  utm: z.object({ source: z.string().max(100).optional(), medium: z.string().max(100).optional(), campaign: z.string().max(100).optional() }).optional(),
});
export type AnalyticsBatch = z.infer<typeof analyticsBatchSchema>;

// ───── Dashboards ─────

export const analyticsRangeQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type AnalyticsRangeQuery = z.infer<typeof analyticsRangeQuerySchema>;

const range = z.object({ from: z.string(), to: z.string() });

export const audienceAnalyticsSchema = z.object({
  range,
  uniqueVisitors: z.number().int(),
  /** Distinct visitors in the 30 days ending on `range.to`. */
  mau: z.number().int(),
  pageViews: z.number().int(),
  daily: z.array(z.object({ date: z.string(), visitors: z.number().int(), pageViews: z.number().int() })),
  followers: z.object({ total: z.number().int(), new: z.number().int() }),
  trafficSources: z.array(z.object({ source: z.string(), visitors: z.number().int(), pageViews: z.number().int() })),
  /** Weekly cohorts: of visitors first seen in a week, how many came back the following week. */
  retention: z.array(z.object({ cohortWeek: z.string(), visitors: z.number().int(), returned: z.number().int(), rate: z.number() })),
  topSearches: z.array(z.object({ query: z.string(), count: z.number().int() })),
});
export type AudienceAnalytics = z.infer<typeof audienceAnalyticsSchema>;

const engagement = {
  views: z.number().int(),
  plays: z.number().int(),
  completions: z.number().int(),
  completionRate: z.number(),
  listenSeconds: z.number().int(),
  watchSeconds: z.number().int(),
  downloads: z.number().int(),
  shares: z.number().int(),
};

export const contentAnalyticsSchema = z.object({
  range,
  totals: z.object({ ...engagement, radioSeconds: z.number().int() }),
  topEpisodes: z.array(z.object({ id: z.string(), title: z.string(), showTitle: z.string(), ...engagement })),
  clips: z.array(z.object({ id: z.string(), title: z.string(), plays: z.number().int(), completions: z.number().int(), shares: z.number().int(), views: z.number().int() })),
  /** Metrics from §29 that have no product feature yet, so they are not measured (never shown as zero). */
  notTracked: z.array(z.string()),
});
export type ContentAnalytics = z.infer<typeof contentAnalyticsSchema>;

export const showAnalyticsSchema = z.object({
  range,
  items: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      isDemo: z.boolean(),
      ...engagement,
      followers: z.number().int(),
      newFollowers: z.number().int(),
    }),
  ),
});
export type ShowAnalytics = z.infer<typeof showAnalyticsSchema>;

export const projectAnalyticsSchema = z.object({
  range,
  items: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      isDemo: z.boolean(),
      views: z.number().int(),
      followers: z.number().int(),
      newFollowers: z.number().int(),
      /** Episodes that discuss the project (all time). */
      episodeMentions: z.number().int(),
      /** Page views of those episodes in the range. */
      mentionViews: z.number().int(),
    }),
  ),
});
export type ProjectAnalytics = z.infer<typeof projectAnalyticsSchema>;
