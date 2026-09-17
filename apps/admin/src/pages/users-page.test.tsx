import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { mockApi } from '../test/mock-api';
import { renderApp } from '../test/render';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

const admin = {
  id: 'u_admin',
  email: 'admin@example.com',
  displayName: 'Ari Admin',
  avatarUrl: null,
  roles: ['admin'],
  permissions: ['users.read', 'users.manage'],
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('UsersPage', () => {
  it('renders a row per user from admin.listUsers', async () => {
    mockApi.auth.me.mockResolvedValue({ user: admin });
    mockApi.admin.listUsers.mockResolvedValue({
      items: [
        { id: 'u_1', email: 'one@example.com', displayName: 'User One', status: 'active', roles: ['viewer'], createdAt: '2026-02-01T00:00:00.000Z', lastLoginAt: null },
        { id: 'u_2', email: 'two@example.com', displayName: 'User Two', status: 'suspended', roles: ['editor', 'creator'], createdAt: '2026-02-02T00:00:00.000Z', lastLoginAt: '2026-03-01T12:00:00.000Z' },
      ],
      page: 1,
      pageSize: 25,
      total: 2,
    });

    renderApp('/system/users');

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2 users
    expect(within(table).getByText('User One')).toBeInTheDocument();
    expect(within(table).getByText('two@example.com')).toBeInTheDocument();
    expect(within(table).getByText('suspended')).toBeInTheDocument();
    expect(within(table).getAllByRole('button', { name: /edit roles for/i })).toHaveLength(2);
    expect(mockApi.admin.listUsers).toHaveBeenCalledWith(1, 25);
  });
});
