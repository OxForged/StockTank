import { z } from 'zod';

/**
 * AzuraCast adapter (§12). StockTank renders its own live UI from these calls and never links listeners to
 * AzuraCast's own pages. Public data (stations, now playing) needs no key; station management endpoints use an
 * API key sent as `Authorization: Bearer`. Responses are parsed leniently: AzuraCast adds fields between releases.
 */

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

export const azuracastEnvSchema = z.object({
  AZURACAST_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  AZURACAST_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
});
export type AzuraCastEnv = z.infer<typeof azuracastEnvSchema>;

export interface AzuraCastConfig {
  baseUrl: string;
  apiKey: string | null;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export function azuracastConfigFromEnv(env: AzuraCastEnv): AzuraCastConfig | null {
  return env.AZURACAST_URL ? { baseUrl: env.AZURACAST_URL, apiKey: env.AZURACAST_API_KEY ?? null } : null;
}

const str = z.string().nullish().transform((v) => v ?? null);
const num = z.coerce.number().nullish().transform((v) => (v === undefined || v === null || Number.isNaN(v) ? null : v));

const mountSchema = z.looseObject({
  id: z.coerce.number().int().optional(),
  name: str,
  url: z.string(),
  bitrate: num,
  format: str,
  is_default: z.boolean().optional().default(false),
});

const stationSchema = z.looseObject({
  id: z.coerce.number().int(),
  name: z.string(),
  shortcode: z.string(),
  description: str,
  listen_url: str,
  is_public: z.boolean().optional().default(true),
  hls_enabled: z.boolean().optional().default(false),
  hls_url: str,
  mounts: z.array(mountSchema).optional().default([]),
});
export type AzuraStation = z.infer<typeof stationSchema>;

const songSchema = z.looseObject({
  id: str,
  text: str,
  artist: str,
  title: str,
  album: str,
  art: str,
});

const historyItemSchema = z.looseObject({
  sh_id: num,
  played_at: num,
  duration: num,
  playlist: str,
  streamer: str,
  is_request: z.boolean().optional().default(false),
  song: songSchema,
});

const nowPlayingSchema = z.looseObject({
  station: stationSchema,
  listeners: z.looseObject({ total: num, unique: num, current: num }).optional(),
  live: z.looseObject({ is_live: z.boolean().optional().default(false), streamer_name: str, broadcast_start: num }).optional(),
  now_playing: historyItemSchema.extend({ elapsed: num, remaining: num }).nullish(),
  playing_next: historyItemSchema.nullish(),
  song_history: z.array(historyItemSchema).optional().default([]),
  is_online: z.boolean().optional().default(false),
});
type RawNowPlaying = z.infer<typeof nowPlayingSchema>;

export interface Track {
  title: string;
  artist: string | null;
  album: string | null;
  artUrl: string | null;
  playlist: string | null;
  playedAt: string | null;
  durationSeconds: number | null;
}

export interface NowPlaying {
  stationId: number;
  shortcode: string;
  isOnline: boolean;
  listeners: number;
  live: { isLive: boolean; streamerName: string | null; startedAt: string | null };
  current: (Track & { elapsedSeconds: number | null; remainingSeconds: number | null }) | null;
  next: Track | null;
  recent: Track[];
  stream: { hlsUrl: string | null; mounts: Array<{ name: string | null; url: string; bitrate: number | null; format: string | null; isDefault: boolean }> };
  fetchedAt: string;
}

export interface StationStatus {
  backendRunning: boolean;
  frontendRunning: boolean;
}

export interface Playlist {
  id: number;
  name: string;
  isEnabled: boolean;
  type: string | null;
  songCount: number | null;
}

export class AzuraCastError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AzuraCastError';
  }
}

/** Contract from README §12. */
export interface RadioProvider {
  getStations(): Promise<AzuraStation[]>;
  getNowPlaying(station: string | number): Promise<NowPlaying>;
  /** Aggregate listener count only; individual listener records (IPs, locations) are never read. */
  getListeners(station: string | number): Promise<number>;
  getStationStatus(stationId: number): Promise<StationStatus>;
  getPlaylist(stationId: number): Promise<Playlist[]>;
  getRecentTracks(station: string | number): Promise<Track[]>;
}

const iso = (unix: number | null) => (unix ? new Date(unix * 1000).toISOString() : null);

function toTrack(item: z.infer<typeof historyItemSchema>): Track {
  const s = item.song;
  return {
    title: s.title || s.text || 'Unknown',
    artist: s.artist || null,
    album: s.album || null,
    artUrl: s.art || null,
    playlist: item.playlist || null,
    playedAt: iso(item.played_at),
    durationSeconds: item.duration,
  };
}

/** Maps AzuraCast's payload onto StockTank's shape; exported for tests and for cached payloads. */
export function mapNowPlaying(raw: RawNowPlaying, now = new Date()): NowPlaying {
  const np = raw.now_playing;
  return {
    stationId: raw.station.id,
    shortcode: raw.station.shortcode,
    isOnline: raw.is_online,
    listeners: raw.listeners?.current ?? raw.listeners?.total ?? 0,
    live: { isLive: raw.live?.is_live ?? false, streamerName: raw.live?.streamer_name ?? null, startedAt: iso(raw.live?.broadcast_start ?? null) },
    current: np ? { ...toTrack(np), elapsedSeconds: np.elapsed, remainingSeconds: np.remaining } : null,
    next: raw.playing_next ? toTrack(raw.playing_next) : null,
    recent: raw.song_history.map(toTrack),
    stream: {
      hlsUrl: raw.station.hls_enabled ? raw.station.hls_url : null,
      mounts: raw.station.mounts.map((m) => ({ name: m.name, url: m.url, bitrate: m.bitrate, format: m.format, isDefault: m.is_default })),
    },
    fetchedAt: now.toISOString(),
  };
}

export class AzuraCastAdapter implements RadioProvider {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: AzuraCastConfig) {
    this.base = config.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = config.fetch ?? fetch;
  }

  private async get<S extends z.ZodType>(path: string, schema: S, auth: boolean): Promise<z.infer<S>> {
    if (auth && !this.config.apiKey) throw new AzuraCastError('AZURACAST_API_KEY is required for station management data', 0);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}/api${path}`, {
        headers: { Accept: 'application/json', ...(auth ? { Authorization: `Bearer ${this.config.apiKey}` } : {}) },
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 8_000),
      });
    } catch (err) {
      throw new AzuraCastError(`Could not reach AzuraCast: ${err instanceof Error ? err.message : 'network error'}`, 0);
    }
    if (!res.ok) {
      const hint = res.status === 401 || res.status === 403 ? ' (check AZURACAST_API_KEY permissions)' : '';
      throw new AzuraCastError(`AzuraCast GET ${path} failed with ${res.status}${hint}`, res.status);
    }
    const parsed = schema.safeParse(await res.json().catch(() => undefined));
    if (!parsed.success) throw new AzuraCastError(`AzuraCast GET ${path} returned an unexpected response`, res.status);
    return parsed.data;
  }

  getStations(): Promise<AzuraStation[]> {
    return this.get('/stations', z.array(stationSchema), false);
  }

  async getNowPlaying(station: string | number): Promise<NowPlaying> {
    return mapNowPlaying(await this.get(`/nowplaying/${encodeURIComponent(String(station))}`, nowPlayingSchema, false));
  }

  async getListeners(station: string | number): Promise<number> {
    return (await this.getNowPlaying(station)).listeners;
  }

  async getStationStatus(stationId: number): Promise<StationStatus> {
    const raw = await this.get(`/station/${stationId}/status`, z.looseObject({ backend_running: z.boolean(), frontend_running: z.boolean() }), true);
    return { backendRunning: raw.backend_running, frontendRunning: raw.frontend_running };
  }

  async getPlaylist(stationId: number): Promise<Playlist[]> {
    const raw = await this.get(
      `/station/${stationId}/playlists`,
      z.array(z.looseObject({ id: z.coerce.number().int(), name: z.string(), is_enabled: z.boolean().optional().default(true), type: str, num_songs: num })),
      true,
    );
    return raw.map((p) => ({ id: p.id, name: p.name, isEnabled: p.is_enabled, type: p.type, songCount: p.num_songs }));
  }

  async getRecentTracks(station: string | number): Promise<Track[]> {
    return (await this.getNowPlaying(station)).recent;
  }
}
