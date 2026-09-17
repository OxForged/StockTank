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
    expect(await screen.findByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('DAU (latest day)').parentElement).toHaveTextContent('150');
    expect(screen.getByText('newsletter')).toBeInTheDocument();
    expect(screen.getByText(/40\.00%/)).toBeInTheDocument();
    expect(screen.getByText('rwa · 12')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Visitors per day' })).toBeInTheDocument();
    expect(screen.getByText(/no IP addresses are stored/)).toBeInTheDocument();

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
    expect(screen.getByText('1h 5m')).toBeInTheDocument();
    const row = screen.getByText('Treasuries on-chain').closest('tr')!;
    expect(within(row).getByText('33')).toBeInTheDocument();
    expect(screen.getByText('No clip plays in range.')).toBeInTheDocument();
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
