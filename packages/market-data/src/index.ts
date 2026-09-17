import { z } from 'zod';

/**
 * Market data abstraction for stock and meme-stock coverage. Real providers are adapters; the demo provider
 * generates obviously synthetic series and every response carries its source so the UI can label DEMO data.
 */

export const CHART_RANGES = ['1D', '5D', '1M', '6M', '1Y'] as const;
export type ChartRange = (typeof CHART_RANGES)[number];
export const chartRangeSchema = z.enum(CHART_RANGES);

export type MarketDataSource = 'demo' | 'polygon';

export interface Bar {
  /** Bar open time, epoch milliseconds. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  /** When the quoted price was observed (ISO). */
  asOf: string;
  /** True when the provider only supplies delayed or end-of-day data. */
  delayed: boolean;
  source: MarketDataSource;
}

export interface MarketDataProvider {
  readonly source: MarketDataSource;
  getQuotes(symbols: string[]): Promise<Quote[]>;
  getBars(symbol: string, range: ChartRange): Promise<Bar[]>;
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}

export const normalizeSymbol = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '').slice(0, 12);

// ───────── Demo provider ─────────

/** Deterministic PRNG so demo charts are stable between reloads and tests. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSymbol(symbol: string): number {
  let h = 2166136261;
  for (const ch of symbol) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const RANGE_SPEC: Record<ChartRange, { points: number; stepMs: number }> = {
  '1D': { points: 78, stepMs: 5 * 60_000 },
  '5D': { points: 5 * 26, stepMs: 15 * 60_000 },
  '1M': { points: 22, stepMs: 86_400_000 },
  '6M': { points: 126, stepMs: 86_400_000 },
  '1Y': { points: 252, stepMs: 86_400_000 },
};

/**
 * Synthetic random-walk markets for development and demos. `volatile` symbols behave like meme stocks
 * (fat-tailed jumps, volume spikes). Values are not real prices; responses are marked `source: 'demo'`.
 */
export class DemoMarketDataProvider implements MarketDataProvider {
  readonly source = 'demo' as const;

  constructor(
    private readonly volatile: ReadonlySet<string> = new Set(),
    private readonly now: () => number = Date.now,
  ) {}

  getBars(symbol: string, range: ChartRange): Promise<Bar[]> {
    const sym = normalizeSymbol(symbol);
    const { points, stepMs } = RANGE_SPEC[range];
    const meme = this.volatile.has(sym);
    // Anchor to the current 5-minute bucket so the series is stable within a bucket and advances over time.
    const end = Math.floor(this.now() / 300_000) * 300_000;
    const rand = mulberry32(hashSymbol(`${sym}:${range}:${Math.floor(end / RANGE_SPEC[range].stepMs)}`));
    const base = 5 + (hashSymbol(sym) % 29500) / 100;
    const dayFraction = stepMs / 86_400_000;
    const sigma = (meme ? 0.04 : 0.012) * Math.sqrt(dayFraction) * (range === '1D' || range === '5D' ? 1.3 : 1);
    // Occasional squeeze-style jumps, scaled down for intraday bars.
    const jumpSize = 0.16 * Math.max(0.2, Math.sqrt(dayFraction));
    const bars: Bar[] = [];
    let price = base;
    for (let i = points - 1; i >= 0; i--) {
      const shock = (rand() - 0.5) * 2 * sigma;
      const jump = meme && rand() > 0.975 ? (rand() - 0.4) * jumpSize : 0;
      const open = price;
      const close = Math.max(0.5, open * (1 + shock + jump));
      const high = Math.max(open, close) * (1 + rand() * sigma * 0.6);
      const low = Math.min(open, close) * (1 - rand() * sigma * 0.6);
      const baseVolume = (hashSymbol(sym) % 900 + 100) * 10_000 * (stepMs / 86_400_000);
      const volume = Math.round(baseVolume * (0.6 + rand() * 0.8) * (jump ? 4 + rand() * 6 : 1));
      bars.push({ t: end - i * stepMs, o: round(open), h: round(high), l: round(low), c: round(close), v: volume });
      price = close;
    }
    return Promise.resolve(bars);
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    return Promise.all(
      symbols.map(async (s) => {
        const sym = normalizeSymbol(s);
        const bars = await this.getBars(sym, '1D');
        const first = bars[0]!;
        const last = bars.at(-1)!;
        const change = round(last.c - first.o);
        return {
          symbol: sym,
          price: last.c,
          change,
          changePercent: round((change / first.o) * 100),
          volume: bars.reduce((sum, b) => sum + b.v, 0),
          asOf: new Date(last.t).toISOString(),
          delayed: false,
          source: 'demo' as const,
        };
      }),
    );
  }
}

const round = (n: number) => Math.round(n * 100) / 100;

// ───────── Polygon.io adapter ─────────

interface PolygonAggs {
  status?: string;
  results?: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
}

/**
 * Polygon.io aggregates. Quotes use the previous-day aggregate (available on free plans) and are marked delayed.
 */
export class PolygonMarketDataProvider implements MarketDataProvider {
  readonly source = 'polygon' as const;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly apiKey: string,
    options: { fetch?: typeof fetch; baseUrl?: string; now?: () => number } = {},
  ) {
    this.fetchImpl = options.fetch ?? fetch;
    this.base = (options.baseUrl ?? 'https://api.polygon.io').replace(/\/+$/, '');
    this.now = options.now ?? Date.now;
  }

  private readonly base: string;
  private readonly now: () => number;

  private async get(path: string): Promise<PolygonAggs> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}${path.includes('?') ? '&' : '?'}apiKey=${encodeURIComponent(this.apiKey)}`, { signal: AbortSignal.timeout(10_000) });
    } catch (err) {
      throw new MarketDataError(`Market data provider unreachable: ${err instanceof Error ? err.message : 'network error'}`, 0);
    }
    if (!res.ok) throw new MarketDataError(`Market data provider returned ${res.status}${res.status === 401 || res.status === 403 ? ' (check MARKET_DATA_API_KEY and plan)' : ''}`, res.status);
    return (await res.json()) as PolygonAggs;
  }

  async getBars(symbol: string, range: ChartRange): Promise<Bar[]> {
    const sym = normalizeSymbol(symbol);
    const day = 86_400_000;
    const spec: Record<ChartRange, { multiplier: number; timespan: 'minute' | 'day'; lookbackMs: number }> = {
      '1D': { multiplier: 5, timespan: 'minute', lookbackMs: 4 * day },
      '5D': { multiplier: 15, timespan: 'minute', lookbackMs: 9 * day },
      '1M': { multiplier: 1, timespan: 'day', lookbackMs: 31 * day },
      '6M': { multiplier: 1, timespan: 'day', lookbackMs: 183 * day },
      '1Y': { multiplier: 1, timespan: 'day', lookbackMs: 366 * day },
    };
    const s = spec[range];
    const to = new Date(this.now()).toISOString().slice(0, 10);
    const from = new Date(this.now() - s.lookbackMs).toISOString().slice(0, 10);
    const json = await this.get(`/v2/aggs/ticker/${encodeURIComponent(sym)}/range/${s.multiplier}/${s.timespan}/${from}/${to}?adjusted=true&sort=asc&limit=5000`);
    let bars = (json.results ?? []).map((r) => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v }));
    // Intraday ranges show the most recent session(s) only.
    if (range === '1D' || range === '5D') {
      const sessions = [...new Set(bars.map((b) => new Date(b.t).toISOString().slice(0, 10)))];
      const keep = new Set(sessions.slice(range === '1D' ? -1 : -5));
      bars = bars.filter((b) => keep.has(new Date(b.t).toISOString().slice(0, 10)));
    }
    return bars;
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const out: Quote[] = [];
    for (const s of symbols) {
      const sym = normalizeSymbol(s);
      const json = await this.get(`/v2/aggs/ticker/${encodeURIComponent(sym)}/prev?adjusted=true`);
      const r = json.results?.[0];
      if (!r) continue;
      const change = round(r.c - r.o);
      out.push({ symbol: sym, price: r.c, change, changePercent: round((change / r.o) * 100), volume: r.v, asOf: new Date(r.t).toISOString(), delayed: true, source: 'polygon' });
    }
    return out;
  }
}

export const marketDataEnvSchema = z.object({
  MARKET_DATA_PROVIDER: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['demo', 'polygon']).default('demo')),
  MARKET_DATA_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
});
export type MarketDataEnv = z.infer<typeof marketDataEnvSchema>;

export function createMarketDataProvider(env: MarketDataEnv, volatile: ReadonlySet<string> = new Set()): MarketDataProvider {
  if (env.MARKET_DATA_PROVIDER === 'polygon') {
    if (!env.MARKET_DATA_API_KEY) throw new Error('MARKET_DATA_PROVIDER=polygon requires MARKET_DATA_API_KEY');
    return new PolygonMarketDataProvider(env.MARKET_DATA_API_KEY);
  }
  return new DemoMarketDataProvider(volatile);
}

// ───────── Indicators used by charts ─────────

export function sma(values: number[], period: number): Array<number | null> {
  let sum = 0;
  return values.map((v, i) => {
    sum += v;
    if (i >= period) sum -= values[i - period]!;
    return i >= period - 1 ? round(sum / period) : null;
  });
}

/** Volume relative to its trailing average: > 2 is a spike worth highlighting on meme-stock charts. */
export function relativeVolume(bars: Bar[], lookback = 20): number | null {
  if (bars.length < 2) return null;
  const last = bars.at(-1)!;
  const window = bars.slice(Math.max(0, bars.length - 1 - lookback), -1);
  const avg = window.reduce((s, b) => s + b.v, 0) / window.length;
  return avg > 0 ? round(last.v / avg) : null;
}
