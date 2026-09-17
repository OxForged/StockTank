import { ApiClientError } from '@stocktank/api-client';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockApi } from '../../test/mock-api';
import { renderApp } from '../../test/render';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

describe('LoginPage', () => {
  beforeEach(() => {
    mockApi.auth.me.mockRejectedValue(new ApiClientError(401, 'UNAUTHENTICATED', 'Not signed in'));
  });

  it('shows validation errors from the shared Zod schema and does not call the API', async () => {
    const user = userEvent.setup();
    renderApp('/login');
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('aria-invalid', 'true');
    expect(mockApi.auth.login).not.toHaveBeenCalled();
  });

  it('surfaces a 401 from the API as an invalid-credentials message', async () => {
    const user = userEvent.setup();
    mockApi.auth.login.mockRejectedValue(new ApiClientError(401, 'UNAUTHENTICATED', 'Invalid credentials'));
    renderApp('/login');
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });

    await user.type(screen.getByLabelText(/email/i), 'viewer@example.com');
    await user.type(screen.getByLabelText(/password/i), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(mockApi.auth.login).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i);
  });
});
