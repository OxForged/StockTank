import { ApiClientError } from '@stocktank/api-client';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEMO_HOME, EMPTY_HOME, EPISODE_DETAIL_BASE, mockApi } from '../../test/mock-api';
import { renderApp } from '../../test/render';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

describe('HomePage (hybrid A + B)', () => {
  beforeEach(() => {
    mockApi.auth.me.mockRejectedValue(new ApiClientError(401, 'UNAUTHENTICATED', 'Not signed in'));
    mockApi.ads.serve.mockResolvedValue({ ad: null });
    mockApi.content.search.mockResolvedValue({ query: '', shows: [], episodes: [], projects: [], companies: [] });
    mockApi.markets.stocks.mockResolvedValue({ items: [], source: 'demo', disclaimer: 'Not investment advice.', demoNotice: null });
    mockApi.markets.radar.mockResolvedValue({ windowDays: 7, items: [], methodology: 'Buzz.', source: 'demo', demoNotice: null });
  });

  it('renders the hybrid layout: rail, markets tape, hero, live desk and sections', async () => {
    mockApi.content.home.mockResolvedValue(DEMO_HOME);
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: /stocktank/i })).toBeInTheDocument();
    for (const name of ['Latest on StockTank', 'Watchlist', 'Today’s rundown', 'The StockTank lineup', 'StockTank, in your inbox']) {
      expect(await screen.findByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('complementary', { name: 'Sections' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Founders pitch.' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /on air: market open/i })).toBeInTheDocument();
    expect(screen.getByText('Pre-market: what moved overnight')).toBeInTheDocument();
  });

  it('labels demo content and never invents market prices', async () => {
    mockApi.content.home.mockResolvedValue(DEMO_HOME);
    renderApp('/');
    expect(await screen.findByText(/preview content/i)).toBeInTheDocument();
    // The tape only shows prices the API labels; with no tracked stocks it shows none and never invents any.
    const tape = screen.getByRole('region', { name: /markets ticker/i });
    expect(await within(tape).findByText(/no tracked stocks yet/i)).toBeInTheDocument();
    expect(tape.textContent).not.toMatch(/\$\s?\d|\d+\.\d+%/);
    expect(screen.getAllByText(/not financial or investment advice/i).length).toBeGreaterThan(0);
  });

  it('shows an honest brand hero and off-air desk when nothing is published', async () => {
    mockApi.content.home.mockResolvedValue(EMPTY_HOME);
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 2, name: /media for the/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /live desk: off air/i })).toBeInTheDocument();
    expect(screen.queryByText(/preview content/i)).not.toBeInTheDocument();
  });

  it('opens the mini player without pretending media can play', async () => {
    mockApi.content.home.mockResolvedValue(DEMO_HOME);
    mockApi.content.episode.mockResolvedValue({ ...EPISODE_DETAIL_BASE, media: null });
    renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /play can a treasury protocol/i }));
    const player = screen.getByRole('region', { name: 'Player' });
    // The card has no media URLs, so the player looks the episode up; the mock episode has no processed media.
    expect(await within(player).findByRole('button', { name: /playback not available yet/i })).toBeDisabled();
  });

  it('saves watchlist items on this device', async () => {
    mockApi.content.home.mockResolvedValue(DEMO_HOME);
    renderApp('/');
    const user = userEvent.setup();
    const star = await screen.findByRole('button', { name: /save harbor protocol to watchlist/i });
    await user.click(star);
    expect(screen.getByRole('button', { name: /remove harbor protocol from watchlist/i })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('stocktank.watchlist')).toContain('project:p1');
  });
});
