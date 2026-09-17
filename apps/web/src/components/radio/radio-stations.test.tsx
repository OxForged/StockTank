import { ApiClientError } from '@stocktank/api-client';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_HOME, mockApi } from '../../test/mock-api';
import { renderApp } from '../../test/render';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

const station = (over: object = {}) => ({
  id: 'r1',
  slug: 'stocktank-radio',
  name: 'StockTank Radio',
  description: 'Markets, all day.',
  isDemo: false,
  stale: false,
  nowPlaying: {
    isOnline: true,
    listeners: 37,
    live: { isLive: true, streamerName: 'Desk Anchor', startedAt: null },
    current: { title: 'Opening bell', artist: 'Desk Anchor', album: null, artUrl: null, playlist: null, playedAt: null, durationSeconds: 180, elapsedSeconds: 20, remainingSeconds: 160 },
    next: null,
    recent: [{ title: 'Pre-market recap', artist: null, album: null, artUrl: null, playlist: null, playedAt: null, durationSeconds: 200 }],
    stream: { hlsUrl: null, mounts: [{ name: '128kbps', url: 'https://radio.test/listen/stocktank_radio/radio.mp3', bitrate: 128, format: 'mp3', isDefault: true }] },
    fetchedAt: '2026-09-17T13:30:00.000Z',
  },
  ...over,
});

describe('StockTank Radio on /live', { timeout: 30_000 }, () => {
  beforeEach(() => {
    mockApi.auth.me.mockRejectedValue(new ApiClientError(401, 'UNAUTHENTICATED', 'Not signed in'));
    mockApi.ads.serve.mockResolvedValue({ ad: null });
    mockApi.content.home.mockResolvedValue(EMPTY_HOME);
  });

  it('shows now playing and plays the live stream in the mini player', async () => {
    mockApi.content.radioStations.mockResolvedValue([station(), station({ id: 'r2', slug: 'backup', name: 'Backup Radio', nowPlaying: null })]);
    mockApi.content.radioStation.mockResolvedValue(station());
    renderApp('/live');
    const user = userEvent.setup();

    const heading = await screen.findByRole('heading', { name: 'StockTank Radio', level: 2 });
    const section = heading.closest('section')!;
    expect(within(section).getByText('Opening bell')).toBeInTheDocument();
    expect(within(section).getByText('37 listening')).toBeInTheDocument();
    expect(within(section).getByText(/LIVE · Desk Anchor/)).toBeInTheDocument();
    expect(within(section).getByText(/unavailable right now/)).toBeInTheDocument();
    const listenButtons = within(section).getAllByRole('button', { name: /listen live/i });
    expect(listenButtons[1]).toBeDisabled();

    await user.click(listenButtons[0]!);
    const player = screen.getByRole('region', { name: 'Player' });
    expect(player.querySelector('audio')?.getAttribute('src')).toBe('https://radio.test/listen/stocktank_radio/radio.mp3');
    expect(within(player).getByText('● LIVE')).toBeInTheDocument();
    expect(within(player).queryByRole('slider', { name: 'Seek' })).not.toBeInTheDocument();
    await waitFor(() => expect(within(player).getByText('Opening bell · Desk Anchor')).toBeInTheDocument());
  });

  it('hides the radio section when no station is published', async () => {
    mockApi.content.radioStations.mockResolvedValue([]);
    renderApp('/live');
    expect(await screen.findByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
    await waitFor(() => expect(mockApi.content.radioStations).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'StockTank Radio', level: 2 })).not.toBeInTheDocument();
  });
});
