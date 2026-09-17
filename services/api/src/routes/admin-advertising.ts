import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '@stocktank/database';
import {
  adminCampaignListQuerySchema,
  advertiserInputSchema,
  advertiserStatusUpdateSchema,
  campaignInputSchema,
  creativeInputSchema,
  placementKeySchema,
  placementUpdateSchema,
  reviewDecisionSchema,
  type AdminPlacement,
  type Advertiser,
  type AdvertiserListResponse,
  type AdvertisingOverview,
  type Campaign,
  type CampaignListResponse,
  type CampaignReport,
  type Creative,
  type PlacementKey,
  type ReviewQueueResponse,
} from '@stocktank/types';
import { estimateSpendCents, scanCreativePolicy } from '../lib/ads.js';
import { writeAudit } from '../lib/audit.js';
import { errors } from '../lib/errors.js';
import { validate } from '../lib/validate.js';
import { getAuth, requirePermission } from '../middleware/auth.js';

export interface AdminAdvertisingDeps {
  prisma: PrismaClient;
}

const idParams = z.object({ id: z.string().min(1).max(64) });
const keyParams = z.object({ key: placementKeySchema });

/** Campaigns that can still be edited. Anything live must be paused first. */
const EDITABLE_CAMPAIGN_STATUSES = new Set(['draft', 'rejected', 'paused']);

const campaignInclude = {
  advertiser: { select: { id: true, name: true, status: true, isHouse: true } },
  placements: { include: { placement: { select: { key: true } } } },
  creatives: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.CampaignInclude;
type CampaignRow = Prisma.CampaignGetPayload<{ include: typeof campaignInclude }>;
type CreativeRow = CampaignRow['creatives'][number];

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'advertiser'
  );
}

function toCreative(row: CreativeRow): Creative {
  return {
    id: row.id,
    campaignId: row.campaignId,
    kind: row.kind,
    headline: row.headline,
    body: row.body,
    imageUrl: row.imageUrl,
    altText: row.altText,
    ctaLabel: row.ctaLabel,
    clickUrl: row.clickUrl,
    disclosureLabel: row.disclosureLabel,
    reviewStatus: row.reviewStatus,
    policyFlags: row.policyFlags,
    reviewNotes: row.reviewNotes,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    advertiser: row.advertiser,
    name: row.name,
    objective: row.objective,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    pricingModel: row.pricingModel,
    rateCents: row.rateCents,
    budgetCents: row.budgetCents,
    currency: row.currency,
    impressionGoal: row.impressionGoal,
    frequencyCapPerDay: row.frequencyCapPerDay,
    weight: row.weight,
    placementKeys: row.placements.map((p) => p.placement.key as PlacementKey),
    creatives: row.creatives.map(toCreative),
    createdById: row.createdById,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedById: row.reviewedById,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Separation of duties (§56): the person who created a campaign cannot approve it or its creatives,
 * unless they hold `roles.manage` (super admin) for a small team.
 */
function assertIndependentReviewer(req: Request, createdById: string | null): void {
  const auth = getAuth(req);
  if (createdById && createdById === auth.user.id && !auth.permissions.includes('roles.manage')) {
    throw errors.forbidden('Another staff member must review a campaign you created');
  }
}

async function loadCampaign(prisma: PrismaClient, id: string): Promise<CampaignRow> {
  const row = await prisma.campaign.findUnique({ where: { id }, include: campaignInclude });
  if (!row) throw errors.notFound('Campaign not found');
  return row;
}

async function resolvePlacementIds(prisma: PrismaClient, keys: readonly PlacementKey[]): Promise<string[]> {
  const rows = await prisma.adPlacement.findMany({ where: { key: { in: [...keys] } }, select: { id: true, key: true } });
  if (rows.length !== new Set(keys).size) throw errors.badRequest('One or more placements do not exist');
  return rows.map((r) => r.id);
}

export function adminAdvertisingRouter({ prisma }: AdminAdvertisingDeps): Router {
  const router = Router();

  // ───── Overview ─────
  router.get('/overview', requirePermission('ads.manage'), async (_req, res) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [activeCampaigns, pendingCampaigns, pendingCreatives, impressionsLast7d, clicksLast7d, booked, newInquiries, confirmedSubscribers, flag] =
      await Promise.all([
        prisma.campaign.count({ where: { status: 'approved', startsAt: { lte: now }, endsAt: { gte: now } } }),
        prisma.campaign.count({ where: { status: 'in_review' } }),
        prisma.creativeAsset.count({ where: { reviewStatus: 'review' } }),
        prisma.adImpression.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.adClick.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.campaign.aggregate({
          where: { status: { in: ['approved', 'paused', 'completed'] }, advertiser: { isHouse: false } },
          _sum: { budgetCents: true },
        }),
        prisma.advertisingInquiry.count({ where: { status: 'new' } }),
        prisma.newsletterSubscriber.count({ where: { status: 'confirmed' } }),
        prisma.featureFlag.findUnique({ where: { key: 'advertising' }, select: { enabled: true } }),
      ]);
    const response: AdvertisingOverview = {
      activeCampaigns,
      pendingReviews: pendingCampaigns + pendingCreatives,
      impressionsLast7d,
      clicksLast7d,
      bookedRevenueCents: booked._sum.budgetCents ?? 0,
      newInquiries,
      confirmedSubscribers,
      advertisingLive: flag?.enabled ?? false,
    };
    res.json(response);
  });

  // ───── Advertisers ─────
  router.get('/advertisers', requirePermission('ads.manage'), async (_req, res) => {
    const rows = await prisma.advertiser.findMany({
      orderBy: [{ isHouse: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { campaigns: true } } },
    });
    const items: Advertiser[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      website: r.website,
      contactName: r.contactName,
      contactEmail: r.contactEmail,
      industry: r.industry,
      status: r.status,
      complianceNotes: r.complianceNotes,
      isHouse: r.isHouse,
      campaignCount: r._count.campaigns,
      createdAt: r.createdAt.toISOString(),
    }));
    const response: AdvertiserListResponse = { items, total: items.length };
    res.json(response);
  });

  router.post('/advertisers', requirePermission('ads.manage'), async (req, res) => {
    const body = validate(advertiserInputSchema, req.body, 'body');
    const base = slugify(body.name);
    let slug = base;
    for (let n = 2; await prisma.advertiser.findUnique({ where: { slug }, select: { id: true } }); n++) slug = `${base}-${n}`;
    const row = await prisma.advertiser.create({
      data: {
        name: body.name,
        slug,
        website: body.website ?? null,
        contactName: body.contactName ?? null,
        contactEmail: body.contactEmail?.toLowerCase() ?? null,
        industry: body.industry ?? null,
        complianceNotes: body.complianceNotes ?? null,
      },
    });
    await writeAudit(prisma, req, { action: 'advertising.advertiser.create', actorId: getAuth(req).user.id, targetType: 'advertiser', targetId: row.id });
    res.status(201).json({ id: row.id });
  });

  router.patch('/advertisers/:id', requirePermission('ads.manage'), async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const body = validate(advertiserInputSchema.partial(), req.body, 'body');
    const existing = await prisma.advertiser.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw errors.notFound('Advertiser not found');
    await prisma.advertiser.update({
      where: { id },
      data: { ...body, contactEmail: body.contactEmail === undefined ? undefined : (body.contactEmail?.toLowerCase() ?? null) },
    });
    await writeAudit(prisma, req, { action: 'advertising.advertiser.update', actorId: getAuth(req).user.id, targetType: 'advertiser', targetId: id });
    res.status(204).end();
  });

  /** Approving or suspending an advertiser is a compliance decision, so it needs `ads.approve`. */
  router.put('/advertisers/:id/status', requirePermission('ads.approve'), async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const { status } = validate(advertiserStatusUpdateSchema, req.body, 'body');
    const existing = await prisma.advertiser.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw errors.notFound('Advertiser not found');
    await prisma.advertiser.update({ where: { id }, data: { status } });
    await writeAudit(prisma, req, {
      action: 'advertising.advertiser.status',
      actorId: getAuth(req).user.id,
      targetType: 'advertiser',
      targetId: id,
      metadata: { from: existing.status, to: status },
    });
    res.status(204).end();
  });

  // ───── Placements (rate card) ─────
  router.get('/placements', requirePermission('ads.manage'), async (_req, res) => {
    const now = new Date();
    const rows = await prisma.adPlacement.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { campaigns: { where: { campaign: { status: 'approved', startsAt: { lte: now }, endsAt: { gte: now } } } } } },
      },
    });
    const items: AdminPlacement[] = rows.map((p) => ({
      id: p.id,
      key: p.key as PlacementKey,
      name: p.name,
      description: p.description,
      surface: p.surface,
      format: p.format,
      specs: p.specs,
      pricingModel: p.pricingModel,
      rateCents: p.rateCents,
      currency: p.currency,
      rateVisibility: p.rateVisibility,
      maxActiveCampaigns: p.maxActiveCampaigns,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      activeCampaignCount: p._count.campaigns,
    }));
    res.json({ items });
  });

  router.patch('/placements/:key', requirePermission('ads.manage'), async (req, res) => {
    const { key } = validate(keyParams, req.params, 'params');
    const body = validate(placementUpdateSchema, req.body, 'body');
    const existing = await prisma.adPlacement.findUnique({ where: { key }, select: { id: true, rateCents: true } });
    if (!existing) throw errors.notFound('Placement not found');
    if (body.rateVisibility === 'public' && (body.rateCents ?? existing.rateCents) === null) {
      throw errors.badRequest('Set a rate before publishing it');
    }
    await prisma.adPlacement.update({ where: { key }, data: body });
    await writeAudit(prisma, req, {
      action: 'advertising.placement.update',
      actorId: getAuth(req).user.id,
      targetType: 'ad_placement',
      targetId: existing.id,
      metadata: { fields: Object.keys(body) },
    });
    res.status(204).end();
  });

  // ───── Campaigns ─────
  router.get('/campaigns', requirePermission('ads.manage'), async (req, res) => {
    const q = validate(adminCampaignListQuerySchema, req.query, 'query');
    const where: Prisma.CampaignWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.advertiserId ? { advertiserId: q.advertiserId } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: campaignInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.campaign.count({ where }),
    ]);
    const response: CampaignListResponse = { items: rows.map(toCampaign), page: q.page, pageSize: q.pageSize, total };
    res.json(response);
  });

  router.get('/campaigns/:id', requirePermission('ads.manage'), async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    res.json(toCampaign(await loadCampaign(prisma, id)));
  });

  router.post('/campaigns', requirePermission('ads.manage'), async (req, res) => {
    const body = validate(campaignInputSchema, req.body, 'body');
    const advertiser = await prisma.advertiser.findUnique({ where: { id: body.advertiserId }, select: { status: true } });
    if (!advertiser) throw errors.badRequest('Advertiser not found');
    if (advertiser.status === 'suspended') throw errors.conflict('This advertiser is suspended');
    const placementIds = await resolvePlacementIds(prisma, body.placementKeys);
    const row = await prisma.campaign.create({
      data: {
        advertiserId: body.advertiserId,
        name: body.name,
        objective: body.objective ?? null,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        pricingModel: body.pricingModel,
        rateCents: body.rateCents,
        budgetCents: body.budgetCents,
        currency: body.currency,
        impressionGoal: body.impressionGoal ?? null,
        frequencyCapPerDay: body.frequencyCapPerDay ?? null,
        weight: body.weight,
        createdById: getAuth(req).user.id,
        placements: { create: placementIds.map((placementId) => ({ placementId })) },
      },
      include: campaignInclude,
    });
    await writeAudit(prisma, req, { action: 'advertising.campaign.create', actorId: getAuth(req).user.id, targetType: 'campaign', targetId: row.id });
    res.status(201).json(toCampaign(row));
  });

  router.put('/campaigns/:id', requirePermission('ads.manage'), async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const body = validate(campaignInputSchema, req.body, 'body');
    const existing = await loadCampaign(prisma, id);
    if (!EDITABLE_CAMPAIGN_STATUSES.has(existing.status)) {
      throw errors.conflict(`A campaign that is ${existing.status.replace('_', ' ')} cannot be edited; pause it first`);
    }
    const placementIds = await resolvePlacementIds(prisma, body.placementKeys);
    const row = await prisma.$transaction(async (tx) => {
      await tx.campaignPlacement.deleteMany({ where: { campaignId: id } });
      return tx.campaign.update({
        where: { id },
        data: {
          advertiserId: body.advertiserId,
          name: body.name,
          objective: body.objective ?? null,
          startsAt: new Date(body.startsAt),
          endsAt: new Date(body.endsAt),
          pricingModel: body.pricingModel,
          rateCents: body.rateCents,
          budgetCents: body.budgetCents,
          currency: body.currency,
          impressionGoal: body.impressionGoal ?? null,
          frequencyCapPerDay: body.frequencyCapPerDay ?? null,
          weight: body.weight,
          // Edits to a paused or rejected campaign need a fresh review before serving again.
          status: 'draft',
          reviewedById: null,
          reviewedAt: null,
          placements: { create: placementIds.map((placementId) => ({ placementId })) },
        },
        include: campaignInclude,
      });
    });
    await writeAudit(prisma, req, { action: 'advertising.campaign.update', actorId: getAuth(req).user.id, targetType: 'campaign', targetId: id });
    res.json(toCampaign(row));
  });

  router.post('/campaigns/:id/submit', requirePermission('ads.manage'), async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const campaign = await loadCampaign(prisma, id);
    if (campaign.status !== 'draft' && campaign.status !== 'rejected') {
      throw errors.conflict('Only draft or rejected campaigns can be submitted');
    }
    if (campaign.creatives.length === 0) throw errors.badRequest('Add at least one creative before submitting');
    await prisma.$transaction([
      prisma.campaign.update({ where: { id }, data: { status: 'in_review', submittedAt: new Date(), rejectionReason: null } }),
      prisma.creativeAsset.updateMany({ where: { campaignId: id, reviewStatus: { in: ['draft', 'rejected'] } }, data: { reviewStatus: 'review' } }),
    ]);
    await writeAudit(prisma, req, { action: 'advertising.campaign.submit', actorId: getAuth(req).user.id, targetType: 'campaign', targetId: id });
    res.json(toCampaign(await loadCampaign(prisma, id)));
  });

  router.post('/campaigns/:id/review', requirePermission('ads.approve'), async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const decision = validate(reviewDecisionSchema, req.body, 'body');
    const campaign = await loadCampaign(prisma, id);
    if (campaign.status !== 'in_review') throw errors.conflict('This campaign is not awaiting review');
    assertIndependentReviewer(req, campaign.createdById);
    const reviewer = getAuth(req).user.id;

    if (decision.decision === 'approve') {
      if (campaign.advertiser.status !== 'approved') throw errors.conflict('Approve the advertiser before approving its campaign');
      if (!campaign.creatives.some((c) => c.reviewStatus === 'approved')) {
        throw errors.conflict('Approve at least one creative before approving the campaign');
      }
      await prisma.campaign.update({ where: { id }, data: { status: 'approved', reviewedById: reviewer, reviewedAt: new Date(), rejectionReason: null } });
    } else {
      await prisma.campaign.update({
        where: { id },
        data: { status: 'rejected', reviewedById: reviewer, reviewedAt: new Date(), rejectionReason: decision.notes },
      });
    }
    await writeAudit(prisma, req, {
      action: `advertising.campaign.${decision.decision}`,
      actorId: reviewer,
      targetType: 'campaign',
      targetId: id,
    });
    res.json(toCampaign(await loadCampaign(prisma, id)));
  });

  router.post('/campaigns/:id/pause', requirePermission('ads.manage'), async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const campaign = await loadCampaign(prisma, id);
    if (campaign.status !== 'approved') throw errors.conflict('Only approved campaigns can be paused');
    await prisma.campaign.update({ where: { id }, data: { status: 'paused' } });
    await writeAudit(prisma, req, { action: 'advertising.campaign.pause', actorId: getAuth(req).user.id, targetType: 'campaign', targetId: id });
    res.json(toCampaign(await loadCampaign(prisma, id)));
  });

  /** Resuming an unchanged paused campaign keeps its approval; edits reset it to draft (see PUT). */
  router.post('/campaigns/:id/resume', requirePermission('ads.manage'), async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const campaign = await loadCampaign(prisma, id);
    if (campaign.status !== 'paused' || !campaign.reviewedAt) throw errors.conflict('Only paused, previously approved campaigns can resume');
    await prisma.campaign.update({ where: { id }, data: { status: 'approved' } });
    await writeAudit(prisma, req, { action: 'advertising.campaign.resume', actorId: getAuth(req).user.id, targetType: 'campaign', targetId: id });
    res.json(toCampaign(await loadCampaign(prisma, id)));
  });

  router.get('/campaigns/:id/report', requirePermission('ads.manage'), async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const campaign = await loadCampaign(prisma, id);
    const [impressions, clicks, dailyImpressions, dailyClicks, byPlacementImpressions, byPlacementClicks, placements] = await Promise.all([
      prisma.adImpression.count({ where: { campaignId: id } }),
      prisma.adClick.count({ where: { campaignId: id } }),
      prisma.$queryRaw<Array<{ day: Date; n: bigint }>>`SELECT date_trunc('day', created_at) AS day, count(*)::bigint AS n FROM ad_impressions WHERE campaign_id = ${id} GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<Array<{ day: Date; n: bigint }>>`SELECT date_trunc('day', created_at) AS day, count(*)::bigint AS n FROM ad_clicks WHERE campaign_id = ${id} GROUP BY 1 ORDER BY 1`,
      prisma.adImpression.groupBy({ by: ['placementId'], where: { campaignId: id }, _count: { _all: true } }),
      prisma.adClick.groupBy({ by: ['placementId'], where: { campaignId: id }, _count: { _all: true } }),
      prisma.adPlacement.findMany({ select: { id: true, key: true } }),
    ]);

    const days = new Map<string, { impressions: number; clicks: number }>();
    for (const r of dailyImpressions) days.set(r.day.toISOString().slice(0, 10), { impressions: Number(r.n), clicks: 0 });
    for (const r of dailyClicks) {
      const key = r.day.toISOString().slice(0, 10);
      days.set(key, { impressions: days.get(key)?.impressions ?? 0, clicks: Number(r.n) });
    }
    const keyFor = new Map(placements.map((p) => [p.id, p.key as PlacementKey]));
    const perPlacement = new Map<string, { impressions: number; clicks: number }>();
    for (const r of byPlacementImpressions) perPlacement.set(r.placementId, { impressions: r._count._all, clicks: 0 });
    for (const r of byPlacementClicks) {
      perPlacement.set(r.placementId, { impressions: perPlacement.get(r.placementId)?.impressions ?? 0, clicks: r._count._all });
    }

    const response: CampaignReport = {
      campaignId: id,
      impressions,
      clicks,
      ctr: impressions === 0 ? 0 : clicks / impressions,
      estimatedSpendCents: impressions === 0 && campaign.pricingModel === 'cpm' ? 0 : estimateSpendCents(campaign.pricingModel, campaign.rateCents, campaign.budgetCents, impressions),
      currency: campaign.currency,
      daily: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
      byPlacement: [...perPlacement.entries()]
        .filter(([placementId]) => keyFor.has(placementId))
        .map(([placementId, v]) => ({ placementKey: keyFor.get(placementId)!, ...v })),
    };
    res.json(response);
  });

  // ───── Creatives ─────
  router.post('/campaigns/:id/creatives', requirePermission('ads.manage'), async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const body = validate(creativeInputSchema, req.body, 'body');
    const campaign = await prisma.campaign.findUnique({ where: { id }, select: { status: true } });
    if (!campaign) throw errors.notFound('Campaign not found');
    if (campaign.status === 'completed') throw errors.conflict('Completed campaigns cannot take new creatives');
    const row = await prisma.creativeAsset.create({
      data: {
        campaignId: id,
        kind: body.kind,
        headline: body.headline,
        body: body.body ?? null,
        imageUrl: body.imageUrl ?? null,
        altText: body.altText ?? null,
        ctaLabel: body.ctaLabel ?? 'Learn more',
        clickUrl: body.clickUrl,
        disclosureLabel: body.disclosureLabel ?? 'Sponsored',
        reviewStatus: campaign.status === 'draft' ? 'draft' : 'review',
        policyFlags: scanCreativePolicy([body.headline, body.body, body.ctaLabel]),
      },
    });
    await writeAudit(prisma, req, {
      action: 'advertising.creative.create',
      actorId: getAuth(req).user.id,
      targetType: 'creative',
      targetId: row.id,
      metadata: { policyFlags: row.policyFlags },
    });
    res.status(201).json(toCreative(row));
  });

  router.put('/creatives/:id', requirePermission('ads.manage'), async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const body = validate(creativeInputSchema, req.body, 'body');
    const existing = await prisma.creativeAsset.findUnique({ where: { id }, include: { campaign: { select: { status: true } } } });
    if (!existing) throw errors.notFound('Creative not found');
    const row = await prisma.creativeAsset.update({
      where: { id },
      data: {
        kind: body.kind,
        headline: body.headline,
        body: body.body ?? null,
        imageUrl: body.imageUrl ?? null,
        altText: body.altText ?? null,
        ctaLabel: body.ctaLabel ?? 'Learn more',
        clickUrl: body.clickUrl,
        disclosureLabel: body.disclosureLabel ?? 'Sponsored',
        // Any edit takes the creative out of rotation until it is reviewed again.
        reviewStatus: existing.campaign.status === 'draft' ? 'draft' : 'review',
        reviewedById: null,
        reviewedAt: null,
        reviewNotes: null,
        policyFlags: scanCreativePolicy([body.headline, body.body, body.ctaLabel]),
      },
    });
    await writeAudit(prisma, req, { action: 'advertising.creative.update', actorId: getAuth(req).user.id, targetType: 'creative', targetId: id });
    res.json(toCreative(row));
  });

  router.post('/creatives/:id/review', requirePermission('ads.approve'), async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const decision = validate(reviewDecisionSchema, req.body, 'body');
    const creative = await prisma.creativeAsset.findUnique({ where: { id }, include: { campaign: { select: { createdById: true } } } });
    if (!creative) throw errors.notFound('Creative not found');
    if (creative.reviewStatus !== 'review') throw errors.conflict('This creative is not awaiting review');
    assertIndependentReviewer(req, creative.campaign.createdById);

    if (decision.decision === 'approve') {
      const unacknowledged = creative.policyFlags.filter((f) => !decision.acknowledgedFlags.includes(f));
      if (unacknowledged.length > 0) {
        throw errors.badRequest('Acknowledge every policy flag before approving', { unacknowledged });
      }
    }
    const row = await prisma.creativeAsset.update({
      where: { id },
      data: {
        reviewStatus: decision.decision === 'approve' ? 'approved' : 'rejected',
        reviewNotes: decision.notes ?? null,
        reviewedById: getAuth(req).user.id,
        reviewedAt: new Date(),
      },
    });
    await writeAudit(prisma, req, {
      action: `advertising.creative.${decision.decision}`,
      actorId: getAuth(req).user.id,
      targetType: 'creative',
      targetId: id,
      metadata: { policyFlags: creative.policyFlags },
    });
    res.json(toCreative(row));
  });

  router.get('/review-queue', requirePermission('ads.approve'), async (_req, res) => {
    const [campaigns, creatives] = await Promise.all([
      prisma.campaign.findMany({ where: { status: 'in_review' }, include: campaignInclude, orderBy: { submittedAt: 'asc' } }),
      prisma.creativeAsset.findMany({
        where: { reviewStatus: 'review' },
        include: { campaign: { select: { name: true, advertiser: { select: { name: true } } } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const response: ReviewQueueResponse = {
      campaigns: campaigns.map(toCampaign),
      creatives: creatives.map((c) => ({ ...toCreative(c), campaignName: c.campaign.name, advertiserName: c.campaign.advertiser.name })),
    };
    res.json(response);
  });

  return router;
}
