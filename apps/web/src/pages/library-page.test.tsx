import { ApiClientError } from '@stocktank/api-client';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWatchlist } from '../stores/watchlist';
import { mockApi } from '../test/mock-api';
import { renderApp } from '../test/render';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

const viewer = {
  id: 'u_1',
  email: 'viewer@example.com',
  displayName: 'Casey',
  avatarUrl: null,
  roles: ['viewer'],
  permissions: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const show = { id: 's1', slug: 'the-tank', title: 'The Tank', tagline: null, description: null, coverUrl: null, episodeCount: 1, isDemo: false };

describe('Library', () => {
  beforeEach(() => {
    localStorage.clear();
    useWatchlist.setState({ ids: [], remote: null, synced: false });
    mockApi.ads.serve.mockResolvedValue({ ad: null });
  });

  it('invites signed-out visitors to sign in and counts device-saved items', async () => {
    mockApi.auth.me.mockRejectedValue(new ApiClientError(401, 'UNAUTHENTICATED', 'Not signed in'));
    localStorage.setItem('stocktank.watchlist', JSON.stringify(['project:p1']));
    useWatchlist.setState({ ids: ['project:p1'] });
    renderApp('/library');
    expect(await screen.findByText(/sign in to keep your library everywhere/i)).toBeInTheDocument();
    expect(screen.getByText(/1 item saved on this device/i)).toBeInTheDocument();
  });

  it('moves device-saved items to the account on sign-in and unfollows through the API', async () => {
    mockApi.auth.me.mockResolvedValue({ user: viewer });
    localStorage.setItem('stocktank.watchlist', JSON.stringify(['project:p9']));
    mockApi.me.follow.mockResolvedValue(undefined);
    mockApi.me.unfollow.mockResolvedValue(undefined);
    mockApi.me.library.mockResolvedValue({ shows: [show], projects: [], companies: [], bookmarks: [] });

    renderApp('/library');
    expect(await screen.findByRole('link', { name: 'The Tank' })).toBeInTheDocument();
    await waitFor(() => expect(mockApi.me.follow).toHaveBeenCalledWith('project', 'p9'));
    await waitFor(() => expect(useWatchlist.getState().synced).toBe(true));
    expect(useWatchlist.getState().ids).toEqual(expect.arrayContaining(['show:s1', 'project:p9']));
    expect(localStorage.getItem('stocktank.watchlist')).toBe('[]');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Unfollow' }));
    await waitFor(() => expect(mockApi.me.unfollow).toHaveBeenCalledWith('show', 's1'));
  });
});
