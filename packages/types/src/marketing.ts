import { z } from 'zod';
import { placementKeySchema } from './ads.js';

export const utmSchema = z
  .object({
    source: z.string().trim().max(100).optional(),
    medium: z.string().trim().max(100).optional(),
    campaign: z.string().trim().max(100).optional(),
  })
  .optional();
export type Utm = z.infer<typeof utmSchema>;

// ───────── Advertise with StockTank: inbound leads ─────────

export const budgetRangeSchema = z.enum(['under_5k', 'from_5k_to_25k', 'from_25k_to_100k', 'over_100k', 'undisclosed']);
export type BudgetRange = z.infer<typeof budgetRangeSchema>;

export const advertisingInquiryRequestSchema = z.object({
  company: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  website: z.url().max(2048).optional(),
  budgetRange: budgetRangeSchema,
  placementKeys: z.array(placementKeySchema).max(11).default([]),
  message: z.string().trim().min(10).max(2000),
  /** Must be true: consent to be contacted about advertising. */
  consent: z.literal(true),
  /** Honeypot; real users leave it empty. */
  companyFax: z.string().max(0).optional(),
  utm: z
    .object({
      source: z.string().trim().max(100).optional(),
      medium: z.string().trim().max(100).optional(),
      campaign: z.string().trim().max(100).optional(),
    })
    .optional(),
  referrer: z.string().max(500).optional(),
});
export type AdvertisingInquiryRequest = z.infer<typeof advertisingInquiryRequestSchema>;

export const inquiryStatusSchema = z.enum(['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost', 'spam']);
export type InquiryStatus = z.infer<typeof inquiryStatusSchema>;

export const inquirySchema = z.object({
  id: z.string(),
  company: z.string(),
  contactName: z.string(),
  email: z.string(),
  website: z.string().nullable(),
  budgetRange: budgetRangeSchema,
  placementKeys: z.array(z.string()),
  message: z.string(),
  status: inquiryStatusSchema,
  notes: z.string().nullable(),
  advertiserId: z.string().nullable(),
  utmSource: z.string().nullable(),
  utmMedium: z.string().nullable(),
  utmCampaign: z.string().nullable(),
  referrer: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Inquiry = z.infer<typeof inquirySchema>;

export const inquiryUpdateSchema = z.object({
  status: inquiryStatusSchema.optional(),
  notes: z.string().max(5000).nullable().optional(),
  advertiserId: z.string().nullable().optional(),
});
export type InquiryUpdate = z.infer<typeof inquiryUpdateSchema>;

export const inquiryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: inquiryStatusSchema.optional(),
});

export const inquiryListResponseSchema = z.object({
  items: z.array(inquirySchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});
export type InquiryListResponse = z.infer<typeof inquiryListResponseSchema>;

// ───────── Newsletter (double opt-in) ─────────

export const newsletterSubscribeRequestSchema = z.object({
  email: z.email().max(254),
  consent: z.literal(true),
  source: z.string().trim().max(60).optional(),
  utm: z
    .object({
      source: z.string().trim().max(100).optional(),
      medium: z.string().trim().max(100).optional(),
      campaign: z.string().trim().max(100).optional(),
    })
    .optional(),
  /** Honeypot; real users leave it empty. */
  website: z.string().max(0).optional(),
});
export type NewsletterSubscribeRequest = z.infer<typeof newsletterSubscribeRequestSchema>;

/**
 * The response is identical whether the email is new, pending or already confirmed,
 * so the endpoint cannot be used to discover subscribers.
 */
export const newsletterSubscribeResponseSchema = z.object({ status: z.literal('check_inbox') });

export const newsletterTokenRequestSchema = z.object({ token: z.string().min(20).max(200) });

export const newsletterTokenResponseSchema = z.object({ status: z.enum(['confirmed', 'unsubscribed']) });
export type NewsletterTokenResponse = z.infer<typeof newsletterTokenResponseSchema>;

export const subscriberStatusSchema = z.enum(['pending', 'confirmed', 'unsubscribed']);

export const subscriberSchema = z.object({
  id: z.string(),
  email: z.string(),
  status: subscriberStatusSchema,
  source: z.string().nullable(),
  utmSource: z.string().nullable(),
  utmMedium: z.string().nullable(),
  utmCampaign: z.string().nullable(),
  consentAt: z.string(),
  confirmedAt: z.string().nullable(),
  unsubscribedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Subscriber = z.infer<typeof subscriberSchema>;

export const subscriberListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  status: subscriberStatusSchema.optional(),
});

export const subscriberListResponseSchema = z.object({
  items: z.array(subscriberSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  counts: z.object({ pending: z.number().int(), confirmed: z.number().int(), unsubscribed: z.number().int() }),
});
export type SubscriberListResponse = z.infer<typeof subscriberListResponseSchema>;

// ───────── Feature flags (admin) ─────────

export const featureFlagUpdateSchema = z.object({ enabled: z.boolean() });

/** Public subset: the front-ends read these to hide unfinished features (§50). */
export const publicFlagsResponseSchema = z.object({ flags: z.record(z.string(), z.boolean()) });
export type PublicFlagsResponse = z.infer<typeof publicFlagsResponseSchema>;
