import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { audienceAnalyticsSchema, contentAnalyticsSchema, projectAnalyticsSchema, showAnalyticsSchema } from '@stocktank/types';
import type { MediaService } from '../src/lib/media.js';
import { resolveRange } from '../src/routes/admin-analytics.js';
import { CSRF_HEADERS, createTestContext, loginAs, resetContent, resetDb, seedUser, type TestContext } from './helpers.js';

const media: MediaService = {
  storage: null,
  queue: null,
  maxUploadBytes: 1,
  publicUrl: (key) => (key ? `https://cdn.test/${key}` : null),
};

describe('first-party analytics', () => {
  let ctx: TestContext;
  let editor: string;
  let showId: string;
  let episodeId: string;
  let projectId: string;
  let clipId: string;

  beforeAll(async () => {
    ctx = await createTestContext({ redis: false, media, envOverrides: { PUBLIC_WEB_URL: 'https://stocktank.test' } });
  });
  beforeEach(async () => {
    await resetContent(ctx.prisma);
    await resetDb(ctx.prisma);
    await seedUser(ctx.prisma, { email: 'editor@example.com', roles: ['editor'] });
    await seedUser(ctx.prisma, { email: 'creator@example.com', roles: ['creator'] });
    editor = await loginAs(ctx.app, 'editor@example.com');
    const show = await ctx.prisma.show.create({ data: { slug: 'the-tank', title: 'The Tank', status: 'published' } });
    showId = show.id;
    const asset = await ctx.prisma.mediaAsset.create({
      data: { kind: 'audio', status: 'ready', originalKey: 'originals/x/source.mp3', originalName: 'x.mp3', mimeType: 'audio/mpeg', sizeBytes: 1n, renditions: { hls: null, audio: 'renditions/x/audio.mp3', poster: null, variants: [] } },
    });
    const episode = await ctx.prisma.episode.create({ data: { showId, slug: 'ep', title: 'Episode', status: 'published', publishedAt: new Date(), mediaAssetId: asset.id } });
    episodeId = episode.id;
    clipId = (await ctx.prisma.clip.create({ data: { sourceEpisodeId: episodeId, title: 'Clip', startTime: 0, endTime: 10, reviewStatus: 'published' } })).id;
    projectId = (await ctx.prisma.project.create({ data: { slug: 'harbor', name: 'Harbor', status: 'published' } })).id;
    await ctx.prisma.episodeProject.create({ data: { episodeId, projectId } });
  });
  afterAll(async () => {
    await resetContent(ctx.prisma);
    await resetDb(ctx.prisma);
    await ctx.close();
  });

  const send = (body: object, cookie?: string, headers: Record<string, string> = {}) => {
    const r = request(ctx.app).post('/api/v1/analytics/events').set(CSRF_HEADERS).set(headers);
    return (cookie ? r.set('Cookie', cookie) : r).send(body);
  };
  const visitorCookie = (res: request.Response) => (res.headers['set-cookie'] as unknown as string[] | undefined)?.find((c) => c.startsWith('st_vid='))?.split(';')[0];

  it('records anonymous events with server-derived show ids and honours GPC/DNT', async () => {
    const first = await send({
      events: [
        { type: 'page_view', path: '/shows/the-tank/ep?utm_source=x', entityType: 'episode', entityId: episodeId },
        { type: 'play_start', entityType: 'episode', entityId: episodeId, mediaKind: 'audio' },
        { type: 'play_progress', entityType: 'episode', entityId: episodeId, mediaKind: 'audio', seconds: 30 },
        { type: 'search', query: '  Tokenized   TREASURIES ' },
        { type: 'play_start', entityType: 'clip', entityId: clipId, mediaKind: 'audio', occurredAt: '2001-01-01T00:00:00.000Z' },
      ],
      referrer: 'https://www.news.example/article',
      utm: { source: 'Newsletter', medium: 'email' },
    });
    expect(first.status).toBe(204);
    const cookie = visitorCookie(first);
    expect(cookie).toBeDefined();

    const rows = await ctx.prisma.analyticsEvent.findMany({ orderBy: { type: 'asc' } });
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => r.visitorHash)).size).toBe(1);
    expect(rows[0]!.visitorHash).not.toContain(cookie!.split('=')[1]!);
    const pageView = rows.find((r) => r.type === 'page_view')!;
    expect(pageView).toMatchObject({ path: '/shows/the-tank/ep', showId, referrerHost: 'news.example', utmSource: 'newsletter', utmMedium: 'email' });
    expect(rows.find((r) => r.type === 'search')!.query).toBe('tokenized treasuries');
    const clipStart = rows.find((r) => r.entityType === 'clip')!;
    expect(clipStart.showId).toBe(showId);
    // Implausible client clocks are clamped to now.
    expect(Date.now() - clipStart.occurredAt.getTime()).toBeLessThan(60_000);

    // Same visitor on the next batch.
    await send({ events: [{ type: 'page_view', path: '/' }] }, cookie);
    expect(new Set((await ctx.prisma.analyticsEvent.findMany()).map((r) => r.visitorHash)).size).toBe(1);

    const optOut: Array<Record<string, string>> = [{ 'Sec-GPC': '1' }, { DNT: '1' }];
    for (const header of optOut) {
      expect((await send({ events: [{ type: 'page_view', path: '/x' }] }, undefined, header)).status).toBe(204);
    }
    expect(await ctx.prisma.analyticsEvent.count()).toBe(6);

    expect((await send({ events: [] })).status).toBe(400);
    expect((await send({ events: [{ type: 'download' }] })).status).toBe(400);
  });

  it('counts podcast downloads once per listener per day and redirects to the CDN', async () => {
    const dl = (headers: Record<string, string> = {}) => request(ctx.app).get(`/podcasts/dl/${episodeId}.mp3`).set('User-Agent', 'Overcast/3.0').set(headers);
    const res = await dl();
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://cdn.test/renditions/x/audio.mp3');
    await dl();
    await dl({ Range: 'bytes=0-1' });
    await dl({ Range: 'bytes=5000-' });
    await dl({ 'User-Agent': 'Pocket Casts' });
    await request(ctx.app).head(`/podcasts/dl/${episodeId}.mp3`);
    await dl({ 'Sec-GPC': '1', 'User-Agent': 'Private App' });

    const downloads = await ctx.prisma.analyticsEvent.findMany({ where: { type: 'download' } });
    expect(downloads).toHaveLength(2);
    expect(downloads.every((d) => d.showId === showId)).toBe(true);
    expect((await request(ctx.app).get('/podcasts/dl/missing.mp3')).status).toBe(404);
  });

  it('computes audience, content, show and project dashboards', async () => {
    const day = (d: string) => new Date(`${d}T12:00:00.000Z`);
    const ev = (over: object) => ({ type: 'page_view' as const, visitorHash: 'v1', occurredAt: day('2026-09-01'), ...over });
    await ctx.prisma.analyticsEvent.createMany({
      data: [
        ev({ visitorHash: 'v1', occurredAt: day('2026-08-31'), utmSource: 'newsletter' }),
        ev({ visitorHash: 'v2', occurredAt: day('2026-08-31'), referrerHost: 'x.com' }),
        ev({ visitorHash: 'v1', occurredAt: day('2026-09-08'), entityType: 'episode', entityId: episodeId, showId }),
        ev({ visitorHash: 'v3', occurredAt: day('2026-09-08'), entityType: 'project', entityId: projectId }),
        ev({ type: 'play_start', visitorHash: 'v1', occurredAt: day('2026-09-08'), entityType: 'episode', entityId: episodeId, showId, mediaKind: 'audio' }),
        ev({ type: 'play_progress', visitorHash: 'v1', occurredAt: day('2026-09-08'), entityType: 'episode', entityId: episodeId, showId, mediaKind: 'audio', seconds: 90 }),
        ev({ type: 'play_complete', visitorHash: 'v1', occurredAt: day('2026-09-08'), entityType: 'episode', entityId: episodeId, showId, mediaKind: 'audio' }),
        ev({ type: 'play_start', visitorHash: 'v2', occurredAt: day('2026-09-09'), entityType: 'episode', entityId: episodeId, showId, mediaKind: 'video' }),
        ev({ type: 'play_progress', visitorHash: 'v2', occurredAt: day('2026-09-09'), entityType: 'episode', entityId: episodeId, showId, mediaKind: 'video', seconds: 40 }),
        ev({ type: 'play_progress', visitorHash: 'v2', occurredAt: day('2026-09-09'), entityType: 'radio', entityId: 'r1', mediaKind: 'radio', seconds: 120 }),
        ev({ type: 'play_start', visitorHash: 'v3', occurredAt: day('2026-09-09'), entityType: 'clip', entityId: clipId, showId, mediaKind: 'audio' }),
        ev({ type: 'share', visitorHash: 'v3', occurredAt: day('2026-09-09'), entityType: 'episode', entityId: episodeId, showId, channel: 'copy_link' }),
        ev({ type: 'download', visitorHash: 'd1', occurredAt: day('2026-09-09'), entityType: 'episode', entityId: episodeId, showId }),
        ev({ type: 'download', visitorHash: 'd2', occurredAt: day('2026-09-09'), entityType: 'episode', entityId: episodeId, showId }),
        ev({ type: 'search', visitorHash: 'v2', occurredAt: day('2026-09-09'), query: 'rwa' }),
        ev({ type: 'search', visitorHash: 'v3', occurredAt: day('2026-09-09'), query: 'rwa' }),
        // Outside the range.
        ev({ visitorHash: 'v9', occurredAt: day('2026-06-01') }),
      ],
    });
    const creator = await ctx.prisma.user.findFirstOrThrow({ where: { email: 'creator@example.com' } });
    await ctx.prisma.follow.create({ data: { userId: creator.id, showId, createdAt: day('2026-09-02') } });
    await ctx.prisma.follow.create({ data: { userId: creator.id, projectId, createdAt: day('2026-01-01') } });

    const q = '?from=2026-08-31&to=2026-09-13';
    expect((await request(ctx.app).get(`/api/v1/admin/analytics/audience${q}`).set('Cookie', await loginAs(ctx.app, 'creator@example.com'))).status).toBe(403);

    const audience = audienceAnalyticsSchema.parse((await request(ctx.app).get(`/api/v1/admin/analytics/audience${q}`).set('Cookie', editor)).body);
    expect(audience).toMatchObject({ uniqueVisitors: 3, pageViews: 4, followers: { total: 2, new: 1 } });
    expect(audience.daily).toHaveLength(14);
    expect(audience.daily[0]).toEqual({ date: '2026-08-31', visitors: 2, pageViews: 2 });
    expect(audience.daily.find((d) => d.date === '2026-09-05')).toEqual({ date: '2026-09-05', visitors: 0, pageViews: 0 });
    expect(audience.trafficSources.map((s) => s.source)).toEqual(expect.arrayContaining(['newsletter', 'x.com', 'direct']));
    expect(audience.topSearches).toEqual([{ query: 'rwa', count: 2 }]);
    // Cohort of 2026-08-31 (v1, v2): both returned the next week.
    expect(audience.retention.find((c) => c.cohortWeek === '2026-08-31')).toEqual({ cohortWeek: '2026-08-31', visitors: 2, returned: 2, rate: 1 });

    const content = contentAnalyticsSchema.parse((await request(ctx.app).get(`/api/v1/admin/analytics/content${q}`).set('Cookie', editor)).body);
    expect(content.totals).toMatchObject({ plays: 3, completions: 1, listenSeconds: 90, watchSeconds: 40, radioSeconds: 120, downloads: 2, shares: 1 });
    expect(content.topEpisodes[0]).toMatchObject({ id: episodeId, showTitle: 'The Tank', views: 1, plays: 2, completions: 1, completionRate: 0.5, downloads: 2 });
    expect(content.clips).toEqual([{ id: clipId, title: 'Clip', plays: 1, completions: 0, shares: 0, views: 0 }]);
    expect(content.notTracked).toEqual(['likes', 'comments']);

    const shows = showAnalyticsSchema.parse((await request(ctx.app).get(`/api/v1/admin/analytics/shows${q}`).set('Cookie', editor)).body);
    expect(shows.items[0]).toMatchObject({ id: showId, plays: 3, followers: 1, newFollowers: 1, downloads: 2 });

    const projects = projectAnalyticsSchema.parse((await request(ctx.app).get(`/api/v1/admin/analytics/projects${q}`).set('Cookie', editor)).body);
    expect(projects.items[0]).toMatchObject({ id: projectId, views: 1, followers: 1, newFollowers: 0, episodeMentions: 1, mentionViews: 1 });
  });

  it('validates date ranges', () => {
    expect(resolveRange({}, new Date('2026-09-17T10:00:00Z'))).toMatchObject({ from: '2026-08-19', to: '2026-09-17' });
    expect(() => resolveRange({ from: '2026-09-10', to: '2026-09-01' })).toThrow(/on or before/);
    expect(() => resolveRange({ from: '2024-01-01', to: '2026-01-01' })).toThrow(/limited/);
  });
});
