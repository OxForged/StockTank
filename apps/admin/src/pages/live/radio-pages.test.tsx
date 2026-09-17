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

const editor = {
  id: 'u_1',
  email: 'editor@example.com',
  displayName: 'Editor',
  avatarUrl: null,
  roles: ['editor'],
  permissions: ['content.read_drafts', 'content.write', 'content.publish'],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const nowPlaying = {
  isOnline: true,
  listeners: 21,
  live: { isLive: false, streamerName: null, startedAt: null },
  current: { title: 'Opening bell', artist: 'Desk', album: null, artUrl: null, playlist: null, playedAt: null, durationSeconds: 180, elapsedSeconds: 1, remainingSeconds: 179 },
  next: { title: 'Sponsor break', artist: null, album: null, artUrl: null, playlist: null, playedAt: null, durationSeconds: 30 },
  recent: [],
  stream: { hlsUrl: null, mounts: [] },
  fetchedAt: '2026-09-17T13:30:00.000Z',
};

const station = (over: object = {}) => ({
  id: 'r1',
  slug: 'stocktank-radio',
  name: 'StockTank Radio',
  description: null,
  azuracastShortcode: 'stocktank_radio',
  status: 'published',
  sortOrder: 0,
  isDemo: false,
  updatedAt: '2026-09-17T00:00:00.000Z',
  nowPlaying,
  error: null,
  ...over,
});

describe('Live radio admin', { timeout: 30_000 }, () => {
  it('creates a station from the AzuraCast station list', async () => {
    mockApi.auth.me.mockResolvedValue({ user: editor });
    mockApi.admin.radio.status.mockResolvedValue({ azuracastConfigured: true, apiKeyConfigured: false });
    mockApi.admin.radio.listStations.mockResolvedValue([station({ id: 'r0', name: 'Old', slug: 'old', azuracastShortcode: 'old', nowPlaying: null, error: 'Could not reach AzuraCast: timeout' })]);
    mockApi.admin.radio.azuracastStations.mockResolvedValue([{ id: 1, name: 'StockTank Radio', shortcode: 'stocktank_radio', isPublic: true }]);
    mockApi.admin.radio.saveStation.mockResolvedValue(station());

    renderApp('/live/stations');
    const user = userEvent.setup();
    expect(await screen.findByText('Could not reach AzuraCast: timeout')).toBeInTheDocument();
    expect(screen.getByText(/Set AZURACAST_API_KEY/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /new station/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^name/i), 'StockTank Radio');
    await within(dialog).findByRole('option', { name: 'StockTank Radio (stocktank_radio)' });
    await user.selectOptions(within(dialog).getByLabelText(/azuracast station/i), 'stocktank_radio');
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'published');
    await user.click(within(dialog).getByRole('button', { name: 'Create station' }));
    await waitFor(() =>
      expect(mockApi.admin.radio.saveStation).toHaveBeenCalledWith(
        { name: 'StockTank Radio', slug: undefined, description: null, azuracastShortcode: 'stocktank_radio', status: 'published', sortOrder: 0 },
        undefined,
      ),
    );
  });

  it('shows station health, now playing and management errors', async () => {
    mockApi.auth.me.mockResolvedValue({ user: editor });
    mockApi.admin.radio.status.mockResolvedValue({ azuracastConfigured: true, apiKeyConfigured: true });
    mockApi.admin.radio.listStations.mockResolvedValue([station()]);
    mockApi.admin.radio.station.mockResolvedValue({
      station: station(),
      status: { backendRunning: true, frontendRunning: false },
      playlists: [{ id: 3, name: 'Market open', isEnabled: true, type: 'default', songCount: 42 }],
      managementError: null,
    });
    renderApp('/live/now-playing');
    expect(await screen.findByText('Opening bell · Desk')).toBeInTheDocument();
    expect(screen.getByText('Sponsor break')).toBeInTheDocument();
    expect(await screen.findByText('AutoDJ running')).toBeInTheDocument();
    expect(screen.getByText('Stream stopped')).toBeInTheDocument();
    expect(screen.getByText(/Market open · 42/)).toBeInTheDocument();
  });
});
