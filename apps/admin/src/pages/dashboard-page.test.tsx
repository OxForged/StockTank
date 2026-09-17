import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { mockApi } from '../test/mock-api';
import { renderApp } from '../test/render';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

const staff = (permissions: string[]) => ({
  id: 'u_1',
  email: 'staff@example.com',
  displayName: 'Staff Member',
  avatarUrl: null,
  roles: ['editor'],
  permissions,
  createdAt: '2026-01-01T00:00:00.000Z',
});

function mockSystem() {
  mockApi.system.ready.mockResolvedValue({ status: 'ready', checks: { database: { ok: true, latencyMs: 3 }, redis: { ok: false, error: 'down' } } });
  mockApi.system.version.mockResolvedValue({ name: 'stocktank-api', version: '0.1.0', commit: null, node: 'v24' });
}

describe('Dashboard "Today" strip', () => {
  it('shows analytics and advertising counters with sparklines when the user may read them', async () => {
    mockSystem();
    mockApi.auth.me.mockResolvedValue({ user: staff(['analytics.read', 'ads.manage']) });
    mockApi.admin.analytics.audience.mockResolvedValue({
      range: { from: '2026-09-04', to: '2026-09-17' },
      uniqueVisitors: 400,
      mau: 900,
      pageViews: 2000,
      daily: [
        { date: '2026-09-16', visitors: 100, pageViews: 300 },
        { date: '2026-09-17', visitors: 150, pageViews: 420 },
      ],
      followers: { total: 42, new: 5 },
      trafficSources: [],
      retention: [],
      topSearches: [],
    });
    mockApi.admin.advertisingOverview.mockResolvedValue({
      activeCampaigns: 1,
      pendingReviews: 2,
      impressionsLast7d: 120,
      clicksLast7d: 6,
      impressionsPrior7d: 100,
      clicksPrior7d: 5,
      daily: [
        { date: '2026-09-16', impressions: 50, clicks: 2 },
        { date: '2026-09-17', impressions: 70, clicks: 4 },
      ],
      bookedRevenueCents: 0,
      newInquiries: 0,
      confirmedSubscribers: 0,
      advertisingLive: true,
    });
    renderApp('/');

    const strip = await screen.findByRole('region', { name: 'Today' });
    await waitFor(() => expect(within(strip).getByText('Visitors today')).toBeInTheDocument());
    expect(within(strip).getByText('Visitors today').parentElement).toHaveTextContent('150');
    expect(within(strip).getByRole('img', { name: 'Visitors per day, last 14 days' })).toBeInTheDocument();
    expect(within(strip).getByText('Page views today').parentElement).toHaveTextContent('420');
    expect(within(strip).getByText('Ad impressions (7 days)').parentElement).toHaveTextContent('120');
    expect(within(strip).getByText(/20\.00%/)).toHaveTextContent('up');
    expect(within(strip).getByText('Awaiting ad review').parentElement).toHaveTextContent('2');
    expect(within(strip).getByText('API checks passing').parentElement).toHaveTextContent('1of 2 readiness checks');

    // The analytics call covers the last 14 UTC days, ending today.
    const range = mockApi.admin.analytics.audience.mock.calls[0]![0] as { from: string; to: string };
    expect((new Date(range.to).getTime() - new Date(range.from).getTime()) / 86_400_000).toBe(13);
  });

  it('never calls analytics or advertising endpoints the user lacks permission for', async () => {
    mockSystem();
    mockApi.auth.me.mockResolvedValue({ user: staff(['content.read_drafts']) });
    renderApp('/');

    const strip = await screen.findByRole('region', { name: 'Today' });
    await waitFor(() => expect(within(strip).getByText('API checks passing')).toBeInTheDocument());
    expect(within(strip).queryByText('Visitors today')).toBeNull();
    expect(within(strip).queryByText('Ad impressions (7 days)')).toBeNull();
    expect(mockApi.admin.analytics.audience).not.toHaveBeenCalled();
    expect(mockApi.admin.advertisingOverview).not.toHaveBeenCalled();
  });
});
