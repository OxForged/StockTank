import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { NowPlaying, RadioProvider } from '@stocktank/radio';

/** How long a now-playing snapshot is fresh; AzuraCast itself updates roughly every 15 seconds. */
const FRESH_MS = 10_000;
/** How long the last good snapshot may be served while AzuraCast is down. */
const STALE_MS = 5 * 60_000;

export interface NowPlayingResult {
  nowPlaying: NowPlaying | null;
  stale: boolean;
  error: string | null;
}

interface Entry {
  data: NowPlaying;
  storedAt: number;
}

/**
 * Caches now playing per station (Redis when available so all API instances share it, memory otherwise).
 * Many listeners polling the site cause at most one AzuraCast request per station every few seconds.
 */
export class NowPlayingService {
  private readonly memory = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<NowPlayingResult>>();

  constructor(
    private readonly provider: RadioProvider | null,
    private readonly redis: Redis | null,
    private readonly logger: Logger,
    private readonly now: () => number = Date.now,
  ) {}

  get configured(): boolean {
    return this.provider !== null;
  }

  private key(shortcode: string) {
    return `radio:nowplaying:${shortcode}`;
  }

  private async read(shortcode: string): Promise<Entry | null> {
    if (this.redis?.status === 'ready') {
      const raw = await this.redis.get(this.key(shortcode)).catch(() => null);
      if (raw) {
        try {
          return JSON.parse(raw) as Entry;
        } catch {
          return null;
        }
      }
      return null;
    }
    return this.memory.get(shortcode) ?? null;
  }

  private async write(shortcode: string, entry: Entry): Promise<void> {
    if (this.redis?.status === 'ready') {
      await this.redis.set(this.key(shortcode), JSON.stringify(entry), 'PX', STALE_MS).catch(() => undefined);
    } else {
      this.memory.set(shortcode, entry);
    }
  }

  async get(shortcode: string): Promise<NowPlayingResult> {
    if (!this.provider) return { nowPlaying: null, stale: false, error: 'AzuraCast is not configured' };
    const cached = await this.read(shortcode);
    const age = cached ? this.now() - cached.storedAt : Infinity;
    if (cached && age < FRESH_MS) return { nowPlaying: cached.data, stale: false, error: null };

    const pending = this.inflight.get(shortcode);
    if (pending) return pending;
    const provider = this.provider;
    const request = (async (): Promise<NowPlayingResult> => {
      try {
        const data = await provider.getNowPlaying(shortcode);
        await this.write(shortcode, { data, storedAt: this.now() });
        return { nowPlaying: data, stale: false, error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AzuraCast request failed';
        this.logger.warn({ err, shortcode }, 'Now playing fetch failed');
        if (cached && age < STALE_MS) return { nowPlaying: cached.data, stale: true, error: message };
        return { nowPlaying: null, stale: false, error: message };
      } finally {
        this.inflight.delete(shortcode);
      }
    })();
    this.inflight.set(shortcode, request);
    return request;
  }
}
