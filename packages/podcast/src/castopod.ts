import { z } from 'zod';

/**
 * Castopod adapter (§11). Talks to Castopod's REST API v1 (`restapi.enabled=true`, BasicAuth for writes).
 * StockTank never reads Castopod's database and the site never depends on Castopod being up.
 *
 * Castopod's REST API v1 can list/get podcasts and episodes, create an episode (multipart with the audio file)
 * and publish it. It cannot create or update podcasts, or update episodes: those methods exist here to satisfy
 * the adapter contract and fail with `CastopodUnsupportedError` instead of pretending.
 */

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

export const castopodEnvSchema = z.object({
  CASTOPOD_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  CASTOPOD_API_USERNAME: z.preprocess(emptyToUndefined, z.string().optional()),
  CASTOPOD_API_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
  /** Castopod user id recorded as created_by/updated_by on synced episodes. */
  CASTOPOD_USER_ID: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
});
export type CastopodEnv = z.infer<typeof castopodEnvSchema>;

export interface CastopodConfig {
  baseUrl: string;
  username: string;
  password: string;
  userId: number;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export function castopodConfigFromEnv(env: CastopodEnv): CastopodConfig | null {
  if (!env.CASTOPOD_URL || !env.CASTOPOD_API_USERNAME || !env.CASTOPOD_API_PASSWORD || !env.CASTOPOD_USER_ID) return null;
  return { baseUrl: env.CASTOPOD_URL, username: env.CASTOPOD_API_USERNAME, password: env.CASTOPOD_API_PASSWORD, userId: env.CASTOPOD_USER_ID };
}

const castopodPodcastSchema = z.looseObject({
  id: z.coerce.number().int(),
  handle: z.string(),
  title: z.string(),
});
export type CastopodPodcast = z.infer<typeof castopodPodcastSchema> & { feedUrl: string };

const castopodEpisodeSchema = z.looseObject({
  id: z.coerce.number().int(),
  podcast_id: z.coerce.number().int(),
  title: z.string(),
  slug: z.string(),
  published_at: z.unknown().optional(),
});
export type CastopodEpisode = z.infer<typeof castopodEpisodeSchema>;

export class CastopodError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CastopodError';
  }
}

export class CastopodUnsupportedError extends Error {
  constructor(operation: string) {
    super(`Castopod's REST API v1 does not support ${operation}. Do this in the Castopod admin, then link it in StockTank.`);
    this.name = 'CastopodUnsupportedError';
  }
}

export interface PublishEpisodeInput {
  podcastId: number;
  title: string;
  slug: string;
  description: string;
  type: 'full' | 'trailer' | 'bonus';
  episodeNumber: number | null;
  explicit: boolean;
  audio: Blob;
  audioFilename: string;
}

/** The provider-neutral contract from README §11. */
export interface PodcastHostAdapter {
  getPodcasts(): Promise<CastopodPodcast[]>;
  getPodcast(id: number): Promise<CastopodPodcast>;
  createPodcast(): Promise<never>;
  updatePodcast(): Promise<never>;
  getEpisode(id: number): Promise<CastopodEpisode>;
  /** Creates the episode with its audio, then publishes it immediately. Returns the Castopod episode id. */
  publishEpisode(input: PublishEpisodeInput): Promise<{ episodeId: number }>;
  updateEpisode(): Promise<never>;
  getRSSFeed(podcastId: number): Promise<string>;
}

/** Castopod expects a lowercase slug of at most 128 characters. */
export function castopodSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 128) || 'episode'
  );
}

export class CastopodAdapter implements PodcastHostAdapter {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: CastopodConfig) {
    this.base = config.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = config.fetch ?? fetch;
  }

  private get authHeader() {
    return `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`;
  }

  private async call<S extends z.ZodType>(method: 'GET' | 'POST', path: string, schema: S, body?: FormData, timeoutMs?: number): Promise<z.infer<S>> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}/api/rest/v1${path}`, {
        method,
        headers: { Accept: 'application/json', Authorization: this.authHeader },
        body,
        signal: AbortSignal.timeout(timeoutMs ?? this.config.timeoutMs ?? 30_000),
      });
    } catch (err) {
      throw new CastopodError(`Could not reach Castopod: ${err instanceof Error ? err.message : 'network error'}`, 0);
    }
    const raw = await res.text();
    if (!res.ok) {
      let detail: string;
      try {
        const parsed = JSON.parse(raw) as { messages?: Record<string, string>; message?: string };
        detail = parsed.messages ? Object.values(parsed.messages).join('; ') : (parsed.message ?? '');
      } catch {
        detail = '';
      }
      const hint = res.status === 401 ? ' (check CASTOPOD_API_USERNAME/PASSWORD and restapi.basicAuth)' : res.status === 404 ? ' (is restapi.enabled=true?)' : '';
      throw new CastopodError(`Castopod ${method} ${path} failed with ${res.status}${detail ? `: ${detail}` : ''}${hint}`.slice(0, 500), res.status);
    }
    try {
      return schema.parse(JSON.parse(raw));
    } catch {
      throw new CastopodError(`Castopod ${method} ${path} returned an unexpected response`, res.status);
    }
  }

  private withFeed(p: z.infer<typeof castopodPodcastSchema>): CastopodPodcast {
    return { ...p, feedUrl: `${this.base}/@${p.handle}/feed.xml` };
  }

  async getPodcasts(): Promise<CastopodPodcast[]> {
    return (await this.call('GET', '/podcasts', z.array(castopodPodcastSchema))).map((p) => this.withFeed(p));
  }

  async getPodcast(id: number): Promise<CastopodPodcast> {
    return this.withFeed(await this.call('GET', `/podcasts/${id}`, castopodPodcastSchema));
  }

  createPodcast(): Promise<never> {
    return Promise.reject(new CastopodUnsupportedError('creating podcasts'));
  }

  updatePodcast(): Promise<never> {
    return Promise.reject(new CastopodUnsupportedError('updating podcasts'));
  }

  getEpisode(id: number): Promise<CastopodEpisode> {
    return this.call('GET', `/episodes/${id}`, castopodEpisodeSchema);
  }

  async publishEpisode(input: PublishEpisodeInput): Promise<{ episodeId: number }> {
    const form = new FormData();
    const user = String(this.config.userId);
    form.set('created_by', user);
    form.set('updated_by', user);
    form.set('podcast_id', String(input.podcastId));
    form.set('title', input.title);
    form.set('slug', castopodSlug(input.slug));
    form.set('description', input.description);
    form.set('type', input.type);
    form.set('parental_advisory', input.explicit ? 'explicit' : 'clean');
    if (input.episodeNumber !== null) form.set('episode_number', String(input.episodeNumber));
    form.set('audio_file', input.audio, input.audioFilename);
    // Uploads can be large; allow up to 30 minutes.
    const created = await this.call('POST', '/episodes', castopodEpisodeSchema, form, 30 * 60_000);

    const publish = new FormData();
    publish.set('publication_method', 'now');
    publish.set('created_by', user);
    publish.set('client_timezone', 'UTC');
    await this.call('POST', `/episodes/${created.id}/publish`, castopodEpisodeSchema, publish);
    return { episodeId: created.id };
  }

  updateEpisode(): Promise<never> {
    return Promise.reject(new CastopodUnsupportedError('updating episodes'));
  }

  async getRSSFeed(podcastId: number): Promise<string> {
    return (await this.getPodcast(podcastId)).feedUrl;
  }
}
