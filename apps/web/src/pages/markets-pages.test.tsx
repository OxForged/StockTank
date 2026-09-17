import { ApiClientError } from '@stocktank/api-client';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_HOME, mockApi } from '../test/mock-api';
import { renderApp } from '../test/render';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

const DEMO = 'DEMO data: synthetic prices for fictional companies. Not real market data.';
const quote = (price: number, changePercent: number, volume = 1_000_000) => ({ symbol: 'X', price, change: (price * changePercent) / 100, changePercent, volume, asOf: '2026-09-17T15:00:00.000Z', delayed: false, source: 'demo' as const });
const stock = (symbol: string, name: string, meme: boolean, changePercent: number, volume = 1_000_000) => ({
  symbol,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  exchange: 'DEMO',
  sector: 'Consumer',
  memeStock: meme,
  isDemo: true,
  quote: { ...quote(42.5, changePercent, volume), symbol },
  sparkline: [40, 41, 42.5],
});
const stocks = [stock('SQZM', 'Squeeze Motors', true, 6.5, 5_000_000), stock('STDY', 'Steady Co', false, -1.2, 800_000)];
const bars = Array.from({ length: 22 }, (_, i) => ({ t: Date.UTC(2026, 7, 20 + i), o: 40 + i * 0.1, h: 41 + i * 0.1, l: 39 + i * 0.1, c: 40.5 + i * 0.1, v: 100_000 + i }));

describe('Markets', { timeout: 30_000 }, () => {
  beforeEach(() => {
    mockApi.auth.me.mockRejectedValue(new ApiClientError(401, 'UNAUTHENTICATED', 'Not signed in'));
    mockApi.ads.serve.mockResolvedValue({ ad: null });
    mockApi.content.home.mockResolvedValue(EMPTY_HOME);
    mockApi.markets.stocks.mockResolvedValue({ items: stocks, source: 'demo', disclaimer: 'Market data is for information only. Not investment advice.', demoNotice: DEMO });
    mockApi.markets.movers.mockResolvedValue({ gainers: [stocks[0]!], losers: [stocks[1]!], mostActive: stocks, source: 'demo', demoNotice: DEMO });
    mockApi.markets.radar.mockResolvedValue({
      windowDays: 7,
      items: [
        { ...stocks[0]!, buzzScore: 100, buzzChange: 400, signals: { pageViews: 6, follows: 0, searches: 2, mentions: 1 } },
        { ...stocks[1]!, buzzScore: 30, buzzChange: null, signals: { pageViews: 1, follows: 0, searches: 1, mentions: 0 } },
      ],
      methodology: 'Buzz measures StockTank audience activity. It is not market sentiment or a trading signal.',
      source: 'demo',
      demoNotice: DEMO,
    });
  });

  it('shows the live ticker tape with DEMO labelling on every page', async () => {
    renderApp('/');
    const tape = await screen.findByRole('region', { name: /markets ticker/i });
    const links = await within(tape).findAllByRole('link', { name: /SQZM/ });
    expect(links[0]).toHaveAttribute('href', '/markets/SQZM');
    expect(within(tape).getByText('DEMO DATA')).toBeInTheDocument();
    expect(within(tape).getAllByText('MEME').length).toBeGreaterThan(0);
    expect(within(tape).getAllByText('up').length).toBeGreaterThan(0);
  });

  it('renders the markets hub: heat map, list toggle, radar and movers', async () => {
    renderApp('/markets');
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { level: 1, name: /stocks & meme stocks/i })).toBeInTheDocument();
    expect((await screen.findAllByText(DEMO)).length).toBeGreaterThan(0);
    const map = await screen.findByRole('list', { name: /stocks by volume/i });
    expect(within(map).getByRole('link', { name: /Squeeze Motors, up 6\.50 percent/ })).toHaveAttribute('href', '/markets/SQZM');

    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.queryByRole('list', { name: /stocks by volume/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /SQZM.*Squeeze Motors/ }).length).toBeGreaterThan(0);

    expect(await screen.findByRole('heading', { name: /meme stock radar/i })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'SQZM buzz' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText(/buzz \+400% w\/w/)).toBeInTheDocument();
    expect(screen.getByText(/not market sentiment or a trading signal/)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Movers' })).toBeInTheDocument();
  });

  it('renders a stock page with an interactive chart, ranges and buzz', async () => {
    mockApi.markets.stock.mockResolvedValue({
      stock: { ...stocks[0]!, description: 'A fictional DEMO company.', website: null, country: 'US' },
      company: { id: 'c1', slug: 'squeeze-motors', name: 'Squeeze Motors', ticker: 'SQZM', exchange: 'DEMO', sector: 'Consumer', country: 'US', description: null, logoUrl: null, isDemo: true },
      buzz: { daily: Array.from({ length: 30 }, (_, i) => ({ date: `2026-08-${String(18 + (i % 12)).padStart(2, '0')}`, pageViews: i, searches: 0 })), signals: { pageViews: 6, follows: 0, searches: 2, mentions: 1 } },
      episodes: [],
      clips: [],
      disclaimer: 'Market data is for information only. Not investment advice.',
      demoNotice: DEMO,
    });
    mockApi.markets.bars.mockResolvedValue({
      symbol: 'SQZM',
      range: '1M',
      bars,
      source: 'demo',
      stats: { open: 40, close: 42.6, high: 43.1, low: 39, change: 2.6, changePercent: 6.5, volume: 2_200_231, relativeVolume: 2.4 },
      sma20: bars.map((_, i) => (i >= 19 ? 41 : null)),
    });
    renderApp('/markets/SQZM');
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { level: 1, name: 'SQZM' })).toBeInTheDocument();
    expect(screen.getByText('MEME STOCK')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /SQZM price, 1 month/ })).toBeInTheDocument();
    expect(screen.getByText('2.40×')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1D' }));
    await waitFor(() => expect(mockApi.markets.bars).toHaveBeenLastCalledWith('SQZM', '1D'));
    await user.click(screen.getByRole('button', { name: 'Candles' }));
    expect(screen.getByRole('button', { name: 'Candles' })).toHaveAttribute('aria-pressed', 'true');

    expect(screen.getByRole('img', { name: /Daily StockTank views and searches/ })).toBeInTheDocument();
    expect(screen.getByText(/not market sentiment or a trading signal/)).toBeInTheDocument();
    expect(screen.getByText(/No episodes mention SQZM yet/)).toBeInTheDocument();
  });

  it('shows not found for unknown symbols', async () => {
    mockApi.markets.stock.mockRejectedValue(new ApiClientError(404, 'NOT_FOUND', 'Stock not found'));
    mockApi.markets.bars.mockRejectedValue(new ApiClientError(404, 'NOT_FOUND', 'Stock not found'));
    renderApp('/markets/NOPE');
    expect(await screen.findByRole('heading', { name: /off air/i })).toBeInTheDocument();
  });
});
