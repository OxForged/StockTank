import { ApiClientError } from '@stocktank/api-client';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { mockApi } from '../test/mock-api';
import { renderApp } from '../test/render';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

describe('RequireAuth', () => {
  it('redirects /account to /login when me() returns 401', async () => {
    mockApi.auth.me.mockRejectedValue(new ApiClientError(401, 'UNAUTHENTICATED', 'Not signed in'));
    const { router } = renderApp('/account');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(mockApi.auth.me).toHaveBeenCalled();
  });

  it('renders the account page for a signed-in user', async () => {
    mockApi.auth.me.mockResolvedValue({
      user: {
        id: 'u_1',
        email: 'viewer@example.com',
        displayName: 'Casey Viewer',
        avatarUrl: null,
        roles: ['viewer'],
        permissions: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });
    const { router } = renderApp('/account');
    expect(await screen.findByRole('heading', { level: 1, name: 'Casey Viewer' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/account');
  });
});
