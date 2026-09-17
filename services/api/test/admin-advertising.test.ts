import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  advertisingOverviewSchema,
  campaignReportSchema,
  campaignSchema,
  creativeSchema,
  inquiryListResponseSchema,
  reviewQueueResponseSchema,
  serveAdResponseSchema,
  subscriberListResponseSchema,
} from '@stocktank/types';
import { CSRF_HEADERS, createTestContext, loginAs, resetAdvertising, resetDb, seedUser, setFlag, type TestContext } from './helpers.js';

describe('admin advertising workflow', () => {
  let ctx: TestContext;
  let sales: string;
  let editor: string;
  let admin: string;
  let viewer: string;

  beforeAll(async () => {
    ctx = await createTestContext({ redis: false });
  });
  beforeEach(async () => {
    await resetAdvertising(ctx.prisma);
    await resetDb(ctx.prisma);
    await setFlag(ctx.prisma, 'advertising', true);
    await ctx.prisma.adPlacement.create({
      data: { key: 'home_native_feed', name: 'Native', description: 'd', surface: 'web', format: 'native_card', specs: 's', pricingModel: 'cpm' },
    });
    await seedUser(ctx.prisma, { email: 'sales@example.com', roles: ['sales'] });
    await seedUser(ctx.prisma, { email: 'editor@example.com', roles: ['editor'] });
    await seedUser(ctx.prisma, { email: 'admin@example.com', roles: ['admin'] });
    await seedUser(ctx.prisma, { email: 'viewer@example.com', roles: ['viewer'] });
    sales = await loginAs(ctx.app, 'sales@example.com');
    editor = await loginAs(ctx.app, 'editor@example.com');
    admin = await loginAs(ctx.app, 'admin@example.com');
    viewer = await loginAs(ctx.app, 'viewer@example.com');
  });
  afterAll(async () => {
    await resetAdvertising(ctx.prisma);
    await resetDb(ctx.prisma);
    await setFlag(ctx.prisma, 'advertising', false);
    await ctx.close();
  });

  const as = (cookie: string) => ({
    get: (url: string) => request(ctx.app).get(url).set('Cookie', cookie),
    post: (url: string, body?: object) => request(ctx.app).post(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body ?? {}),
    put: (url: string, body: object) => request(ctx.app).put(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body),
    patch: (url: string, body: object) => request(ctx.app).patch(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body),
  });
  const A = '/api/v1/admin/advertising';

  const campaignBody = (advertiserId: string) => ({
    advertiserId,
    name: 'Q4 custody launch',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    pricingModel: 'cpm',
    rateCents: 2_500,
    budgetCents: 500_000,
    placementKeys: ['home_native_feed'],
  });

  async function draftCampaignWithCreative(headline = 'Custody built for tokenized funds') {
    const adv = await as(sales).post(`${A}/advertisers`, { name: 'Acme Custody', website: 'https://acme.example' });
    expect(adv.status).toBe(201);
    const campaign = campaignSchema.parse((await as(sales).post(`${A}/campaigns`, campaignBody(adv.body.id))).body);
    const creative = await as(sales).post(`${A}/campaigns/${campaign.id}/creatives`, {
      kind: 'native',
      headline,
      body: 'See how settlement works.',
      clickUrl: 'https://acme.example/custody',
    });
    expect(creative.status).toBe(201);
    return { advertiserId: adv.body.id as string, campaign, creative: creativeSchema.parse(creative.body) };
  }

  it('runs the full sales → editor → live → report flow', async () => {
    const { advertiserId, campaign, creative } = await draftCampaignWithCreative();
    expect(creative.reviewStatus).toBe('draft');

    // Sales cannot approve anything.
    expect((await as(sales).put(`${A}/advertisers/${advertiserId}/status`, { status: 'approved' })).status).toBe(403);

    const submitted = await as(sales).post(`${A}/campaigns/${campaign.id}/submit`);
    expect(submitted.status).toBe(200);
    expect(campaignSchema.parse(submitted.body).status).toBe('in_review');

    const queue = reviewQueueResponseSchema.parse((await as(editor).get(`${A}/review-queue`)).body);
    expect(queue.campaigns).toHaveLength(1);
    expect(queue.creatives).toHaveLength(1);

    // Campaign approval needs an approved advertiser and creative first.
    expect((await as(editor).post(`${A}/campaigns/${campaign.id}/review`, { decision: 'approve' })).status).toBe(409);
    expect((await as(editor).put(`${A}/advertisers/${advertiserId}/status`, { status: 'approved' })).status).toBe(204);
    expect((await as(editor).post(`${A}/creatives/${creative.id}/review`, { decision: 'approve' })).status).toBe(200);
    const approved = await as(editor).post(`${A}/campaigns/${campaign.id}/review`, { decision: 'approve', notes: 'Clean copy' });
    expect(campaignSchema.parse(approved.body).status).toBe('approved');

    const served = serveAdResponseSchema.parse((await request(ctx.app).get('/api/v1/ads/serve').query({ placement: 'home_native_feed' })).body);
    expect(served.ad?.advertiserName).toBe('Acme Custody');
    await request(ctx.app).post('/api/v1/ads/impressions').set(CSRF_HEADERS).send({ token: served.ad!.impressionToken });
    await request(ctx.app).get(served.ad!.clickUrl);

    const report = campaignReportSchema.parse((await as(sales).get(`${A}/campaigns/${campaign.id}/report`)).body);
    expect(report.impressions).toBe(1);
    expect(report.clicks).toBe(1);
    expect(report.ctr).toBe(1);
    expect(report.byPlacement).toEqual([{ placementKey: 'home_native_feed', impressions: 1, clicks: 1 }]);
    expect(report.daily).toHaveLength(1);

    const overview = advertisingOverviewSchema.parse((await as(admin).get(`${A}/overview`)).body);
    expect(overview.activeCampaigns).toBe(1);
    expect(overview.advertisingLive).toBe(true);
    expect(overview.impressionsLast7d).toBe(1);
    expect(overview.clicksLast7d).toBe(1);
    expect(overview.impressionsPrior7d).toBe(0);
    expect(overview.daily).toHaveLength(14);
    expect(overview.daily.map((d) => d.date)).toEqual([...overview.daily.map((d) => d.date)].sort());
    expect(overview.daily.at(-1)).toEqual({ date: new Date().toISOString().slice(0, 10), impressions: 1, clicks: 1 });
    expect(overview.daily.reduce((s, d) => s + d.impressions, 0)).toBe(1);

    expect(await ctx.prisma.auditLog.count({ where: { action: { startsWith: 'advertising.' } } })).toBeGreaterThanOrEqual(6);
  });

  it('requires reviewers to acknowledge every policy flag', async () => {
    const { campaign, creative } = await draftCampaignWithCreative('Guaranteed returns with zero risk');
    expect(creative.policyFlags).toEqual(expect.arrayContaining(['guaranteed_returns', 'risk_free_claim']));
    await as(sales).post(`${A}/campaigns/${campaign.id}/submit`);

    const missing = await as(editor).post(`${A}/creatives/${creative.id}/review`, { decision: 'approve', acknowledgedFlags: ['guaranteed_returns'] });
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.unacknowledged).toEqual(['risk_free_claim']);

    const rejected = await as(editor).post(`${A}/creatives/${creative.id}/review`, { decision: 'reject', notes: 'Unsupported return claim' });
    expect(creativeSchema.parse(rejected.body).reviewStatus).toBe('rejected');
  });

  it('stops the creator of a campaign from reviewing it', async () => {
    const adv = await as(editor).post(`${A}/advertisers`, { name: 'Self Review Co' });
    expect(adv.status).toBe(403); // editors cannot create advertisers (ads.manage)

    await ctx.prisma.role.update({
      where: { key: 'editor' },
      data: { permissions: { create: { permission: { connect: { key: 'ads.manage' } } } } },
    });
    try {
      const created = await as(editor).post(`${A}/advertisers`, { name: 'Self Review Co' });
      const campaign = campaignSchema.parse((await as(editor).post(`${A}/campaigns`, campaignBody(created.body.id))).body);
      await as(editor).post(`${A}/campaigns/${campaign.id}/creatives`, { kind: 'native', headline: 'Neutral headline', clickUrl: 'https://self.example' });
      await as(editor).post(`${A}/campaigns/${campaign.id}/submit`);
      const own = await as(editor).post(`${A}/campaigns/${campaign.id}/review`, { decision: 'reject', notes: 'Self review attempt' });
      expect(own.status).toBe(403);
    } finally {
      const perm = await ctx.prisma.permission.findUniqueOrThrow({ where: { key: 'ads.manage' } });
      const role = await ctx.prisma.role.findUniqueOrThrow({ where: { key: 'editor' } });
      await ctx.prisma.rolePermission.delete({ where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } } });
    }
  });

  it('takes a paused campaign out of rotation and sends edits back to review', async () => {
    const { advertiserId, campaign, creative } = await draftCampaignWithCreative();
    await as(sales).post(`${A}/campaigns/${campaign.id}/submit`);
    await as(editor).put(`${A}/advertisers/${advertiserId}/status`, { status: 'approved' });
    await as(editor).post(`${A}/creatives/${creative.id}/review`, { decision: 'approve' });
    await as(editor).post(`${A}/campaigns/${campaign.id}/review`, { decision: 'approve' });

    expect((await as(sales).put(`${A}/campaigns/${campaign.id}`, campaignBody(advertiserId))).status).toBe(409);
    expect(campaignSchema.parse((await as(sales).post(`${A}/campaigns/${campaign.id}/pause`)).body).status).toBe('paused');
    const serveWhilePaused = serveAdResponseSchema.parse((await request(ctx.app).get('/api/v1/ads/serve').query({ placement: 'home_native_feed' })).body);
    expect(serveWhilePaused.ad).toBeNull();

    const edited = campaignSchema.parse((await as(sales).put(`${A}/campaigns/${campaign.id}`, { ...campaignBody(advertiserId), name: 'Renamed' })).body);
    expect(edited.status).toBe('draft');
    expect((await as(sales).post(`${A}/campaigns/${campaign.id}/resume`)).status).toBe(409);
  });

  it('manages the rate card and refuses to publish an unset rate', async () => {
    expect((await as(sales).patch(`${A}/placements/home_native_feed`, { rateVisibility: 'public' })).status).toBe(400);
    expect((await as(sales).patch(`${A}/placements/home_native_feed`, { rateCents: 3_000, rateVisibility: 'public' })).status).toBe(204);
    const list = await as(sales).get(`${A}/placements`);
    expect(list.body.items[0].rateCents).toBe(3_000);
    expect((await as(viewer).get(`${A}/placements`)).status).toBe(403);
  });

  it('lets sales work leads but not the newsletter audience', async () => {
    await request(ctx.app).post('/api/v1/advertising/inquiries').set(CSRF_HEADERS).send({
      company: 'Lead Co',
      contactName: 'Lee',
      email: 'lee@lead.example',
      budgetRange: 'undisclosed',
      message: 'Interested in the newsletter slot.',
      consent: true,
    });
    const leads = inquiryListResponseSchema.parse((await as(sales).get('/api/v1/admin/inquiries')).body);
    expect(leads.total).toBe(1);
    const updated = await as(sales).patch(`/api/v1/admin/inquiries/${leads.items[0]!.id}`, { status: 'contacted', notes: 'Sent media kit' });
    expect(updated.body.status).toBe('contacted');

    expect((await as(sales).get('/api/v1/admin/subscribers')).status).toBe(403);
    expect((await as(editor).get('/api/v1/admin/inquiries')).status).toBe(403);
  });

  it('exports only confirmed subscribers and neutralises spreadsheet formulas', async () => {
    const base = { consentAt: new Date(), unsubscribeTokenHash: '' };
    await ctx.prisma.newsletterSubscriber.createMany({
      data: [
        { ...base, email: 'ok@example.com', status: 'confirmed', confirmedAt: new Date(), source: '=HYPERLINK("x")', unsubscribeTokenHash: 'h1' },
        { ...base, email: 'pending@example.com', status: 'pending', unsubscribeTokenHash: 'h2' },
      ],
    });
    const list = subscriberListResponseSchema.parse((await as(admin).get('/api/v1/admin/subscribers')).body);
    expect(list.counts).toEqual({ pending: 1, confirmed: 1, unsubscribed: 0 });

    const csv = await as(admin).get('/api/v1/admin/subscribers/export.csv');
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('ok@example.com');
    expect(csv.text).not.toContain('pending@example.com');
    expect(csv.text).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('toggles feature flags with an audit trail', async () => {
    expect((await as(sales).put('/api/v1/admin/feature-flags/advertising', { enabled: false })).status).toBe(403);
    expect((await as(admin).put('/api/v1/admin/feature-flags/advertising', { enabled: false })).status).toBe(204);
    expect((await request(ctx.app).get('/api/v1/flags')).body.flags.advertising).toBe(false);
    expect((await as(admin).put('/api/v1/admin/feature-flags/does_not_exist', { enabled: true })).status).toBe(404);
    expect(await ctx.prisma.auditLog.count({ where: { action: 'feature_flag.update' } })).toBe(1);
  });
});
