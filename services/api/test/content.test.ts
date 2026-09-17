import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { homeResponseSchema, publicFlagsResponseSchema, searchResponseSchema, showDetailResponseSchema } from '@stocktank/types';
import { createTestContext, resetContent, type TestContext } from './helpers.js';

describe('public content', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext({ redis: false });
  });
  beforeEach(async () => {
    await resetContent(ctx.prisma);
  });
  afterAll(async () => {
    await resetContent(ctx.prisma);
    await ctx.close();
  });

  async function seedShow(title: string, status: 'published' | 'draft', episodes: Array<{ title: string; status: 'published' | 'draft' }>) {
    const slug = title.toLowerCase().replace(/\s+/g, '-');
    return ctx.prisma.show.create({
      data: {
        slug,
        title,
        status,
        isDemo: true,
        episodes: {
          create: episodes.map((e, i) => ({
            slug: e.title.toLowerCase().replace(/\s+/g, '-'),
            title: e.title,
            status: e.status,
            publishedAt: new Date(Date.now() - i * 60_000),
            isDemo: true,
          })),
        },
      },
      include: { episodes: true },
    });
  }

  it('returns an empty but valid homepage when there is no content', async () => {
    const res = await request(ctx.app).get('/api/v1/home');
    expect(res.status).toBe(200);
    const body = homeResponseSchema.parse(res.body);
    expect(body.featuredShows).toEqual([]);
    expect(body.live).toBeNull();
    expect(res.headers['cache-control']).toMatch(/public/);
  });

  it('only exposes published content and labels demo rows', async () => {
    await seedShow('Published Show', 'published', [
      { title: 'Live episode', status: 'published' },
      { title: 'Draft episode', status: 'draft' },
    ]);
    await seedShow('Draft Show', 'draft', [{ title: 'Hidden episode', status: 'published' }]);

    const body = homeResponseSchema.parse((await request(ctx.app).get('/api/v1/home')).body);
    expect(body.featuredShows.map((s) => s.title)).toEqual(['Published Show']);
    expect(body.featuredShows[0]?.episodeCount).toBe(1);
    expect(body.featuredShows[0]?.isDemo).toBe(true);
    expect(body.latestEpisodes.map((e) => e.title)).toEqual(['Live episode']);
  });

  it('only publishes clips that passed review', async () => {
    const show = await seedShow('Clip Show', 'published', [{ title: 'Source', status: 'published' }]);
    const episodeId = show.episodes[0]!.id;
    await ctx.prisma.clip.createMany({
      data: [
        { sourceEpisodeId: episodeId, title: 'Approved clip', startTime: 10, endTime: 40, reviewStatus: 'published' },
        { sourceEpisodeId: episodeId, title: 'AI draft clip', startTime: 50, endTime: 80, reviewStatus: 'draft' },
      ],
    });
    const body = homeResponseSchema.parse((await request(ctx.app).get('/api/v1/home')).body);
    expect(body.clips.map((c) => c.title)).toEqual(['Approved clip']);
    expect(body.clips[0]?.show.slug).toBe('clip-show');
  });

  it('reports the live broadcast and orders the rundown by start time', async () => {
    const now = Date.now();
    await ctx.prisma.livestream.create({
      data: { title: 'Later', status: 'scheduled', scheduledStart: new Date(now + 3 * 3_600_000) },
    });
    await ctx.prisma.livestream.create({
      data: {
        title: 'On air',
        status: 'live',
        scheduledStart: new Date(now - 600_000),
        segments: { create: [{ position: 1, title: 'Second' }, { position: 0, title: 'First' }] },
      },
    });
    await ctx.prisma.livestream.create({
      data: { title: 'Finished', status: 'ended', scheduledStart: new Date(now - 7_200_000) },
    });

    const body = homeResponseSchema.parse((await request(ctx.app).get('/api/v1/home')).body);
    expect(body.live?.title).toBe('On air');
    expect(body.live?.segments.map((s) => s.title)).toEqual(['First', 'Second']);
    expect(body.live?.streamUrl).toBeNull();
    expect(body.rundown.map((r) => r.title)).toEqual(['On air', 'Later']);
  });

  it('serves show detail for published shows and 404 otherwise', async () => {
    await seedShow('Visible', 'published', [{ title: 'Ep one', status: 'published' }]);
    await seedShow('Invisible', 'draft', []);

    const ok = await request(ctx.app).get('/api/v1/shows/visible');
    expect(ok.status).toBe(200);
    expect(showDetailResponseSchema.parse(ok.body).episodes).toHaveLength(1);

    const missing = await request(ctx.app).get('/api/v1/shows/invisible');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('groups search results and requires a query', async () => {
    await seedShow('Tank Talk', 'published', [{ title: 'Inside the tank', status: 'published' }]);
    await ctx.prisma.project.create({ data: { name: 'Tankette Protocol', slug: 'tankette', status: 'published' } });
    await ctx.prisma.company.create({ data: { name: 'Hidden Tank Co', slug: 'hidden-tank', status: 'draft' } });

    const res = await request(ctx.app).get('/api/v1/search').query({ q: 'TANK' });
    const body = searchResponseSchema.parse(res.body);
    expect(body.engine).toBe('postgres');
    expect(body.shows).toHaveLength(1);
    expect(body.episodes).toHaveLength(1);
    expect(body.projects.map((p) => p.name)).toEqual(['Tankette Protocol']);
    expect(body.companies).toEqual([]);

    const empty = await request(ctx.app).get('/api/v1/search');
    expect(empty.status).toBe(400);
  });

  it('lists public feature flags', async () => {
    const res = await request(ctx.app).get('/api/v1/flags');
    expect(res.status).toBe(200);
    const body = publicFlagsResponseSchema.parse(res.body);
    expect(typeof body.flags.advertising).toBe('boolean');
  });
});
