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

const viewer = {
  id: 'u_viewer',
  email: 'viewer@example.com',
  displayName: 'Casey Viewer',
  avatarUrl: null,
  roles: ['viewer'],
  permissions: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('AdminGate', () => {
  it('shows the no-access screen (with logout) for a viewer without admin permissions', async () => {
    mockApi.auth.me.mockResolvedValue({ user: viewer });
    renderApp('/');

    expect(await screen.findByText(/cannot use the control room/i)).toBeInTheDocument();
    expect(screen.getByText('viewer@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Admin' })).toBeNull();
  });

  it('redirects to /login when there is no session', async () => {
    mockApi.auth.me.mockRejectedValue(new ApiClientError(401, 'UNAUTHENTICATED', 'Not signed in'));
    const { router } = renderApp('/system/users');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByRole('heading', { name: /staff sign in/i })).toBeInTheDocument();
  });
});
