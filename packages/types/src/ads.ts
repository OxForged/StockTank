import { z } from 'zod';

// ───────── Inventory ─────────

/** Stable keys the front-ends render slots for. Seeded as AdPlacement rows. */
export const PLACEMENT_KEYS = [
  'home_presenting_sponsor',
  'home_native_feed',
  'home_leaderboard',
  'watchlist_sidebar',
  'episode_page',
  'project_page',
  'company_page',
  'newsletter_primary',
  'audio_preroll',
  'video_preroll',
  'show_sponsorship',
] as const;
export const placementKeySchema = z.enum(PLACEMENT_KEYS);
export type PlacementKey = z.infer<typeof placementKeySchema>;

export const placementSurfaceSchema = z.enum(['web', 'newsletter', 'audio', 'video']);
export const placementFormatSchema = z.enum([
  'sponsor_banner',
  'native_card',
  'leaderboard',
  'sidebar_card',
  'audio_read',
  'video_preroll',
  'show_sponsorship',
  'newsletter_slot',
]);
export const pricingModelSchema = z.enum(['cpm', 'flat_week', 'flat_episode', 'flat_issue']);
export type PricingModel = z.infer<typeof pricingModelSchema>;
export const rateVisibilitySchema = z.enum(['public', 'on_request']);

/** Public media-kit view of a placement. `rateCents` is null unless sales published the rate. */
export const mediaKitPlacementSchema = z.object({
  key: placementKeySchema,
  name: z.string(),
  description: z.string(),
  surface: placementSurfaceSchema,
  format: placementFormatSchema,
  specs: z.string(),
  pricingModel: pricingModelSchema,
  rateCents: z.number().int().nullable(),
  currency: z.string(),
  rateVisibility: rateVisibilitySchema,
});
export type MediaKitPlacement = z.infer<typeof mediaKitPlacementSchema>;

export const mediaKitResponseSchema = z.object({
  placements: z.array(mediaKitPlacementSchema),
  /** Whether ads are currently being served (feature flag `advertising`). */
  advertisingLive: z.boolean(),
});
export type MediaKitResponse = z.infer<typeof mediaKitResponseSchema>;

// ───────── Serving & tracking ─────────

export const serveAdQuerySchema = z.object({
  placement: placementKeySchema,
  /** Path of the page rendering the slot, for reporting. */
  path: z.string().max(300).optional(),
});

export const servedAdSchema = z.object({
  placement: placementKeySchema,
  kind: z.enum(['display', 'native', 'audio_script', 'video']),
  advertiserName: z.string(),
  headline: z.string(),
  body: z.string().nullable(),
  imageUrl: z.string().nullable(),
  altText: z.string().nullable(),
  ctaLabel: z.string(),
  /** Always the StockTank click-tracking URL, never the raw destination. */
  clickUrl: z.string(),
  /** Always shown next to the ad (§48 advertising disclosure). */
  disclosureLabel: z.string(),
  /** Signed, single-use token; POST it to record a viewable impression. */
  impressionToken: z.string(),
  isHouse: z.boolean(),
});
export type ServedAd = z.infer<typeof servedAdSchema>;

export const serveAdResponseSchema = z.object({ ad: servedAdSchema.nullable() });
export type ServeAdResponse = z.infer<typeof serveAdResponseSchema>;

export const recordImpressionRequestSchema = z.object({ token: z.string().min(10).max(2048) });

// ───────── Admin: advertisers ─────────

export const advertiserStatusSchema = z.enum(['pending_review', 'approved', 'suspended']);

const httpUrl = z
  .url()
  .max(2048)
  .refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) URL');

export const advertiserSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  website: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  industry: z.string().nullable(),
  status: advertiserStatusSchema,
  complianceNotes: z.string().nullable(),
  isHouse: z.boolean(),
  campaignCount: z.number().int(),
  createdAt: z.string(),
});
export type Advertiser = z.infer<typeof advertiserSchema>;

export const advertiserInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  website: httpUrl.nullable().optional(),
  contactName: z.string().trim().max(120).nullable().optional(),
  contactEmail: z.email().max(254).nullable().optional(),
  industry: z.string().trim().max(80).nullable().optional(),
  complianceNotes: z.string().max(4000).nullable().optional(),
});
export type AdvertiserInput = z.infer<typeof advertiserInputSchema>;

export const advertiserStatusUpdateSchema = z.object({ status: advertiserStatusSchema });

// ───────── Admin: placements (rate card) ─────────

export const adminPlacementSchema = mediaKitPlacementSchema.extend({
  id: z.string(),
  maxActiveCampaigns: z.number().int(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  activeCampaignCount: z.number().int(),
});
export type AdminPlacement = z.infer<typeof adminPlacementSchema>;

export const placementUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().min(2).max(1000).optional(),
  specs: z.string().trim().max(1000).optional(),
  pricingModel: pricingModelSchema.optional(),
  rateCents: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  rateVisibility: rateVisibilitySchema.optional(),
  maxActiveCampaigns: z.number().int().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});
export type PlacementUpdate = z.infer<typeof placementUpdateSchema>;

// ───────── Admin: campaigns & creatives ─────────

export const campaignStatusSchema = z.enum(['draft', 'in_review', 'approved', 'rejected', 'paused', 'completed']);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;
export const reviewStatusSchema = z.enum(['draft', 'review', 'approved', 'rejected', 'published', 'archived']);

export const creativeSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  kind: z.enum(['display', 'native', 'audio_script', 'video']),
  headline: z.string(),
  body: z.string().nullable(),
  imageUrl: z.string().nullable(),
  altText: z.string().nullable(),
  ctaLabel: z.string(),
  clickUrl: z.string(),
  disclosureLabel: z.string(),
  reviewStatus: reviewStatusSchema,
  policyFlags: z.array(z.string()),
  reviewNotes: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Creative = z.infer<typeof creativeSchema>;

export const creativeInputSchema = z.object({
  kind: z.enum(['display', 'native', 'audio_script', 'video']),
  headline: z.string().trim().min(3).max(90),
  body: z.string().trim().max(280).nullable().optional(),
  imageUrl: httpUrl.nullable().optional(),
  altText: z.string().trim().max(200).nullable().optional(),
  ctaLabel: z.string().trim().min(2).max(24).optional(),
  clickUrl: httpUrl,
  disclosureLabel: z.enum(['Sponsored', 'Paid partnership', 'Presented by', 'Advertisement']).optional(),
});
export type CreativeInput = z.infer<typeof creativeInputSchema>;

export const campaignSchema = z.object({
  id: z.string(),
  advertiser: z.object({ id: z.string(), name: z.string(), status: advertiserStatusSchema, isHouse: z.boolean() }),
  name: z.string(),
  objective: z.string().nullable(),
  status: campaignStatusSchema,
  startsAt: z.string(),
  endsAt: z.string(),
  pricingModel: pricingModelSchema,
  rateCents: z.number().int(),
  budgetCents: z.number().int(),
  currency: z.string(),
  impressionGoal: z.number().int().nullable(),
  frequencyCapPerDay: z.number().int().nullable(),
  weight: z.number().int(),
  placementKeys: z.array(placementKeySchema),
  creatives: z.array(creativeSchema),
  createdById: z.string().nullable(),
  submittedAt: z.string().nullable(),
  reviewedById: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.string(),
});
export type Campaign = z.infer<typeof campaignSchema>;

export const campaignInputSchema = z
  .object({
    advertiserId: z.string().min(1),
    name: z.string().trim().min(2).max(120),
    objective: z.string().trim().max(500).nullable().optional(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    pricingModel: pricingModelSchema,
    rateCents: z.number().int().min(0).max(1_000_000_000),
    budgetCents: z.number().int().min(0).max(10_000_000_000),
    currency: z.string().length(3).toUpperCase().default('USD'),
    impressionGoal: z.number().int().positive().nullable().optional(),
    frequencyCapPerDay: z.number().int().min(1).max(100).nullable().optional(),
    weight: z.number().int().min(1).max(100).default(1),
    placementKeys: z.array(placementKeySchema).min(1),
  })
  .refine((c) => new Date(c.endsAt) > new Date(c.startsAt), { message: 'endsAt must be after startsAt', path: ['endsAt'] });
export type CampaignInput = z.infer<typeof campaignInputSchema>;

export const reviewDecisionSchema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('approve'),
    /** Required when the item has policy flags: the reviewer confirms each was checked. */
    acknowledgedFlags: z.array(z.string()).default([]),
    notes: z.string().trim().max(2000).optional(),
  }),
  z.object({ decision: z.literal('reject'), notes: z.string().trim().min(3).max(2000) }),
]);
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;

export const adminCampaignListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: campaignStatusSchema.optional(),
  advertiserId: z.string().optional(),
});

export const campaignListResponseSchema = z.object({
  items: z.array(campaignSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});
export type CampaignListResponse = z.infer<typeof campaignListResponseSchema>;

export const advertiserListResponseSchema = z.object({ items: z.array(advertiserSchema), total: z.number() });
export type AdvertiserListResponse = z.infer<typeof advertiserListResponseSchema>;

export const reviewQueueResponseSchema = z.object({
  campaigns: z.array(campaignSchema),
  creatives: z.array(creativeSchema.extend({ campaignName: z.string(), advertiserName: z.string() })),
});
export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;

export const campaignReportSchema = z.object({
  campaignId: z.string(),
  impressions: z.number().int(),
  clicks: z.number().int(),
  /** clicks / impressions, 0 when there are no impressions. */
  ctr: z.number(),
  /** CPM: impressions/1000 × rate. Flat pricing: the flat rate. Capped at budget. */
  estimatedSpendCents: z.number().int(),
  currency: z.string(),
  daily: z.array(z.object({ date: z.string(), impressions: z.number().int(), clicks: z.number().int() })),
  byPlacement: z.array(z.object({ placementKey: placementKeySchema, impressions: z.number().int(), clicks: z.number().int() })),
});
export type CampaignReport = z.infer<typeof campaignReportSchema>;

export const advertisingOverviewSchema = z.object({
  activeCampaigns: z.number().int(),
  pendingReviews: z.number().int(),
  impressionsLast7d: z.number().int(),
  clicksLast7d: z.number().int(),
  bookedRevenueCents: z.number().int(),
  newInquiries: z.number().int(),
  confirmedSubscribers: z.number().int(),
  advertisingLive: z.boolean(),
});
export type AdvertisingOverview = z.infer<typeof advertisingOverviewSchema>;
