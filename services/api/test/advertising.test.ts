import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@stocktank/database';
import { mediaKitResponseSchema, serveAdResponseSchema } from '@stocktank/types';
import { estimateSpendCents, scanCreativePolicy, signAdToken, verifyAdToken } from '../src/lib/ads.js';
import { MemoryEmailProvider } from '../src/lib/email.js';
import { CSRF_HEADERS, createTestContext, resetAdvertising, resetDb, setFlag, type TestContext } from './helpers.js';

const SECRET = 'x'.repeat(48);

describe('ad policy scanner', () => {
  it('flags unsupported financial claims', () => {
    expect(scanCreativePolicy(['Guaranteed returns every month'])).toContain('guaranteed_returns');
    expect(scanCreativePolicy(['A risk-free way to earn'])).toContain('risk_free_claim');
    expect(scanCreativePolicy(['This token will 100x'])).toContain('multiplier_hype');
    expect(scanCreativePolicy(['Earn 45% APY'])).toContain('return_percentage_claim');
    expect(scanCreativePolicy(['Act now, last chance'])).toContain('urgency_pressure');
    expect(scanCreativePolicy(['Recommended by StockTank'])).toContain('endorsement_claim');
  });

  it('passes neutral copy', () => {
    expect(scanCreativePolicy(['Custody infrastructure for tokenized funds', 'Learn how settlement works'])).toEqual([]);
  });
});

describe('ad tokens and spend', () => {
  const payload = { i: 'imp_1234567890', c: 'c', r: 'r', p: 'p', v: null, u: null, path: '/', exp: Math.floor(Date.now() / 1000) + 60 };

  it('verifies a signed token and rejects tampering or expiry', () => {
    const token = signAdToken(SECRET, payload);
    expect(verifyAdToken(SECRET, token)?.i).toBe(payload.i);
    const [body, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...payload, c: 'other' })).toString('base64url');
    expect(verifyAdToken(SECRET, `${forged}.${sig}`)).toBeNull();
    expect(verifyAdToken('y'.repeat(48), token)).toBeNull();
    expect(verifyAdToken(SECRET, `${body}.${sig}.extra`)).toBeNull();
    expect(verifyAdToken(SECRET, signAdToken(SECRET, { ...payload, exp: 1 }))).toBeNull();
  });

  it('estimates CPM spend capped at budget and flat spend as the rate', () => {
    expect(estimateSpendCents('cpm', 2_500, 1_000_000, 4_000)).toBe(10_000);
    expect(estimateSpendCents('cpm', 2_500, 5_000, 4_000)).toBe(5_000);
    expect(estimateSpendCents('flat_week', 300_000, 300_000, 0)).toBe(300_000);
  });
});

interface FixtureOptions {
  house?: boolean;
  campaignStatus?: 'approved' | 'draft' | 'paused';
  advertiserStatus?: 'approved' | 'pending_review';
  creativeStatus?: 'approved' | 'review';
  startsInMs?: number;
  pricingModel?: 'cpm' | 'flat_week';
  rateCents?: number;
  budgetCents?: number;
  frequencyCapPerDay?: number | null;
  name?: string;
  clickUrl?: string;
}

async function ensurePlacement(prisma: PrismaClient, key = 'home_native_feed') {
  return prisma.adPlacement.upsert({
    where: { key },
    update: {},
    create: { key, name: key, description: 'd', surface: 'web', format: 'native_card', specs: 's', pricingModel: 'cpm' },
  });
}

async function createFixture(prisma: PrismaClient, o: FixtureOptions = {}) {
  const placement = await ensurePlacement(prisma);
  const name = o.name ?? `Advertiser ${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  return prisma.campaign.create({
    data: {
      name: `${name} campaign`,
      status: o.campaignStatus ?? 'approved',
      startsAt: new Date(now + (o.startsInMs ?? -60_000)),
      endsAt: new Date(now + 86_400_000),
      pricingModel: o.pricingModel ?? 'flat_week',
      rateCents: o.rateCents ?? 100_000,
      budgetCents: o.budgetCents ?? 100_000,
      frequencyCapPerDay: o.frequencyCapPerDay ?? null,
      reviewedAt: new Date(),
      advertiser: {
        create: { name, slug: name.toLowerCase().replace(/\s+/g, '-'), status: o.advertiserStatus ?? 'approved', isHouse: o.house ?? false },
      },
      placements: { create: { placementId: placement.id } },
      creatives: {
        create: {
          kind: 'native',
          headline: `${name} headline`,
          clickUrl: o.clickUrl ?? 'https://example.com/landing',
          reviewStatus: o.creativeStatus ?? 'approved',
        },
      },
    },
    include: { creatives: true },
  });
}

describe('ad serving and tracking', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  beforeEach(async () => {
    await resetAdvertising(ctx.prisma);
    await setFlag(ctx.prisma, 'advertising', true);
    // Only this suite's keys: the Redis instance may be shared with local development.
    const keys = (await ctx.redis?.keys('adfc:*')) ?? [];
    if (keys.length > 0) await ctx.redis?.del(...keys);
  });
  afterAll(async () => {
    await resetAdvertising(ctx.prisma);
    await setFlag(ctx.prisma, 'advertising', false);
    await ctx.close();
  });

  const serve = () => request(ctx.app).get('/api/v1/ads/serve').query({ placement: 'home_native_feed', path: '/' });

  it('serves nothing while the advertising flag is off', async () => {
    await createFixture(ctx.prisma);
    await setFlag(ctx.prisma, 'advertising', false);
    const body = serveAdResponseSchema.parse((await serve()).body);
    expect(body.ad).toBeNull();
  });

  it('serves an approved, in-flight ad with disclosure, tracking URLs and a first-party visitor cookie', async () => {
    await createFixture(ctx.prisma, { name: 'Acme Custody' });
    const res = await serve();
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    const { ad } = serveAdResponseSchema.parse(res.body);
    expect(ad?.advertiserName).toBe('Acme Custody');
    expect(ad?.disclosureLabel).toBe('Sponsored');
    expect(ad?.clickUrl).toMatch(/^\/api\/v1\/ads\/click\//);
    expect(ad?.clickUrl).not.toContain('example.com');
    expect(String(res.headers['set-cookie'])).toMatch(/st_vid=.*HttpOnly/);
  });

  it.each([
    ['draft campaign', { campaignStatus: 'draft' as const }],
    ['paused campaign', { campaignStatus: 'paused' as const }],
    ['unapproved advertiser', { advertiserStatus: 'pending_review' as const }],
    ['creative still in review', { creativeStatus: 'review' as const }],
    ['campaign not started', { startsInMs: 3_600_000 }],
    ['CPM budget exhausted', { pricingModel: 'cpm' as const, rateCents: 1_000_000, budgetCents: 0 }],
  ])('never serves a %s', async (_label, options) => {
    await createFixture(ctx.prisma, options);
    const { ad } = serveAdResponseSchema.parse((await serve()).body);
    expect(ad).toBeNull();
  });

  it('prefers paid campaigns over house campaigns', async () => {
    await createFixture(ctx.prisma, { name: 'House', house: true });
    await createFixture(ctx.prisma, { name: 'Paying Sponsor' });
    for (let i = 0; i < 5; i++) {
      const { ad } = serveAdResponseSchema.parse((await serve()).body);
      expect(ad?.advertiserName).toBe('Paying Sponsor');
    }
  });

  it('records each impression once and rejects forged tokens', async () => {
    const campaign = await createFixture(ctx.prisma);
    const { ad } = serveAdResponseSchema.parse((await serve()).body);
    const token = ad!.impressionToken;

    const first = await request(ctx.app).post('/api/v1/ads/impressions').set(CSRF_HEADERS).send({ token });
    const again = await request(ctx.app).post('/api/v1/ads/impressions').set(CSRF_HEADERS).send({ token });
    expect(first.status).toBe(204);
    expect(again.status).toBe(204);
    expect(await ctx.prisma.adImpression.count({ where: { campaignId: campaign.id } })).toBe(1);

    const forged = await request(ctx.app).post('/api/v1/ads/impressions').set(CSRF_HEADERS).send({ token: `${token}x` });
    expect(forged.status).toBe(400);
  });

  it('redirects clicks only to the stored destination and records them', async () => {
    const campaign = await createFixture(ctx.prisma, { clickUrl: 'https://advertiser.example/offer' });
    const { ad } = serveAdResponseSchema.parse((await serve()).body);
    const res = await request(ctx.app).get(ad!.clickUrl);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://advertiser.example/offer');
    expect(await ctx.prisma.adClick.count({ where: { campaignId: campaign.id } })).toBe(1);

    const bad = await request(ctx.app).get('/api/v1/ads/click/not-a-valid-token-at-all');
    expect(bad.status).toBe(404);
  });

  it('enforces the per-visitor daily frequency cap', async () => {
    if (!ctx.redis) return;
    await createFixture(ctx.prisma, { frequencyCapPerDay: 1 });
    const agent = request.agent(ctx.app);
    const firstServe = await agent.get('/api/v1/ads/serve').query({ placement: 'home_native_feed' });
    const { ad } = serveAdResponseSchema.parse(firstServe.body);
    expect(ad).not.toBeNull();
    await agent.post('/api/v1/ads/impressions').set(CSRF_HEADERS).send({ token: ad!.impressionToken });

    const second = serveAdResponseSchema.parse((await agent.get('/api/v1/ads/serve').query({ placement: 'home_native_feed' })).body);
    expect(second.ad).toBeNull();
  });

  it('publishes rates in the media kit only when sales made them public', async () => {
    await ctx.prisma.adPlacement.create({
      data: { key: 'home_leaderboard', name: 'Public', description: 'd', surface: 'web', format: 'leaderboard', specs: 's', pricingModel: 'cpm', rateCents: 2_500, rateVisibility: 'public' },
    });
    await ctx.prisma.adPlacement.create({
      data: { key: 'watchlist_sidebar', name: 'Private', description: 'd', surface: 'web', format: 'sidebar_card', specs: 's', pricingModel: 'cpm', rateCents: 9_900, rateVisibility: 'on_request' },
    });
    const body = mediaKitResponseSchema.parse((await request(ctx.app).get('/api/v1/advertising/media-kit')).body);
    expect(body.placements.find((p) => p.key === 'home_leaderboard')?.rateCents).toBe(2_500);
    expect(body.placements.find((p) => p.key === 'watchlist_sidebar')?.rateCents).toBeNull();
    expect(body.advertisingLive).toBe(true);
  });
});

describe('advertising inquiries', () => {
  let ctx: TestContext;
  const email = new MemoryEmailProvider();
  const valid = {
    company: 'Acme Custody',
    contactName: 'Pat Doe',
    email: 'Pat@Acme.example',
    budgetRange: 'from_5k_to_25k',
    placementKeys: ['home_native_feed', 'newsletter_primary'],
    message: 'We would like to sponsor the RWA Report next quarter.',
    consent: true,
    utm: { source: 'x', medium: 'social', campaign: 'launch' },
  };

  beforeAll(async () => {
    ctx = await createTestContext({ redis: false, email, envOverrides: { SALES_NOTIFY_EMAIL: 'sales@stocktank.example' } });
  });
  beforeEach(async () => {
    await resetAdvertising(ctx.prisma);
    await resetDb(ctx.prisma);
    email.sent.length = 0;
  });
  afterAll(async () => {
    await resetAdvertising(ctx.prisma);
    await ctx.close();
  });

  it('stores a lead with attribution and notifies sales', async () => {
    const res = await request(ctx.app).post('/api/v1/advertising/inquiries').set(CSRF_HEADERS).send(valid);
    expect(res.status).toBe(202);
    const row = await ctx.prisma.advertisingInquiry.findFirstOrThrow();
    expect(row.email).toBe('pat@acme.example');
    expect(row.utmCampaign).toBe('launch');
    expect(row.status).toBe('new');
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]?.to).toBe('sales@stocktank.example');
    expect(await ctx.prisma.auditLog.count({ where: { action: 'advertising.inquiry.create' } })).toBe(1);
  });

  it('silently discards honeypot submissions', async () => {
    const res = await request(ctx.app).post('/api/v1/advertising/inquiries').set(CSRF_HEADERS).send({ ...valid, companyFax: 'spam' });
    expect(res.status).toBe(202);
    expect(await ctx.prisma.advertisingInquiry.count()).toBe(0);
    expect(email.sent).toHaveLength(0);
  });

  it('requires consent and valid fields', async () => {
    const res = await request(ctx.app).post('/api/v1/advertising/inquiries').set(CSRF_HEADERS).send({ ...valid, consent: false, email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
