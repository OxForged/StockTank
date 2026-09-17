import { describe, expect, it } from 'vitest';
import { AzuraCastAdapter, AzuraCastError, azuracastConfigFromEnv, azuracastEnvSchema } from './azuracast.js';

const station = {
  id: 1,
  name: 'StockTank Radio',
  shortcode: 'stocktank_radio',
  description: 'Markets, all day.',
  listen_url: 'https://radio.test/listen/stocktank_radio/radio.mp3',
  url: 'https://stocktank.test',
  public_player_url: 'https://radio.test/public/stocktank_radio',
  is_public: true,
  hls_enabled: true,
  hls_url: 'https://radio.test/hls/stocktank_radio/live.m3u8',
  mounts: [{ id: 1, name: '128kbps MP3', url: 'https://radio.test/listen/stocktank_radio/radio.mp3', bitrate: 128, format: 'mp3', is_default: true, listeners: { current: 3 } }],
};

const nowPlaying = {
  station,
  listeners: { total: 12, unique: 9, current: 12 },
  live: { is_live: true, streamer_name: 'Desk Anchor', broadcast_start: 1789600000 },
  now_playing: {
    sh_id: 10,
    played_at: 1789600100,
    duration: 180,
    playlist: 'Market open',
    streamer: '',
    is_request: false,
    song: { id: 'abc', text: 'Anchor - Opening bell', artist: 'Anchor', title: 'Opening bell', album: '', art: 'https://radio.test/art/abc.jpg' },
    elapsed: 42,
    remaining: 138,
  },
  playing_next: { sh_id: 11, played_at: 0, duration: 60, playlist: 'Market open', song: { text: 'Sponsor break', artist: '', title: '', art: null } },
  song_history: [{ sh_id: 9, played_at: 1789599900, duration: 200, playlist: 'Pre-market', song: { text: 'Pre-market recap', artist: 'Desk', title: 'Pre-market recap', art: null } }],
  is_online: true,
  cache: 'hit',
};

function fakeFetch(routes: Record<string, { status?: number; body: unknown }>, seen: Array<{ url: string; headers: Record<string, string> }> = []): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    seen.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const route = routes[new URL(url).pathname];
    if (!route) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
  }) as typeof fetch;
}

describe('AzuraCast adapter', () => {
  it('maps now playing into StockTank’s shape without exposing AzuraCast pages', async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    const adapter = new AzuraCastAdapter({ baseUrl: 'https://radio.test/', apiKey: 'k', fetch: fakeFetch({ '/api/nowplaying/stocktank_radio': { body: nowPlaying } }, seen) });
    const np = await adapter.getNowPlaying('stocktank_radio');
    expect(np).toMatchObject({
      stationId: 1,
      isOnline: true,
      listeners: 12,
      live: { isLive: true, streamerName: 'Desk Anchor', startedAt: new Date(1789600000 * 1000).toISOString() },
      current: { title: 'Opening bell', artist: 'Anchor', album: null, artUrl: 'https://radio.test/art/abc.jpg', elapsedSeconds: 42, remainingSeconds: 138, playlist: 'Market open' },
      next: { title: 'Sponsor break', artist: null },
      recent: [{ title: 'Pre-market recap' }],
      stream: { hlsUrl: 'https://radio.test/hls/stocktank_radio/live.m3u8', mounts: [{ url: 'https://radio.test/listen/stocktank_radio/radio.mp3', bitrate: 128, isDefault: true }] },
    });
    expect(JSON.stringify(np)).not.toContain('public_player_url');
    expect(JSON.stringify(np)).not.toContain('/public/');
    // Public endpoint: no credentials sent.
    expect(seen[0]!.headers.Authorization).toBeUndefined();
    expect(await adapter.getListeners('stocktank_radio')).toBe(12);
    expect((await adapter.getRecentTracks('stocktank_radio'))[0]!.title).toBe('Pre-market recap');
  });

  it('uses the API key only for station management endpoints', async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    const adapter = new AzuraCastAdapter({
      baseUrl: 'https://radio.test',
      apiKey: 'secret-key',
      fetch: fakeFetch(
        {
          '/api/stations': { body: [station] },
          '/api/station/1/status': { body: { backend_running: true, frontend_running: false } },
          '/api/station/1/playlists': { body: [{ id: 3, name: 'Market open', is_enabled: true, type: 'default', num_songs: 42 }] },
        },
        seen,
      ),
    });
    expect((await adapter.getStations())[0]).toMatchObject({ id: 1, shortcode: 'stocktank_radio' });
    expect(await adapter.getStationStatus(1)).toEqual({ backendRunning: true, frontendRunning: false });
    expect(await adapter.getPlaylist(1)).toEqual([{ id: 3, name: 'Market open', isEnabled: true, type: 'default', songCount: 42 }]);
    expect(seen[0]!.headers.Authorization).toBeUndefined();
    expect(seen[1]!.headers.Authorization).toBe('Bearer secret-key');
  });

  it('fails clearly without a key, on errors and on unexpected payloads', async () => {
    const noKey = new AzuraCastAdapter({ baseUrl: 'https://radio.test', apiKey: null, fetch: fakeFetch({}) });
    await expect(noKey.getStationStatus(1)).rejects.toThrow(/AZURACAST_API_KEY/);
    const forbidden = new AzuraCastAdapter({ baseUrl: 'https://radio.test', apiKey: 'k', fetch: fakeFetch({ '/api/station/1/status': { status: 403, body: {} } }) });
    await expect(forbidden.getStationStatus(1)).rejects.toThrow(/403.*permissions/);
    const garbage = new AzuraCastAdapter({ baseUrl: 'https://radio.test', apiKey: null, fetch: fakeFetch({ '/api/nowplaying/x': { body: { hello: 'world' } } }) });
    const err = await garbage.getNowPlaying('x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AzuraCastError);
    expect(azuracastConfigFromEnv(azuracastEnvSchema.parse({ AZURACAST_URL: '', AZURACAST_API_KEY: '' }))).toBeNull();
    expect(azuracastConfigFromEnv(azuracastEnvSchema.parse({ AZURACAST_URL: 'https://radio.test' }))).toEqual({ baseUrl: 'https://radio.test', apiKey: null });
  });
});
