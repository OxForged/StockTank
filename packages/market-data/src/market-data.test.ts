import { describe, expect, it } from 'vitest';
import { createMarketDataProvider, DemoMarketDataProvider, marketDataEnvSchema, PolygonMarketDataProvider, relativeVolume, sma } from './index.js';

const NOW = Date.UTC(2026, 8, 17, 15, 0, 0);

describe('DemoMarketDataProvider', () => {
  it('is deterministic, sized per range, and internally consistent', async () => {
    const p = new DemoMarketDataProvider(new Set(['SQZM']), () => NOW);
    const a = await p.getBars('sqzm', '1M');
    const b = await p.getBars('SQZM', '1M');
    expect(a).toEqual(b);
    expect(a).toHaveLength(22);
    expect((await p.getBars('SQZM', '1D')).length).toBe(78);
    for (const bar of a) {
      expect(bar.h).toBeGreaterThanOrEqual(Math.max(bar.o, bar.c));
      expect(bar.l).toBeLessThanOrEqual(Math.min(bar.o, bar.c));
      expect(bar.v).toBeGreaterThan(0);
    }
    expect(a.at(-1)!.t).toBeLessThanOrEqual(NOW);
  });

  it('makes meme names more volatile than steady names and labels quotes as demo', async () => {
    const p = new DemoMarketDataProvider(new Set(['SQZM']), () => NOW);
    const spread = async (s: string) => {
      const bars = await p.getBars(s, '1Y');
      const returns = bars.slice(1).map((bar, i) => Math.abs(bar.c / bars[i]!.c - 1));
      return returns.reduce((x, y) => x + y, 0) / returns.length;
    };
    expect(await spread('SQZM')).toBeGreaterThan((await spread('STDY')) * 2);
    const [q] = await p.getQuotes(['sqzm']);
    expect(q).toMatchObject({ symbol: 'SQZM', source: 'demo', delayed: false });
    expect(q!.price).toBeGreaterThan(0);
  });
});

describe('PolygonMarketDataProvider', () => {
  it('requests aggregates with the key and marks previous-day quotes as delayed', async () => {
    const urls: string[] = [];
    const fake = (async (input: string | URL | Request) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('/prev')) return new Response(JSON.stringify({ results: [{ t: NOW, o: 20, h: 25, l: 19, c: 24, v: 1000 }] }));
      return new Response(
        JSON.stringify({
          results: [
            { t: Date.UTC(2026, 8, 15, 14), o: 1, h: 2, l: 1, c: 2, v: 10 },
            { t: Date.UTC(2026, 8, 16, 14), o: 2, h: 3, l: 2, c: 3, v: 20 },
          ],
        }),
      );
    }) as typeof fetch;
    const p = new PolygonMarketDataProvider('secret', { fetch: fake, now: () => NOW });
    const [q] = await p.getQuotes(['gme']);
    expect(q).toEqual({ symbol: 'GME', price: 24, change: 4, changePercent: 20, volume: 1000, asOf: new Date(NOW).toISOString(), delayed: true, source: 'polygon' });
    const intraday = await p.getBars('GME', '1D');
    expect(intraday).toHaveLength(1); // only the latest session
    expect(urls[1]).toMatch(/\/v2\/aggs\/ticker\/GME\/range\/5\/minute\/2026-09-13\/2026-09-17\?adjusted=true&sort=asc&limit=5000&apiKey=secret$/);
  });

  it('surfaces auth problems clearly', async () => {
    const p = new PolygonMarketDataProvider('bad', { fetch: (async () => new Response('{}', { status: 403 })) as typeof fetch });
    await expect(p.getQuotes(['GME'])).rejects.toThrow(/MARKET_DATA_API_KEY/);
  });
});

describe('configuration and indicators', () => {
  it('defaults to demo data and requires a key for real providers', () => {
    expect(createMarketDataProvider(marketDataEnvSchema.parse({})).source).toBe('demo');
    expect(() => createMarketDataProvider(marketDataEnvSchema.parse({ MARKET_DATA_PROVIDER: 'polygon' }))).toThrow(/MARKET_DATA_API_KEY/);
  });

  it('computes moving averages and relative volume', () => {
    expect(sma([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5]);
    const bars = [10, 10, 10, 40].map((v, i) => ({ t: i, o: 1, h: 1, l: 1, c: 1, v }));
    expect(relativeVolume(bars)).toBe(4);
  });
});
