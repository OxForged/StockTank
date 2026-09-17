import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { mockApi } from '../../test/mock-api';
import { renderApp } from '../../test/render';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

const user = (permissions: string[], roles: string[] = ['editor']) => ({
  id: 'u_1',
  email: 'staff@example.com',
  displayName: 'Staff Member',
  avatarUrl: null,
  roles,
  permissions,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const flaggedCreative = {
  id: 'cr_1',
  campaignId: 'c_1',
  kind: 'native',
  headline: 'Guaranteed returns with zero risk',
  body: null,
  imageUrl: null,
  altText: null,
  ctaLabel: 'Learn more',
  clickUrl: 'https://acme.example',
  disclosureLabel: 'Sponsored',
  reviewStatus: 'review',
  policyFlags: ['guaranteed_returns', 'risk_free_claim'],
  reviewNotes: null,
  reviewedAt: null,
  createdAt: '2026-09-16T00:00:00.000Z',
  campaignName: 'Q4 launch',
  advertiserName: 'Acme Custody',
};

describe('Advertising admin', () => {
  it('shows editors the review queue but not sales-only pages', async () => {
    mockApi.auth.me.mockResolvedValue({ user: user(['content.read_drafts', 'ads.approve']) });
    mockApi.system.ready.mockResolvedValue({ status: 'ready', checks: {} });
    mockApi.system.version.mockResolvedValue({ name: 'stocktank-api', version: '0.1.0', commit: null, node: 'v24' });
    renderApp('/');
    const nav = await screen.findByRole('navigation', { name: 'Admin' });
    expect(within(nav).getByRole('link', { name: /review queue/i })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /rate card/i })).toBeNull();
    expect(within(nav).queryByRole('link', { name: /leads/i })).toBeNull();
  });

  it('will not approve a flagged creative until every policy flag is acknowledged', async () => {
    mockApi.auth.me.mockResolvedValue({ user: user(['ads.approve']) });
    mockApi.admin.reviewQueue.mockResolvedValue({ campaigns: [], creatives: [flaggedCreative] });
    mockApi.admin.reviewCreative.mockResolvedValue({ ...flaggedCreative, reviewStatus: 'approved' });
    renderApp('/advertising/review');
    const u = userEvent.setup();

    expect(await screen.findByText('Guaranteed returns with zero risk')).toBeInTheDocument();
    expect(screen.getByText('Guaranteed returns')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Review' }));

    const dialog = await screen.findByRole('dialog');
    const approve = within(dialog).getByRole('button', { name: 'Approve' });
    expect(approve).toBeDisabled();

    await u.click(within(dialog).getByRole('checkbox', { name: 'Guaranteed returns' }));
    expect(approve).toBeDisabled();
    await u.click(within(dialog).getByRole('checkbox', { name: 'Risk-free claim' }));
    expect(approve).toBeEnabled();

    await u.click(approve);
    await waitFor(() =>
      expect(mockApi.admin.reviewCreative).toHaveBeenCalledWith('cr_1', {
        decision: 'approve',
        acknowledgedFlags: ['guaranteed_returns', 'risk_free_claim'],
      }),
    );
  });

  it('requires a reason to reject', async () => {
    mockApi.auth.me.mockResolvedValue({ user: user(['ads.approve']) });
    mockApi.admin.reviewQueue.mockResolvedValue({ campaigns: [], creatives: [flaggedCreative] });
    mockApi.admin.reviewCreative.mockResolvedValue({ ...flaggedCreative, reviewStatus: 'rejected' });
    renderApp('/advertising/review');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog');
    await u.click(within(dialog).getByRole('radio', { name: 'reject' }));
    await u.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(mockApi.admin.reviewCreative).not.toHaveBeenCalled();

    await u.type(within(dialog).getByLabelText(/reason/i), 'Unsupported return claim');
    await u.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() =>
      expect(mockApi.admin.reviewCreative).toHaveBeenCalledWith('cr_1', { decision: 'reject', notes: 'Unsupported return claim' }),
    );
  });

  it('toggles feature flags', async () => {
    mockApi.auth.me.mockResolvedValue({ user: user(['feature_flags.manage'], ['admin']) });
    mockApi.admin.listFeatureFlags.mockResolvedValue([{ key: 'advertising', enabled: false, description: 'First-party advertising' }]);
    mockApi.admin.setFeatureFlag.mockResolvedValue(undefined);
    renderApp('/system/feature-flags');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('switch', { name: 'Enable advertising' }));
    await waitFor(() => expect(mockApi.admin.setFeatureFlag).toHaveBeenCalledWith('advertising', true));
  });

  it('lists leads with attribution for sales', async () => {
    mockApi.auth.me.mockResolvedValue({ user: user(['ads.manage', 'leads.manage'], ['sales']) });
    mockApi.admin.listInquiries.mockResolvedValue({
      items: [
        {
          id: 'i_1',
          company: 'Acme Custody',
          contactName: 'Pat',
          email: 'pat@acme.example',
          website: null,
          budgetRange: 'from_5k_to_25k',
          placementKeys: ['newsletter_primary'],
          message: 'Interested',
          status: 'new',
          notes: null,
          advertiserId: null,
          utmSource: 'x',
          utmMedium: 'social',
          utmCampaign: 'launch',
          referrer: null,
          createdAt: '2026-09-16T00:00:00.000Z',
          updatedAt: '2026-09-16T00:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 100,
      total: 1,
    });
    renderApp('/growth/leads');
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Acme Custody')).toBeInTheDocument();
    expect(within(table).getByText('$5k–$25k')).toBeInTheDocument();
  });
});
