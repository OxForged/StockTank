import { Router } from 'express';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { z } from 'zod';
import type { PrismaClient } from '@stocktank/database';
import { normalizeSymbol, relativeVolume, sma, type MarketDataProvider, type Quote } from '@stocktank/market-data';
import {
  DEMO_MARKET_NOTICE,
  MARKET_DISCLAIMER,
  chartRangeSchema,
  type BarsResponse,
  type MoversResponse,
  type RadarItem,
  type RadarResponse,
  type StockDetailResponse,
  type StockListResponse,
  type StockSummary,
} from '@stocktank/types';
import { PUBLISHED, clipSelect, companySelect, episodeSelect, toClipSummary, toCompanySummary, toEpisodeSummary } from '../lib/content.js';
import { errors } from '../lib/errors.js';
import type { MediaService } from '../lib/media.js';
import { validate } from '../lib/validate.js';

export interface MarketsDeps {
  prisma: PrismaClient;
  redis: Redis | null;
  logger: Logger;
  provider: MarketDataProvider;
  media: Pick<MediaService, 'publicUrl'>;
}

const DAY_MS = 86_400_000;
const RADAR_WINDOW_DAYS = 7;
export const RADAR_METHODOLOGY =
  'Buzz measures StockTank audience activity over the last 7 days: page views, new follows, searches and episode mentions (weighted 1, 5, 2 and 8). It is not market sentiment or a trading signal.';

/** Small read-through cache (Redis when available). Market data calls are slow and rate limited. */
function makeCache(redis: Redis | null) {
  const memory = new Map<string, { at: number; value: unknown }>();
  return async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const k = `markets:${key}`;
    if (redis?.status === 'ready') {
      const hit = await redis.get(k).catch(() => null);
      if (hit) return JSON.parse(hit) as T;
      const value = await load();
      await redis.set(k, JSON.stringify(value), 'PX', ttlMs).catch(() => undefined);
      return value;
    }
    const hit = memory.get(k);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
    const value = await load();
    memory.set(k, { at: Date.now(), value });
    return value;
  };
}

export function marketsRouter({ prisma, redis, logger, provider, media }: MarketsDeps): Router {
  const router = Router();
  const cached = makeCache(redis);

  const trackedStocks = () =>
    prisma.company.findMany({
      where: { status: PUBLISHED, ticker: { not: null } },
      select: { id: true, slug: true, name: true, ticker: true, exchange: true, sector: true, memeStock: true, isDemo: true },
      orderBy: { name: 'asc' },
      take: 200,
    });

  const quotesFor = (symbols: string[]) =>
    cached(`quotes:${provider.source}:${[...symbols].sort().join(',')}`, 30_000, async () => {
      try {
        return await provider.getQuotes(symbols);
      } catch (err) {
        logger.warn({ err }, 'Market quotes unavailable');
        return [] as Quote[];
      }
    });

  const sparklineFor = (symbol: string) =>
    cached(`spark:${provider.source}:${symbol}`, 60_000, async () => {
      try {
        return (await provider.getBars(symbol, '1D')).map((b) => b.c);
      } catch {
        return [] as number[];
      }
    });

  const summaries = async (rows: Awaited<ReturnType<typeof trackedStocks>>): Promise<StockSummary[]> => {
    const symbols = rows.map((r) => normalizeSymbol(r.ticker!));
    const quotes = new Map((await quotesFor(symbols)).map((q) => [q.symbol, q]));
    return Promise.all(
      rows.map(async (r) => {
        const symbol = normalizeSymbol(r.ticker!);
        return {
          symbol,
          name: r.name,
          slug: r.slug,
          exchange: r.exchange,
          sector: r.sector,
          memeStock: r.memeStock,
          isDemo: r.isDemo,
          quote: quotes.get(symbol) ?? null,
          sparkline: await sparklineFor(symbol),
        };
      }),
    );
  };

  const demoNotice = (items: Array<{ isDemo: boolean }>) => (provider.source === 'demo' || items.some((i) => i.isDemo) ? DEMO_MARKET_NOTICE : null);

  router.get('/markets/stocks', async (_req, res) => {
    const items = await summaries(await trackedStocks());
    const response: StockListResponse = { items, source: provider.source, disclaimer: MARKET_DISCLAIMER, demoNotice: demoNotice(items) };
    res.set('Cache-Control', 'public, max-age=15');
    res.json(response);
  });

  router.get('/markets/movers', async (_req, res) => {
    const items = (await summaries(await trackedStocks())).filter((s) => s.quote);
    const by = (f: (s: StockSummary) => number) => [...items].sort((a, b) => f(b) - f(a));
    const response: MoversResponse = {
      gainers: by((s) => s.quote!.changePercent).filter((s) => s.quote!.changePercent > 0).slice(0, 5),
      losers: by((s) => -s.quote!.changePercent).filter((s) => s.quote!.changePercent < 0).slice(0, 5),
      mostActive: by((s) => s.quote!.volume).slice(0, 5),
      source: provider.source,
      demoNotice: demoNotice(items),
    };
    res.set('Cache-Control', 'public, max-age=15');
    res.json(response);
  });

  // Buzz signals come from StockTank's own first-party activity, never scraped social data.
  const buzzSignals = async (companyIds: string[], names: Map<string, { ticker: string; name: string }>, since: Date, until: Date) => {
    const [views, follows, mentions, searches] = await Promise.all([
      prisma.analyticsEvent.groupBy({ by: ['entityId'], where: { type: 'page_view', entityType: 'company', entityId: { in: companyIds }, occurredAt: { gte: since, lt: until } }, _count: { _all: true } }),
      prisma.follow.groupBy({ by: ['companyId'], where: { companyId: { in: companyIds }, createdAt: { gte: since, lt: until } }, _count: { _all: true } }),
      prisma.episodeCompany.groupBy({ by: ['companyId'], where: { companyId: { in: companyIds }, episode: { status: PUBLISHED, publishedAt: { gte: since, lt: until } } }, _count: { _all: true } }),
      prisma.analyticsEvent.findMany({ where: { type: 'search', query: { not: null }, occurredAt: { gte: since, lt: until } }, select: { query: true }, take: 20_000 }),
    ]);
    const viewMap = new Map(views.map((v) => [v.entityId, v._count._all]));
    const followMap = new Map(follows.map((f) => [f.companyId, f._count._all]));
    const mentionMap = new Map(mentions.map((m) => [m.companyId, m._count._all]));
    const result = new Map<string, { pageViews: number; follows: number; searches: number; mentions: number }>();
    for (const id of companyIds) {
      const n = names.get(id)!;
      const ticker = n.ticker.toLowerCase();
      const name = n.name.toLowerCase();
      const searchCount = searches.filter((s) => {
        const q = s.query!;
        return q === ticker || q === `$${ticker}` || q.includes(name);
      }).length;
      result.set(id, { pageViews: viewMap.get(id) ?? 0, follows: followMap.get(id) ?? 0, searches: searchCount, mentions: mentionMap.get(id) ?? 0 });
    }
    return result;
  };
  const score = (s: { pageViews: number; follows: number; searches: number; mentions: number }) => s.pageViews + s.follows * 5 + s.searches * 2 + s.mentions * 8;

  router.get('/markets/radar', async (_req, res) => {
    const response = await cached('radar', 30_000, async (): Promise<RadarResponse> => {
      const rows = await trackedStocks();
      const now = Date.now();
      const names = new Map(rows.map((r) => [r.id, { ticker: r.ticker!, name: r.name }]));
      const ids = rows.map((r) => r.id);
      const [current, previous, stocks] = await Promise.all([
        buzzSignals(ids, names, new Date(now - RADAR_WINDOW_DAYS * DAY_MS), new Date(now)),
        buzzSignals(ids, names, new Date(now - 2 * RADAR_WINDOW_DAYS * DAY_MS), new Date(now - RADAR_WINDOW_DAYS * DAY_MS)),
        summaries(rows),
      ]);
      const raw = rows.map((r) => score(current.get(r.id)!));
      const max = Math.max(1, ...raw);
      const items: RadarItem[] = rows.map((r, i) => {
        const cur = raw[i]!;
        const prev = score(previous.get(r.id)!);
        return {
          ...stocks[i]!,
          buzzScore: Math.round((cur / max) * 100),
          buzzChange: prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null,
          signals: current.get(r.id)!,
        };
      });
      // Meme stocks first, then by buzz, so the radar leads with what it is for.
      items.sort((a, b) => Number(b.memeStock) - Number(a.memeStock) || b.buzzScore - a.buzzScore || Math.abs(b.quote?.changePercent ?? 0) - Math.abs(a.quote?.changePercent ?? 0));
      return { windowDays: RADAR_WINDOW_DAYS, items, methodology: RADAR_METHODOLOGY, source: provider.source, demoNotice: demoNotice(items) };
    });
    res.set('Cache-Control', 'public, max-age=15');
    res.json(response);
  });

  const symbolParams = z.object({ symbol: z.string().min(1).max(12) });

  const findStock = async (raw: string) => {
    const symbol = normalizeSymbol(raw);
    const company = await prisma.company.findFirst({ where: { status: PUBLISHED, ticker: { equals: symbol, mode: 'insensitive' } }, select: { ...companySelect, memeStock: true, website: true } });
    if (!company) throw errors.notFound('Stock not found');
    return { symbol, company };
  };

  router.get('/markets/stocks/:symbol/bars', async (req, res) => {
    const { symbol: raw } = validate(symbolParams, req.params, 'params');
    const { range } = validate(z.object({ range: chartRangeSchema.default('1M') }), req.query, 'query');
    const { symbol } = await findStock(raw);
    const bars = await cached(`bars:${provider.source}:${symbol}:${range}`, range === '1D' || range === '5D' ? 60_000 : 300_000, () => provider.getBars(symbol, range)).catch((err: unknown) => {
      logger.warn({ err, symbol }, 'Market bars unavailable');
      return [];
    });
    const first = bars[0];
    const last = bars.at(-1);
    const change = first && last ? Math.round((last.c - first.o) * 100) / 100 : null;
    const response: BarsResponse = {
      symbol,
      range,
      bars,
      source: provider.source,
      stats: {
        open: first?.o ?? null,
        close: last?.c ?? null,
        high: bars.length ? Math.max(...bars.map((b) => b.h)) : null,
        low: bars.length ? Math.min(...bars.map((b) => b.l)) : null,
        change,
        changePercent: first && change !== null ? Math.round((change / first.o) * 10_000) / 100 : null,
        volume: bars.reduce((s, b) => s + b.v, 0),
        relativeVolume: relativeVolume(bars),
      },
      sma20: sma(
        bars.map((b) => b.c),
        20,
      ),
    };
    res.set('Cache-Control', 'public, max-age=30');
    res.json(response);
  });

  router.get('/markets/stocks/:symbol', async (req, res) => {
    const { symbol: raw } = validate(symbolParams, req.params, 'params');
    const { symbol, company } = await findStock(raw);
    const [summary] = await summaries([{ id: company.id, slug: company.slug, name: company.name, ticker: company.ticker, exchange: company.exchange, sector: company.sector, memeStock: company.memeStock, isDemo: company.isDemo }]);
    const now = Date.now();
    const since = new Date(now - 30 * DAY_MS);
    const [daily, signals, episodes, clips] = await Promise.all([
      prisma.$queryRaw<Array<{ date: string; views: bigint; searches: bigint }>>`
        SELECT to_char(occurred_at, 'YYYY-MM-DD') AS date,
          COUNT(*) FILTER (WHERE type = 'page_view' AND entity_type = 'company' AND entity_id = ${company.id}) AS views,
          COUNT(*) FILTER (WHERE type = 'search' AND (query = ${symbol.toLowerCase()} OR query = ${`$${symbol.toLowerCase()}`} OR query LIKE ${`%${company.name.toLowerCase()}%`})) AS searches
        FROM analytics_events WHERE occurred_at >= ${since} GROUP BY 1 ORDER BY 1`,
      buzzSignals([company.id], new Map([[company.id, { ticker: symbol, name: company.name }]]), new Date(now - RADAR_WINDOW_DAYS * DAY_MS), new Date(now)),
      prisma.episode.findMany({ where: { status: PUBLISHED, companies: { some: { companyId: company.id } } }, select: episodeSelect, orderBy: { publishedAt: 'desc' }, take: 12 }),
      prisma.clip.findMany({ where: { reviewStatus: PUBLISHED, sourceEpisode: { status: PUBLISHED, companies: { some: { companyId: company.id } } } }, select: clipSelect, orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);
    const byDate = new Map(daily.map((d) => [d.date, d]));
    const days: StockDetailResponse['buzz']['daily'] = [];
    for (let t = since.getTime() + DAY_MS; t <= now; t += DAY_MS) {
      const date = new Date(t).toISOString().slice(0, 10);
      const row = byDate.get(date);
      days.push({ date, pageViews: Number(row?.views ?? 0), searches: Number(row?.searches ?? 0) });
    }
    const response: StockDetailResponse = {
      stock: { ...summary!, description: company.description, website: company.website, country: company.country },
      company: toCompanySummary(company),
      buzz: { daily: days, signals: signals.get(company.id)! },
      episodes: episodes.map(toEpisodeSummary),
      clips: clips.map((c) => toClipSummary(c, media.publicUrl)),
      disclaimer: MARKET_DISCLAIMER,
      demoNotice: provider.source === 'demo' || company.isDemo ? DEMO_MARKET_NOTICE : null,
    };
    res.set('Cache-Control', 'public, max-age=15');
    res.json(response);
  });

  return router;
}
