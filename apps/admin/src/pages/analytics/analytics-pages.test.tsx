import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { mockApi } from '../../test/mock-api';
import { renderApp } from '../../test/render';
import { formatDuration } from './analytics-pages';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

const analyst = (permissions = ['analytics.read']) => ({
  id: 'u_1',
  email: 'sales@example.com',
  displayName: 'Sales',
  avatarUrl: null,
  roles: ['sales'],
  permissions,
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('Analytics dashboards', { timeout: 30_000 }, () => {
  it('shows audience metrics, a daily chart with an accessible table, and switches range', async () => {
    mockApi.auth.me.mockResolvedValue({ user: analyst() });
    mockApi.admin.analytics.audience.mockResolvedValue({
      range: { from: '2026-09-11', to: '2026-09-17' },
      uniqueVisitors: 1234,
      mau: 5678,
      pageViews: 9000,
      daily: [
        { date: '2026-09-16', visitors: 100, pageViews: 300 },
        { date: '2026-09-17', visitors: 150, pageViews: 420 },
      ],
      followers: { total: 42, new: 5 },
      trafficSources: [{ source: 'newsletter', visitors: 80, pageViews: 200 }],
      retention: [{ cohortWeek: '2026-09-07', visitors: 50, returned: 20, rate: 0.4 }],
      topSearches: [{ query: 'rwa', count: 12 }],
    });
    renderApp('/analytics/audience');
    const user = userEvent.setup();
    // Animated counters render the value twice (visual + screen-reader copy).
    expect((await screen.findAllByText('1,234')).length).toBeGreaterThan(0);
    expect(screen.getByText('DAU (latest day)').parentElement).toHaveTextContent('150');
    expect(screen.getByText('newsletter')).toBeInTheDocument();
    expect(screen.getByText('rwa · 12')).toBeInTheDocument();
    expect(screen.getByText(/no IP addresses are stored/)).toBeInTheDocument();

    // Retention is a bar list with a meter per cohort, not a static table.
    const cohort = screen.getByRole('meter', { name: /2026-09-07/ });
    expect(cohort).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText(/20 of 50 returned · 40\.00%/)).toBeInTheDocument();

    // The chart keeps an accessible data table and toggles between visitors (area) and page views (bars).
    expect(screen.getByRole('table', { name: 'Visitors per day' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Visitors per day' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Page views' }));
    expect(screen.getByRole('table', { name: 'Page views per day' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Visitors per day' })).toBeNull();
    expect(within(screen.getByRole('table', { name: 'Page views per day' })).getByText('420')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '7 days' }));
    await waitFor(() => {
      const last = mockApi.admin.analytics.audience.mock.calls.at(-1)![0] as { from: string; to: string };
      expect((new Date(last.to).getTime() - new Date(last.from).getTime()) / 86_400_000).toBe(6);
    });
  });

  it('reports untracked metrics honestly on the content dashboard', async () => {
    mockApi.auth.me.mockResolvedValue({ user: analyst() });
    mockApi.admin.analytics.content.mockResolvedValue({
      range: { from: '2026-08-19', to: '2026-09-17' },
      totals: { views: 10, plays: 8, completions: 4, completionRate: 0.5, listenSeconds: 3900, watchSeconds: 120, downloads: 33, shares: 2, radioSeconds: 600 },
      topEpisodes: [{ id: 'e1', title: 'Treasuries on-chain', showTitle: 'The Tank', views: 10, plays: 8, completions: 4, completionRate: 0.5, listenSeconds: 3900, watchSeconds: 120, downloads: 33, shares: 2 }],
      clips: [],
      notTracked: ['likes', 'comments'],
    });
    renderApp('/analytics/content');
    expect(await screen.findByText('Treasuries on-chain')).toBeInTheDocument();
    expect(screen.getByText(/Not tracked yet.*likes, comments/)).toBeInTheDocument();
    expect(screen.getByText('Listening time').parentElement).toHaveTextContent('1h 5m');
    const row = screen.getByText('Treasuries on-chain').closest('tr')!;
    expect(within(row).getByText('33')).toBeInTheDocument();
    expect(screen.getByText('No clip plays in range.')).toBeInTheDocument();

    // Content mix: listen vs watch vs radio seconds as bars with an accessible table and direct labels.
    const mix = screen.getByRole('table', { name: 'Time spent by medium' });
    expect(within(mix).getByRole('row', { name: /Listen/ })).toHaveTextContent('1h 5m');
    expect(within(mix).getByRole('row', { name: /Radio/ })).toHaveTextContent('10m');
    expect(screen.getByText('(84%)')).toBeInTheDocument();
  });

  it('sorts the shows table from its column headers and marks the sort for assistive tech', async () => {
    mockApi.auth.me.mockResolvedValue({ user: analyst() });
    const show = (id: string, title: string, views: number, plays: number) => ({
      id,
      slug: id,
      title,
      isDemo: false,
      views,
      plays,
      completions: 1,
      completionRate: 0.5,
      listenSeconds: 60,
      watchSeconds: 0,
      downloads: 0,
      shares: 0,
      followers: 3,
      newFollowers: 1,
    });
    mockApi.admin.analytics.shows.mockResolvedValue({
      range: { from: '2026-08-19', to: '2026-09-17' },
      items: [show('s1', 'Alpha Hour', 50, 9), show('s2', 'Beta Brief', 200, 2), show('s3', 'Gamma Grind', 120, 30)],
    });
    renderApp('/analytics/shows');
    const user = userEvent.setup();
    expect(await screen.findByText('Alpha Hour')).toBeInTheDocument();
    const titles = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0]!.textContent?.trim());
    // API order until a header is clicked.
    expect(titles()).toEqual(['Alpha Hour', 'Beta Brief', 'Gamma Grind']);
    const viewsHeader = screen.getByRole('columnheader', { name: /views/i });
    expect(viewsHeader).toHaveAttribute('aria-sort', 'none');

    await user.click(within(viewsHeader).getByRole('button'));
    expect(viewsHeader).toHaveAttribute('aria-sort', 'descending');
    expect(titles()).toEqual(['Beta Brief', 'Gamma Grind', 'Alpha Hour']);

    await user.click(within(viewsHeader).getByRole('button'));
    expect(viewsHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(titles()).toEqual(['Alpha Hour', 'Gamma Grind', 'Beta Brief']);

    // Text columns sort ascending first.
    await user.click(within(screen.getByRole('columnheader', { name: /^show/i })).getByRole('button'));
    expect(viewsHeader).toHaveAttribute('aria-sort', 'none');
    expect(titles()).toEqual(['Alpha Hour', 'Beta Brief', 'Gamma Grind']);
  });

  it('hides analytics from staff without analytics.read', async () => {
    mockApi.auth.me.mockResolvedValue({ user: analyst(['content.read_drafts']) });
    renderApp('/analytics/shows');
    expect(await screen.findByText(/don.t have access|not authorized|permission/i)).toBeInTheDocument();
    expect(mockApi.admin.analytics.shows).not.toHaveBeenCalled();
  });

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(600)).toBe('10m');
    expect(formatDuration(3900)).toBe('1h 5m');
  });
});
