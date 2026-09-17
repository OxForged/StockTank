import { Router } from 'express';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '@stocktank/database';
import {
  featureFlagUpdateSchema,
  inquiryListQuerySchema,
  inquiryUpdateSchema,
  subscriberListQuerySchema,
  type FeatureFlag,
  type Inquiry,
  type InquiryListResponse,
  type Subscriber,
  type SubscriberListResponse,
} from '@stocktank/types';
import { writeAudit } from '../lib/audit.js';
import { errors } from '../lib/errors.js';
import { validate } from '../lib/validate.js';
import { getAuth, requirePermission } from '../middleware/auth.js';

export interface AdminMarketingDeps {
  prisma: PrismaClient;
}

const idParams = z.object({ id: z.string().min(1).max(64) });
const flagParams = z.object({ key: z.string().regex(/^[a-z0-9_]{1,64}$/) });

type InquiryRow = Prisma.AdvertisingInquiryGetPayload<object>;
type SubscriberRow = Prisma.NewsletterSubscriberGetPayload<object>;

function toInquiry(r: InquiryRow): Inquiry {
  return {
    id: r.id,
    company: r.company,
    contactName: r.contactName,
    email: r.email,
    website: r.website,
    budgetRange: r.budgetRange,
    placementKeys: r.placementKeys,
    message: r.message,
    status: r.status,
    notes: r.notes,
    advertiserId: r.advertiserId,
    utmSource: r.utmSource,
    utmMedium: r.utmMedium,
    utmCampaign: r.utmCampaign,
    referrer: r.referrer,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toSubscriber(r: SubscriberRow): Subscriber {
  return {
    id: r.id,
    email: r.email,
    status: r.status,
    source: r.source,
    utmSource: r.utmSource,
    utmMedium: r.utmMedium,
    utmCampaign: r.utmCampaign,
    consentAt: r.consentAt.toISOString(),
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
    unsubscribedAt: r.unsubscribedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Quotes a CSV cell and neutralises spreadsheet formula injection. */
function csvCell(value: string | null): string {
  if (value === null) return '';
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function adminMarketingRouter({ prisma }: AdminMarketingDeps): Router {
  const router = Router();

  // ───── Sales leads ─────
  router.get('/inquiries', requirePermission('leads.manage'), async (req, res) => {
    const q = validate(inquiryListQuerySchema, req.query, 'query');
    const where = q.status ? { status: q.status } : {};
    const [rows, total] = await Promise.all([
      prisma.advertisingInquiry.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.advertisingInquiry.count({ where }),
    ]);
    const response: InquiryListResponse = { items: rows.map(toInquiry), page: q.page, pageSize: q.pageSize, total };
    res.json(response);
  });

  router.patch('/inquiries/:id', requirePermission('leads.manage'), async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const body = validate(inquiryUpdateSchema, req.body, 'body');
    const existing = await prisma.advertisingInquiry.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw errors.notFound('Inquiry not found');
    if (body.advertiserId) {
      const advertiser = await prisma.advertiser.findUnique({ where: { id: body.advertiserId }, select: { id: true } });
      if (!advertiser) throw errors.badRequest('Advertiser not found');
    }
    const row = await prisma.advertisingInquiry.update({
      where: { id },
      data: { ...body, assignedToId: getAuth(req).user.id },
    });
    await writeAudit(prisma, req, {
      action: 'advertising.inquiry.update',
      actorId: getAuth(req).user.id,
      targetType: 'advertising_inquiry',
      targetId: id,
      metadata: { from: existing.status, to: row.status },
    });
    res.json(toInquiry(row));
  });

  // ───── Newsletter audience ─────
  router.get('/subscribers', requirePermission('newsletter.manage'), async (req, res) => {
    const q = validate(subscriberListQuerySchema, req.query, 'query');
    const where = q.status ? { status: q.status } : {};
    const [rows, total, grouped] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.newsletterSubscriber.count({ where }),
      prisma.newsletterSubscriber.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const counts = { pending: 0, confirmed: 0, unsubscribed: 0 };
    for (const g of grouped) counts[g.status] = g._count._all;
    const response: SubscriberListResponse = { items: rows.map(toSubscriber), page: q.page, pageSize: q.pageSize, total, counts };
    res.json(response);
  });

  /** Confirmed subscribers only: exporting unconfirmed or unsubscribed addresses would break consent. */
  router.get('/subscribers/export.csv', requirePermission('newsletter.manage'), async (req, res) => {
    const rows = await prisma.newsletterSubscriber.findMany({ where: { status: 'confirmed' }, orderBy: { confirmedAt: 'asc' } });
    await writeAudit(prisma, req, {
      action: 'newsletter.export',
      actorId: getAuth(req).user.id,
      targetType: 'newsletter_subscribers',
      metadata: { count: rows.length },
    });
    const lines = [
      'email,confirmed_at,source,utm_source,utm_medium,utm_campaign',
      ...rows.map((r) =>
        [r.email, r.confirmedAt?.toISOString() ?? null, r.source, r.utmSource, r.utmMedium, r.utmCampaign].map(csvCell).join(','),
      ),
    ];
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="stocktank-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.set('Cache-Control', 'private, no-store');
    res.send(lines.join('\n'));
  });

  // ───── Feature flags ─────
  router.get('/feature-flags', requirePermission('feature_flags.manage'), async (_req, res) => {
    const rows = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    const items: FeatureFlag[] = rows.map((r) => ({ key: r.key, enabled: r.enabled, description: r.description }));
    res.json({ items });
  });

  router.put('/feature-flags/:key', requirePermission('feature_flags.manage'), async (req, res) => {
    const { key } = validate(flagParams, req.params, 'params');
    const { enabled } = validate(featureFlagUpdateSchema, req.body, 'body');
    const existing = await prisma.featureFlag.findUnique({ where: { key } });
    if (!existing) throw errors.notFound('Feature flag not found');
    await prisma.featureFlag.update({ where: { key }, data: { enabled } });
    await writeAudit(prisma, req, {
      action: 'feature_flag.update',
      actorId: getAuth(req).user.id,
      targetType: 'feature_flag',
      targetId: key,
      metadata: { from: existing.enabled, to: enabled },
    });
    res.status(204).end();
  });

  return router;
}
