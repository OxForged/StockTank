import { describe, expect, it } from 'vitest';
import { CastopodAdapter, CastopodError, CastopodUnsupportedError, castopodConfigFromEnv, castopodEnvSchema, castopodSlug } from './castopod.js';
import { FINANCIAL_DISCLAIMER, buildPodcastFeed, itunesDuration, podcastGuid, type FeedEpisode, type FeedShow } from './rss.js';

const show: FeedShow = {
  slug: 'the-tank',
  title: 'The Tank',
  description: 'Founders pitch. Panel asks <hard> questions & more.',
  author: 'StockTank',
  coverUrl: 'https://cdn.example/cover.jpg',
  language: 'en',
  category: 'Business',
  subcategory: 'Investing',
  explicit: false,
  isDemo: false,
  link: 'https://stocktank.tv/shows/the-tank',
  feedUrl: 'https://stocktank.tv/api/v1/podcasts/the-tank/feed.xml',
  ownerName: 'StockTank',
  ownerEmail: 'podcasts@stocktank.tv',
  copyright: '© 2026 StockTank',
};

const episode: FeedEpisode = {
  id: 'e1',
  title: 'Treasuries on-chain',
  summary: 'Why "T-bills" moved on-chain.',
  description: 'Notes\u0007 with a control char',
  link: 'https://stocktank.tv/shows/the-tank/treasuries',
  publishedAt: new Date('2026-09-16T10:00:00Z'),
  durationSeconds: 3725,
  number: 7,
  type: 'full',
  audioUrl: 'https://cdn.example/renditions/a/audio.mp3?x=1&y=2',
  audioBytes: 44_123_456,
  imageUrl: null,
  isDemo: false,
};

describe('podcast RSS', () => {
  it('builds an Apple / Podcasting 2.0 feed with enclosures and disclaimers', () => {
    const xml = buildPodcastFeed(show, [episode]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<itunes:category text="Business"><itunes:category text="Investing"/></itunes:category>');
    expect(xml).toContain('<enclosure url="https://cdn.example/renditions/a/audio.mp3?x=1&amp;y=2" length="44123456" type="audio/mpeg"/>');
    expect(xml).toContain('<guid isPermaLink="false">stocktank:episode:e1</guid>');
    expect(xml).toContain('<itunes:duration>01:02:05</itunes:duration>');
    expect(xml).toContain('<itunes:episode>7</itunes:episode>');
    expect(xml).toContain('<pubDate>Wed, 16 Sep 2026 10:00:00 GMT</pubDate>');
    expect(xml).toContain('Panel asks &lt;hard&gt; questions &amp; more.');
    expect(xml).toContain(FINANCIAL_DISCLAIMER);
    expect(xml).toContain('<podcast:locked owner="podcasts@stocktank.tv">yes</podcast:locked>');
    expect(xml).toContain('<atom:link href="https://stocktank.tv/api/v1/podcasts/the-tank/feed.xml" rel="self"');
    expect(xml).not.toContain('\u0007');
    expect(xml).not.toContain('itunes:block');
    // Balanced core elements.
    expect(xml.match(/<item>/g)).toHaveLength(1);
    expect(xml.match(/<\/item>/g)).toHaveLength(1);
    expect(xml.trim().endsWith('</rss>')).toBe(true);
  });

  it('labels demo feeds and blocks them from directories', () => {
    const xml = buildPodcastFeed({ ...show, isDemo: true }, [{ ...episode, isDemo: true }]);
    expect(xml).toContain('<title>The Tank (DEMO)</title>');
    expect(xml).toContain('<title>Treasuries on-chain (DEMO)</title>');
    expect(xml).toContain('<itunes:block>Yes</itunes:block>');
  });

  it('computes the Podcasting 2.0 guid per the spec', () => {
    // Example from the podcast namespace spec.
    expect(podcastGuid('https://mp3s.nashownotes.com/pc20rss.xml')).toBe('917393e3-1b1e-5cef-ace4-edaa54e1f810');
    expect(podcastGuid('mp3s.nashownotes.com/pc20rss.xml/')).toBe('917393e3-1b1e-5cef-ace4-edaa54e1f810');
    expect(itunesDuration(59.6)).toBe('00:01:00');
  });
});

describe('Castopod adapter', () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const respond = (routes: Record<string, { status?: number; body: unknown }>): typeof fetch =>
    (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init: init ?? {} });
      const key = `${init?.method ?? 'GET'} ${new URL(url).pathname}`;
      const route = routes[key];
      if (!route) return new Response('not found', { status: 404 });
      return new Response(JSON.stringify(route.body), { status: route.status ?? 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

  const config = (f: typeof fetch) => ({ baseUrl: 'https://pods.example/', username: 'api', password: 's3cret', userId: 3, fetch: f });

  it('reads podcasts with BasicAuth and derives the feed URL', async () => {
    calls.length = 0;
    const adapter = new CastopodAdapter(config(respond({ 'GET /api/rest/v1/podcasts': { body: [{ id: 2, handle: 'thetank', title: 'The Tank', extra: true }] } })));
    const podcasts = await adapter.getPodcasts();
    expect(podcasts).toEqual([expect.objectContaining({ id: 2, handle: 'thetank', feedUrl: 'https://pods.example/@thetank/feed.xml' })]);
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('api:s3cret').toString('base64')}`);
  });

  it('creates an episode with its audio then publishes it', async () => {
    calls.length = 0;
    const adapter = new CastopodAdapter(
      config(
        respond({
          'POST /api/rest/v1/episodes': { body: { id: 41, podcast_id: 2, title: 'Treasuries', slug: 'treasuries-on-chain' } },
          'POST /api/rest/v1/episodes/41/publish': { body: { id: 41, podcast_id: 2, title: 'Treasuries', slug: 'treasuries-on-chain' } },
        }),
      ),
    );
    const result = await adapter.publishEpisode({
      podcastId: 2,
      title: 'Treasuries',
      slug: 'Treasuries On-Chain!',
      description: 'Notes',
      type: 'full',
      episodeNumber: 7,
      explicit: false,
      audio: new Blob(['ID3'], { type: 'audio/mpeg' }),
      audioFilename: 'treasuries.mp3',
    });
    expect(result).toEqual({ episodeId: 41 });
    const create = calls[0]!.init.body as FormData;
    expect(Object.fromEntries([...create.entries()].filter(([k]) => k !== 'audio_file'))).toEqual({
      created_by: '3',
      updated_by: '3',
      podcast_id: '2',
      title: 'Treasuries',
      slug: 'treasuries-on-chain',
      description: 'Notes',
      type: 'full',
      parental_advisory: 'clean',
      episode_number: '7',
    });
    expect((create.get('audio_file') as File).name).toBe('treasuries.mp3');
    expect((calls[1]!.init.body as FormData).get('publication_method')).toBe('now');
  });

  it('surfaces Castopod validation errors and refuses unsupported operations honestly', async () => {
    const adapter = new CastopodAdapter(config(respond({ 'POST /api/rest/v1/episodes': { status: 400, body: { messages: { slug: 'The slug field must be unique.' } } } })));
    const err = await adapter
      .publishEpisode({ podcastId: 2, title: 't', slug: 't', description: '', type: 'full', episodeNumber: null, explicit: true, audio: new Blob(['x']), audioFilename: 'a.mp3' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CastopodError);
    expect((err as CastopodError).message).toContain('The slug field must be unique.');
    await expect(adapter.createPodcast()).rejects.toBeInstanceOf(CastopodUnsupportedError);
    await expect(adapter.updateEpisode()).rejects.toBeInstanceOf(CastopodUnsupportedError);
    const unauthorized = new CastopodAdapter(config(respond({ 'GET /api/rest/v1/podcasts/9': { status: 401, body: {} } })));
    await expect(unauthorized.getPodcast(9)).rejects.toThrow(/CASTOPOD_API_USERNAME/);
  });

  it('is configured only when every setting is present', () => {
    expect(castopodConfigFromEnv(castopodEnvSchema.parse({ CASTOPOD_URL: 'https://pods.example' }))).toBeNull();
    expect(
      castopodConfigFromEnv(castopodEnvSchema.parse({ CASTOPOD_URL: 'https://pods.example', CASTOPOD_API_USERNAME: 'a', CASTOPOD_API_PASSWORD: 'b', CASTOPOD_USER_ID: '1' })),
    ).toMatchObject({ userId: 1 });
    expect(castopodSlug('Épisode 7: Déjà vu')).toBe('episode-7-deja-vu');
  });
});
