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

const staff = (permissions: string[]) => ({
  id: 'u_1',
  email: 'admin@example.com',
  displayName: 'Admin',
  avatarUrl: null,
  roles: ['admin'],
  permissions,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const entry = (i: number, over: object = {}) => ({
  id: `a${i}`,
  action: 'content.media.upload_started',
  actor: { id: 'u_1', email: 'editor@example.com', displayName: 'Editor' },
  targetType: 'media_asset',
  targetId: `ma${i}`,
  metadata: { sizeBytes: 1000 + i },
  ipAddress: '127.0.0.1',
  requestId: `req-${i}`,
  createdAt: '2026-09-17T10:00:00.000Z',
  ...over,
});

describe('System pages', { timeout: 30_000 }, () => {
  it('filters and pages the audit log and reveals metadata on demand', async () => {
    mockApi.auth.me.mockResolvedValue({ user: staff(['audit_logs.read']) });
    mockApi.admin.system.auditLogs.mockResolvedValueOnce({ items: [entry(1)], nextCursor: 'c1' }).mockResolvedValueOnce({ items: [entry(2, { actor: null, action: 'auth.login.failure' })], nextCursor: null }).mockResolvedValue({ items: [], nextCursor: null });
    renderApp('/system/audit-logs');
    const user = userEvent.setup();

    expect(await screen.findByText('content.media.upload_started')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText(/"sizeBytes": 1001/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /load older entries/i }));
    expect(await screen.findByText('auth.login.failure')).toBeInTheDocument();
    expect(mockApi.admin.system.auditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'c1' }));
    expect(screen.queryByRole('button', { name: /load older entries/i })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Action starts with'), 'advertising');
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    await waitFor(() => expect(mockApi.admin.system.auditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'advertising', cursor: undefined })));
  });

  it('creates an API key, shows the secret once and revokes keys', async () => {
    mockApi.auth.me.mockResolvedValue({ user: staff(['api_keys.manage', 'audit_logs.read', 'content.read_drafts']) });
    const key = { id: 'k1', name: 'Reporting', prefix: 'stk_ab12cd34', scopes: ['audit_logs.read'], owner: { id: 'u_1', email: 'admin@example.com' }, lastUsedAt: null, expiresAt: '2026-12-01T00:00:00.000Z', revokedAt: null, createdAt: '2026-09-17T00:00:00.000Z' };
    mockApi.admin.system.apiKeys.mockResolvedValue([key]);
    mockApi.admin.system.createApiKey.mockResolvedValue({ key, secret: 'stk_ab12cd34_' + 'x'.repeat(43) });
    mockApi.admin.system.revokeApiKey.mockResolvedValue({ ...key, revokedAt: '2026-09-17T01:00:00.000Z' });

    renderApp('/system/api-keys');
    const user = userEvent.setup();
    expect(await screen.findByText('Reporting')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /new key/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^name/i), 'Reporting');
    // Scopes the user does not hold cannot be granted.
    expect(within(dialog).getByRole('checkbox', { name: /users\.read/ })).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox', { name: /audit_logs\.read/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Create key' }));
    await waitFor(() => expect(mockApi.admin.system.createApiKey).toHaveBeenCalledWith({ name: 'Reporting', scopes: ['audit_logs.read'], expiresInDays: 90 }));
    expect(await within(dialog).findByTestId('api-key-secret')).toHaveTextContent('stk_ab12cd34_');
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByTestId('api-key-secret')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(mockApi.admin.system.revokeApiKey).toHaveBeenCalledWith('k1'));
  });

  it('shows roles as code-managed with their permissions and user counts', async () => {
    mockApi.auth.me.mockResolvedValue({ user: staff(['roles.manage']) });
    mockApi.admin.system.roles.mockResolvedValue([
      { key: 'editor', name: 'Editor', description: 'Reviews, approves and publishes content', permissions: ['analytics.read', 'content.publish'], userCount: 2 },
      { key: 'viewer', name: 'Viewer', description: 'Standard audience account', permissions: [], userCount: 40 },
    ]);
    renderApp('/system/roles');
    expect(await screen.findByText('Editor')).toBeInTheDocument();
    expect(screen.getByText(/managed? .*in code|live in code/i)).toBeInTheDocument();
    expect(screen.getByText('content.publish')).toBeInTheDocument();
    expect(screen.getByText('40 users')).toBeInTheDocument();
    expect(screen.getByText('No staff permissions')).toBeInTheDocument();
  });
});
