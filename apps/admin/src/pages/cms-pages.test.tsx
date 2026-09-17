import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  email: 'writer@example.com',
  displayName: 'Writer',
  avatarUrl: null,
  roles: ['creator'],
  permissions,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const show = {
  id: 's_1',
  slug: 'the-tank',
  title: 'The Tank',
  tagline: 'Founders pitch.',
  description: null,
  coverUrl: null,
  episodeCount: 6,
  isDemo: true,
  status: 'published',
  updatedAt: '2026-09-16T00:00:00.000Z',
};

describe('CMS: shows', () => {
  it('lets writers draft or submit for review only, and never edit a published show', async () => {
    mockApi.auth.me.mockResolvedValue({ user: staff(['content.read_drafts', 'content.write']) });
    mockApi.admin.content.listShows.mockResolvedValue({ items: [show], page: 1, pageSize: 100, total: 1 });
    mockApi.admin.content.saveShow.mockResolvedValue({ ...show, id: 's_2', title: 'Market Open', status: 'review' });
    renderApp('/network/shows');
    const u = userEvent.setup();

    const table = await screen.findByRole('table');
    expect(within(table).getByText('The Tank')).toBeInTheDocument();
    expect(within(table).getByText('demo')).toBeInTheDocument();

    await u.click(within(table).getByRole('button', { name: 'Edit' }));
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    await u.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await u.click(screen.getByRole('button', { name: /new show/i }));
    dialog = await screen.findByRole('dialog');
    const statusSelect = within(dialog).getByLabelText('Status');
    expect(within(statusSelect).getAllByRole('option').map((o) => o.textContent)).toEqual(['draft', 'review']);

    await u.type(within(dialog).getByLabelText(/^title/i), 'Market Open');
    await u.selectOptions(statusSelect, 'review');
    await u.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mockApi.admin.content.saveShow).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Market Open', slug: undefined, status: 'review', tagline: null }),
        undefined,
      ),
    );
  });
});
