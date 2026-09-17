import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MediaJob } from '@stocktank/media';
import { CastopodError, type CastopodPodcast, type PodcastHostAdapter } from '@stocktank/podcast';
import { adminPodcastEpisodeListSchema, adminPodcastShowListSchema, adminPodcastShowSchema, showDetailResponseSchema } from '@stocktank/types';
import type { MediaService } from '../src/lib/media.js';
import { CSRF_HEADERS, createTestContext, loginAs, resetContent, resetDb, seedUser, type TestContext } from './helpers.js';

describe('podcast feeds and Castopod distribution', () => {
  let ctx: TestContext;
  let editor: string;
  let creator: string;
  let showId: string;
  let episodeId: string;
  const jobs: MediaJob[] = [];
  const heads: string[] = [];

  const media: MediaService = {
    storage: {
      presignUpload: () => Promise.resolve(''),
      head: (key: string) => {
        heads.push(key);
        return Promise.resolve({ size: 777, contentType: 'audio/mpeg' });
      },
      download: () => Promise.resolve(),
      uploadFile: () => Promise.resolve(),
      uploadDirectory: () => Promise.resolve(0),
      delete: () => Promise.resolve(),
      publicUrl: (k: string) => `https://cdn.test/${k}`,
    },
    queue: {
      enqueue: (job) => {
        jobs.push(job);
        return Promise.resolve();
      },
      close: () => Promise.resolve(),
    },
    maxUploadBytes: 1024,
    publicUrl: (key) => (key ? `https://cdn.test/${key}` : null),
  };

  const podcasts: CastopodPodcast[] = [{ id: 5, handle: 'thetank', title: 'The Tank', feedUrl: 'https://pods.test/@thetank/feed.xml' }];
  const podcastHost = {
    getPodcasts: () => Promise.resolve(podcasts),
    getPodcast: (id: number) => {
      const found = podcasts.find((p) => p.id === id);
      return found ? Promise.resolve(found) : Promise.reject(new CastopodError('Castopod GET /podcasts/x failed with 404', 404));
    },
  } as unknown as PodcastHostAdapter;

  const as = (cookie: string) => ({
    get: (url: string) => request(ctx.app).get(url).set('Cookie', cookie),
    post: (url: string, body: object = {}) => request(ctx.app).post(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body),
    put: (url: string, body: object) => request(ctx.app).put(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body),
  });
  const P = '/api/v1/admin/podcasts';
  const settings = { podcastEnabled: true, podcastAuthor: 'StockTank Studios', podcastCategory: 'Business', podcastSubcategory: 'Investing', podcastExplicit: false, podcastLanguage: 'en' };

  beforeAll(async () => {
    ctx = await createTestContext({ redis: false, media, podcastHost, envOverrides: { PUBLIC_WEB_URL: 'https://stocktank.test', PODCAST_OWNER_EMAIL: 'pods@stocktank.test' } });
  });
  beforeEach(async () => {
    jobs.length = 0;
    heads.length = 0;
    await resetContent(ctx.prisma);
    await resetDb(ctx.prisma);
    await seedUser(ctx.prisma, { email: 'editor@example.com', roles: ['editor'] });
    await seedUser(ctx.prisma, { email: 'creator@example.com', roles: ['creator'] });
    editor = await loginAs(ctx.app, 'editor@example.com');
    creator = await loginAs(ctx.app, 'creator@example.com');
    const show = await ctx.prisma.show.create({
      data: { slug: 'the-tank', title: 'The Tank & Co', description: 'Founders pitch.', coverUrl: 'https://cdn.test/cover.jpg', status: 'published' },
    });
    showId = show.id;
    const asset = await ctx.prisma.mediaAsset.create({
      data: {
        kind: 'audio',
        status: 'ready',
        originalKey: 'originals/a1/source.mp3',
        originalName: 'ep.mp3',
        mimeType: 'audio/mpeg',
        sizeBytes: 10n,
        durationSeconds: 1805,
        renditions: { hls: null, audio: 'renditions/a1/audio.mp3', audioBytes: 12345, poster: null, variants: [] },
      },
    });
    const episode = await ctx.prisma.episode.create({
      data: { showId, slug: 'ep-1', title: 'Episode One', number: 1, status: 'published', publishedAt: new Date('2026-09-01T12:00:00Z'), mediaAssetId: asset.id },
    });
    episodeId = episode.id;
    // Published but no media: must not appear in the feed.
    await ctx.prisma.episode.create({ data: { showId, slug: 'ep-2', title: 'No audio yet', status: 'published', publishedAt: new Date('2026-09-02T12:00:00Z') } });
  });
  afterAll(async () => {
    await resetContent(ctx.prisma);
    await resetDb(ctx.prisma);
    await ctx.close();
  });

  it('serves no feed until the show enables it, then a valid feed with only playable episodes', async () => {
    expect((await request(ctx.app).get('/podcasts/the-tank/feed.xml')).status).toBe(404);
    expect(showDetailResponseSchema.parse((await request(ctx.app).get('/api/v1/shows/the-tank')).body).podcast).toBeNull();

    // Creators cannot change distribution settings.
    expect((await as(creator).put(`${P}/shows/${showId}`, settings)).status).toBe(403);
    const saved = await as(editor).put(`${P}/shows/${showId}`, settings);
    expect(saved.status).toBe(200);
    expect(adminPodcastShowSchema.parse(saved.body)).toMatchObject({
      feedUrl: 'https://stocktank.test/podcasts/the-tank/feed.xml',
      publishedEpisodes: 2,
      feedEpisodes: 1,
      warnings: [],
    });

    const feed = await request(ctx.app).get('/podcasts/the-tank/feed.xml');
    expect(feed.status).toBe(200);
    expect(feed.headers['content-type']).toMatch(/application\/rss\+xml/);
    expect(feed.text).toContain('<title>The Tank &amp; Co</title>');
    expect(feed.text).toContain('<enclosure url="https://cdn.test/renditions/a1/audio.mp3" length="12345" type="audio/mpeg"/>');
    expect(feed.text).toContain('<itunes:duration>00:30:05</itunes:duration>');
    expect(feed.text).toContain('<itunes:email>pods@stocktank.test</itunes:email>');
    expect(feed.text).not.toContain('No audio yet');
    expect(heads).toHaveLength(0);
    // Same feed under the versioned API path.
    expect((await request(ctx.app).get('/api/v1/podcasts/the-tank/feed.xml')).text).toBe(feed.text);

    expect(showDetailResponseSchema.parse((await request(ctx.app).get('/api/v1/shows/the-tank')).body).podcast).toEqual({
      feedUrl: 'https://stocktank.test/podcasts/the-tank/feed.xml',
    });
  });

  it('falls back to storage for older assets without a recorded MP3 size', async () => {
    await as(editor).put(`${P}/shows/${showId}`, settings);
    await ctx.prisma.mediaAsset.updateMany({ data: { renditions: { hls: null, audio: 'renditions/a1/audio.mp3', poster: null, variants: [] } } });
    const feed = await request(ctx.app).get('/podcasts/the-tank/feed.xml');
    expect(feed.text).toContain('length="777"');
    expect(heads).toEqual(['renditions/a1/audio.mp3']);
  });

  it('validates settings and warns about directory requirements', async () => {
    expect((await as(editor).put(`${P}/shows/${showId}`, { ...settings, podcastCategory: null })).status).toBe(400);
    expect((await as(editor).put(`${P}/shows/${showId}`, { ...settings, podcastSubcategory: 'Daily News' })).status).toBe(400);
    expect((await as(editor).put(`${P}/shows/${showId}`, { ...settings, castopodPodcastId: 99 })).status).toBe(400);

    await ctx.prisma.show.update({ where: { id: showId }, data: { coverUrl: null, isDemo: true } });
    const list = adminPodcastShowListSchema.parse((await as(editor).get(`${P}/shows`)).body);
    expect(list.items).toHaveLength(1);
    // Not enabled yet: no warnings.
    expect(list.items[0]!.warnings).toEqual([]);
    const enabled = adminPodcastShowSchema.parse((await as(editor).put(`${P}/shows/${showId}`, settings)).body);
    expect(enabled.warnings.join(' ')).toMatch(/cover art/);
    expect(enabled.warnings.join(' ')).toMatch(/DEMO/);
    const demoFeed = await request(ctx.app).get('/podcasts/the-tank/feed.xml');
    expect(demoFeed.text).toContain('<itunes:block>Yes</itunes:block>');
  });

  it('queues one Castopod sync per episode with clear preconditions', async () => {
    expect((await as(editor).post(`${P}/episodes/${episodeId}/castopod`)).status).toBe(409); // show not linked

    const linked = await as(editor).put(`${P}/shows/${showId}`, { ...settings, castopodPodcastId: 5 });
    expect(linked.body.castopodPodcastId).toBe(5);
    const options = await as(editor).get(`${P}/castopod/podcasts`);
    expect(options.body.items).toEqual([{ id: 5, handle: 'thetank', title: 'The Tank', feedUrl: 'https://pods.test/@thetank/feed.xml' }]);

    expect((await as(creator).post(`${P}/episodes/${episodeId}/castopod`)).status).toBe(403);
    const queued = await as(editor).post(`${P}/episodes/${episodeId}/castopod`);
    expect(queued.status).toBe(202);
    expect(queued.body).toMatchObject({ podcastSyncStatus: 'queued', inFeed: true, hasAudio: true });
    expect(jobs).toEqual([{ type: 'podcast-sync', episodeId }]);
    expect((await as(editor).post(`${P}/episodes/${episodeId}/castopod`)).status).toBe(409);

    await ctx.prisma.episode.update({ where: { id: episodeId }, data: { podcastSyncStatus: 'synced', castopodEpisodeId: 41 } });
    const again = await as(editor).post(`${P}/episodes/${episodeId}/castopod`);
    expect(again.status).toBe(409);
    expect(again.body.error.message).toMatch(/already on Castopod/);

    const noAudio = await ctx.prisma.episode.findFirstOrThrow({ where: { slug: 'ep-2' } });
    const refused = await as(editor).post(`${P}/episodes/${noAudio.id}/castopod`);
    expect(refused.body.error.message).toMatch(/no processed audio/);

    const episodes = adminPodcastEpisodeListSchema.parse((await as(editor).get(`${P}/shows/${showId}/episodes`)).body);
    expect(episodes.items.map((e) => [e.slug, e.inFeed])).toEqual([
      ['ep-2', false],
      ['ep-1', true],
    ]);

    const typed = await as(editor).put(`${P}/episodes/${episodeId}/type`, { episodeType: 'bonus' });
    expect(typed.body.episodeType).toBe('bonus');
    expect((await request(ctx.app).get('/podcasts/the-tank/feed.xml')).text).toContain('<itunes:episodeType>bonus</itunes:episodeType>');

    const audit = await ctx.prisma.auditLog.findMany({ where: { action: { startsWith: 'content.podcast.' } } });
    expect(audit.map((a) => a.action).sort()).toEqual(['content.podcast.castopod.queue', 'content.podcast.episode_type.update', 'content.podcast.settings.update'].sort());
  });

  it('reports Castopod as unavailable when not configured', async () => {
    const bare = await createTestContext({ redis: false, media, podcastHost: null });
    try {
      await seedUser(bare.prisma, { email: 'editor2@example.com', roles: ['editor'] });
      const cookie = await loginAs(bare.app, 'editor2@example.com');
      const status = await request(bare.app).get(`${P}/status`).set('Cookie', cookie);
      expect(status.body).toEqual({ castopodConfigured: false, queueConfigured: true, ownerEmailConfigured: expect.any(Boolean) });
      expect((await request(bare.app).get(`${P}/castopod/podcasts`).set('Cookie', cookie)).status).toBe(503);
      expect((await request(bare.app).post(`${P}/episodes/${episodeId}/castopod`).set('Cookie', cookie).set(CSRF_HEADERS)).status).toBe(503);
    } finally {
      await bare.close();
    }
  });
});
