import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { Prisma, PrismaClient } from '@stocktank/database';
import type { PlacementKey, PricingModel, ServedAd } from '@stocktank/types';
import { sha256Hex } from './crypto.js';

// ───────── Signed impression/click tokens ─────────

/** Impression tokens are valid for a day; clicks on an ad rendered earlier than that are not billed. */
export const AD_TOKEN_TTL_SECONDS = 24 * 60 * 60;

export interface AdTokenPayload {
  /** Impression id; recording is idempotent on it. */
  i: string;
  c: string;
  r: string;
  p: string;
  v: string | null;
  u: string | null;
  path: string | null;
  exp: number;
}

function tokenKey(secret: string): Buffer {
  // Domain-separated from session cookie signing, which uses the raw secret.
  return createHmac('sha256', secret).update('stocktank:ad-token:v1').digest();
}

export function signAdToken(secret: string, payload: AdTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', tokenKey(secret)).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyAdToken(secret: string, token: string, now = Date.now()): AdTokenPayload | null {
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) return null;
  const expected = createHmac('sha256', tokenKey(secret)).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let payload: AdTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AdTokenPayload;
  } catch {
    return null;
  }
  if (typeof payload.i !== 'string' || typeof payload.exp !== 'number' || payload.exp * 1000 < now) return null;
  return payload;
}

// ───────── Anonymous visitor id (first-party, no third-party tracking) ─────────

export const VISITOR_COOKIE = 'st_vid';
export const VISITOR_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export function newVisitorId(): string {
  return randomBytes(18).toString('base64url');
}

export function visitorHash(visitorId: string | undefined | null): string | null {
  return visitorId && /^[A-Za-z0-9_-]{16,64}$/.test(visitorId) ? sha256Hex(`visitor:${visitorId}`) : null;
}

// ───────── Advertising policy scanner (§27, §37: no unsupported financial claims) ─────────

const POLICY_RULES: ReadonlyArray<{ flag: string; pattern: RegExp }> = [
  { flag: 'guaranteed_returns', pattern: /\bguarantee(d|s)?\b[^.]{0,40}\b(return|profit|yield|gain|income|apy|apr)s?\b/i },
  { flag: 'risk_free_claim', pattern: /\b(risk[-\s]?free|no[-\s]risk|zero[-\s]risk|can(?:'|no)?t lose|cannot lose|safe investment)\b/i },
  { flag: 'multiplier_hype', pattern: /\b\d{2,5}\s?x\b|\bto the moon\b|\bmoonshot\b|\b(next|another) 100x\b/i },
  { flag: 'get_rich_claim', pattern: /\b(get rich|financial freedom|passive income|double your (money|crypto|investment)|life[-\s]changing (money|gains))\b/i },
  { flag: 'return_percentage_claim', pattern: /\b\d{2,4}(\.\d+)?\s?%\s?(apy|apr|return|returns|yield|profit|gains?)\b/i },
  { flag: 'price_prediction', pattern: /\b(will|going to) (hit|reach|pump|explode|10x|skyrocket)\b/i },
  { flag: 'urgency_pressure', pattern: /\b(last chance|act now|only \d+ (spots|hours|left)|before it'?s too late|fomo)\b/i },
  { flag: 'endorsement_claim', pattern: /\b(endorsed|recommended|approved) by stocktank\b/i },
];

/** Returns the policy flags raised by an ad's text. A reviewer must acknowledge each before approval. */
export function scanCreativePolicy(parts: ReadonlyArray<string | null | undefined>): string[] {
  const text = parts.filter(Boolean).join(' \n ');
  return POLICY_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.flag);
}

// ───────── Spend ─────────

export function estimateSpendCents(pricingModel: PricingModel, rateCents: number, budgetCents: number, impressions: number): number {
  const raw = pricingModel === 'cpm' ? Math.round((impressions / 1000) * rateCents) : rateCents;
  return Math.min(raw, budgetCents);
}

// ───────── Selection ─────────

const WEB_KINDS = ['display', 'native'] as const;

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function frequencyKey(campaignId: string, visitor: string, now: Date): string {
  return `adfc:${campaignId}:${visitor}:${utcDay(now)}`;
}

export interface SelectAdInput {
  placementKey: PlacementKey;
  visitorHash: string | null;
  now?: Date;
  random?: () => number;
}

export interface SelectedAd {
  campaignId: string;
  creativeId: string;
  placementId: string;
  ad: Omit<ServedAd, 'clickUrl' | 'impressionToken'>;
}

const eligibleCampaignInclude = {
  advertiser: { select: { name: true, status: true, isHouse: true } },
  creatives: {
    where: { reviewStatus: 'approved', kind: { in: [...WEB_KINDS] } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.CampaignInclude;

/**
 * Picks an eligible ad for a placement, or null.
 * Eligible = advertising flag on, placement active, campaign approved and in flight, advertiser approved,
 * at least one approved creative, budget/impression goal not exhausted, visitor under the frequency cap.
 * Paid campaigns always win over house campaigns; within a tier the pick is weighted by `weight`.
 */
export async function selectAd(
  prisma: PrismaClient,
  redis: Redis | null,
  logger: Logger,
  input: SelectAdInput,
): Promise<SelectedAd | null> {
  const now = input.now ?? new Date();
  const random = input.random ?? Math.random;

  const flag = await prisma.featureFlag.findUnique({ where: { key: 'advertising' }, select: { enabled: true } });
  if (!flag?.enabled) return null;

  const placement = await prisma.adPlacement.findUnique({ where: { key: input.placementKey } });
  if (!placement?.isActive) return null;

  const candidates = await prisma.campaign.findMany({
    where: {
      status: 'approved',
      startsAt: { lte: now },
      endsAt: { gte: now },
      advertiser: { status: 'approved' },
      placements: { some: { placementId: placement.id } },
      creatives: { some: { reviewStatus: 'approved', kind: { in: [...WEB_KINDS] } } },
    },
    include: eligibleCampaignInclude,
  });
  if (candidates.length === 0) return null;

  const impressionCounts = await prisma.adImpression.groupBy({
    by: ['campaignId'],
    where: { campaignId: { in: candidates.map((c) => c.id) } },
    _count: { _all: true },
  });
  const countFor = new Map(impressionCounts.map((row) => [row.campaignId, row._count._all]));

  const withinLimits = [];
  for (const campaign of candidates) {
    const impressions = countFor.get(campaign.id) ?? 0;
    if (campaign.impressionGoal !== null && impressions >= campaign.impressionGoal) continue;
    if (campaign.pricingModel === 'cpm' && estimateSpendCents('cpm', campaign.rateCents, campaign.budgetCents, impressions) >= campaign.budgetCents) {
      continue;
    }
    if (campaign.frequencyCapPerDay !== null && input.visitorHash && redis) {
      try {
        const seen = Number((await redis.get(frequencyKey(campaign.id, input.visitorHash, now))) ?? 0);
        if (seen >= campaign.frequencyCapPerDay) continue;
      } catch (err) {
        // Redis down: serve without the cap rather than failing the page; logged for ops.
        logger.warn({ err: { message: (err as Error).message } }, 'Frequency cap check skipped');
      }
    }
    withinLimits.push(campaign);
  }

  const paid = withinLimits.filter((c) => !c.advertiser.isHouse);
  const pool = paid.length > 0 ? paid : withinLimits;
  if (pool.length === 0) return null;

  const totalWeight = pool.reduce((sum, c) => sum + Math.max(1, c.weight), 0);
  let roll = random() * totalWeight;
  let chosen = pool[pool.length - 1]!;
  for (const campaign of pool) {
    roll -= Math.max(1, campaign.weight);
    if (roll < 0) {
      chosen = campaign;
      break;
    }
  }
  const creative = chosen.creatives[Math.floor(random() * chosen.creatives.length)] ?? chosen.creatives[0]!;

  return {
    campaignId: chosen.id,
    creativeId: creative.id,
    placementId: placement.id,
    ad: {
      placement: input.placementKey,
      kind: creative.kind,
      advertiserName: chosen.advertiser.name,
      headline: creative.headline,
      body: creative.body,
      imageUrl: creative.imageUrl,
      altText: creative.altText,
      ctaLabel: creative.ctaLabel,
      disclosureLabel: creative.disclosureLabel,
      isHouse: chosen.advertiser.isHouse,
    },
  };
}
