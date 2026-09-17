import { ApiClientError } from '@stocktank/api-client';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockApi } from '../../test/mock-api';
import { renderApp } from '../../test/render';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

describe('HomePage', () => {
  beforeEach(() => {
    mockApi.auth.me.mockRejectedValue(new ApiClientError(401, 'UNAUTHENTICATED', 'Not signed in'));
  });

  it('renders the editorial sections from README §5', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: /stocktank/i })).toBeInTheDocument();
    for (const name of [
      'Tonight on StockTank',
      'On air',
      'Fresh from the studio',
      'Moments worth sharing',
      'On-chain projects',
      'Public companies',
      'Voices of the network',
      'Newsroom',
      'On the schedule',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
  });

  it('shows the standing disclaimer and no fabricated market data', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByText(/not financial or investment advice/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: /market ticker/i })).toHaveTextContent(/connects in a later release/i);
  });
});
