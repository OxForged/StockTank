import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DemoMarketDataProvider } from '@stocktank/market-data';
import { DEMO_MARKET_NOTICE, barsResponseSchema, moversResponseSchema, radarResponseSchema, stockDetailResponseSchema, stockListResponseSchema } from '@stocktank/types';
import { createTestContext, resetContent, resetDb, type TestContext } from './helpers.js';

describe('markets: stocks, movers, meme stock radar', () => {
  let ctx: TestContext;
  let sqzm: string;
  let steady: string;

  beforeAll(async () => {
    ctx = await createTestContext({ redis: false, marketData: new DemoMarketDataProvider(new Set(['SQZM']), () => Date.UTC(2026, 8, 17, 15)) });
  });
  beforeEach(async () => {
    await resetContent(ctx.prisma);
    await resetDb(ctx.prisma);
    sqzm = (await ctx.prisma.company.create({ data: { slug: 'squeeze-motors', name: 'Squeeze Motors', ticker: 'SQZM', exchange: 'DEMO', memeStock: true, status: 'published', isDemo: true } })).id;
    steady = (await ctx.prisma.company.create({ data: { slug: 'steady-co', name: 'Steady Co', ticker: 'STDY', exchange: 'DEMO', status: 'published', isDemo: true } })).id;
    await ctx.prisma.company.create({ data: { slug: 'draft-co', name: 'Draft Co', ticker: 'DRFT', status: 'draft' } });
    await ctx.prisma.company.create({ data: { slug: 'no-ticker', name: 'No Ticker', status: 'published' } });
  });
  afterAll(async () => {
    await resetContent(ctx.prisma);
    await resetDb(ctx.prisma);
    await ctx.close();
  });

  it('lists published stocks with quotes, sparklines and a DEMO notice', async () => {
    const list = stockListResponseSchema.parse((await request(ctx.app).get('/api/v1/markets/stocks')).body);
    // Alphabetical by company name; drafts and companies without tickers are excluded.
    expect(list.items.map((s) => s.symbol)).toEqual(['SQZM', 'STDY']);
    expect(list.items.every((s) => s.quote && s.quote.source === 'demo' && s.sparkline.length === 78)).toBe(true);
    expect(list).toMatchObject({ source: 'demo', demoNotice: DEMO_MARKET_NOTICE });
    expect(list.disclaimer).toMatch(/Not investment advice/);

    const movers = moversResponseSchema.parse((await request(ctx.app).get('/api/v1/markets/movers')).body);
    expect(movers.mostActive).toHaveLength(2);
    for (const s of movers.gainers) expect(s.quote!.changePercent).toBeGreaterThan(0);
    for (const s of movers.losers) expect(s.quote!.changePercent).toBeLessThan(0);
  });

  it('serves bars with stats, SMA and range validation', async () => {
    const bars = barsResponseSchema.parse((await request(ctx.app).get('/api/v1/markets/stocks/sqzm/bars?range=6M')).body);
    expect(bars).toMatchObject({ symbol: 'SQZM', range: '6M', source: 'demo' });
    expect(bars.bars).toHaveLength(126);
    expect(bars.sma20).toHaveLength(126);
    expect(bars.sma20[18]).toBeNull();
    expect(bars.sma20[19]).not.toBeNull();
    expect(bars.stats.high).toBeGreaterThanOrEqual(bars.stats.low!);
    expect((await request(ctx.app).get('/api/v1/markets/stocks/SQZM/bars?range=10Y')).status).toBe(400);
    expect((await request(ctx.app).get('/api/v1/markets/stocks/DRFT/bars')).status).toBe(404);
  });

  it('ranks the radar by first-party buzz, meme stocks first, with week-over-week change', async () => {
    const now = Date.now();
    const recent = new Date(now - 2 * 86_400_000);
    const lastWeek = new Date(now - 9 * 86_400_000);
    await ctx.prisma.analyticsEvent.createMany({
      data: [
        ...Array.from({ length: 6 }, (_, i) => ({ type: 'page_view' as const, visitorHash: `v${i}`, entityType: 'company', entityId: sqzm, occurredAt: recent })),
        { type: 'page_view', visitorHash: 'old', entityType: 'company', entityId: sqzm, occurredAt: lastWeek },
        { type: 'page_view', visitorHash: 'old2', entityType: 'company', entityId: sqzm, occurredAt: lastWeek },
        { type: 'search', visitorHash: 's1', query: 'sqzm', occurredAt: recent },
        { type: 'search', visitorHash: 's2', query: '$sqzm', occurredAt: recent },
        { type: 'search', visitorHash: 's3', query: 'steady co earnings', occurredAt: recent },
        { type: 'page_view', visitorHash: 'x', entityType: 'company', entityId: steady, occurredAt: recent },
      ],
    });
    const radar = radarResponseSchema.parse((await request(ctx.app).get('/api/v1/markets/radar')).body);
    expect(radar.methodology).toMatch(/not market sentiment/);
    const [first, second] = radar.items;
    expect(first).toMatchObject({ symbol: 'SQZM', memeStock: true, buzzScore: 100, signals: { pageViews: 6, searches: 2, follows: 0, mentions: 0 } });
    // current 6 + 2*2 = 10 vs previous 2 → +400%
    expect(first!.buzzChange).toBe(400);
    expect(second).toMatchObject({ symbol: 'STDY', signals: { pageViews: 1, searches: 1 }, buzzChange: null });
    expect(second!.buzzScore).toBe(30);
  });

  it('returns a stock page with buzz timeline, related episodes and disclaimers', async () => {
    const show = await ctx.prisma.show.create({ data: { slug: 's', title: 'Meme Hour', status: 'published' } });
    const ep = await ctx.prisma.episode.create({ data: { showId: show.id, slug: 'e', title: 'The squeeze explained', status: 'published', publishedAt: new Date() } });
    await ctx.prisma.episodeCompany.create({ data: { episodeId: ep.id, companyId: sqzm } });
    const detail = stockDetailResponseSchema.parse((await request(ctx.app).get('/api/v1/markets/stocks/SQZM')).body);
    expect(detail.stock).toMatchObject({ symbol: 'SQZM', name: 'Squeeze Motors', memeStock: true });
    expect(detail.buzz.daily).toHaveLength(30);
    expect(detail.buzz.signals.mentions).toBe(1);
    expect(detail.episodes.map((e) => e.title)).toEqual(['The squeeze explained']);
    expect(detail.demoNotice).toBe(DEMO_MARKET_NOTICE);
    expect((await request(ctx.app).get('/api/v1/markets/stocks/NOPE')).status).toBe(404);
  });
});
