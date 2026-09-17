import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  adminEpisodeSchema,
  adminLivestreamSchema,
  adminProjectSchema,
  adminShowListSchema,
  adminShowSchema,
  homeResponseSchema,
  libraryResponseSchema,
} from '@stocktank/types';
import { CSRF_HEADERS, createTestContext, loginAs, resetContent, resetDb, seedUser, type TestContext } from './helpers.js';

describe('admin content CMS and viewer library', () => {
  let ctx: TestContext;
  let creator: string;
  let editor: string;
  let viewer: string;

  beforeAll(async () => {
    ctx = await createTestContext({ redis: false });
  });
  beforeEach(async () => {
    await resetContent(ctx.prisma);
    await resetDb(ctx.prisma);
    await ctx.prisma.chain.upsert({ where: { slug: 'ethereum' }, update: {}, create: { slug: 'ethereum', name: 'Ethereum', chainId: 1 } });
    await seedUser(ctx.prisma, { email: 'creator@example.com', roles: ['creator'] });
    await seedUser(ctx.prisma, { email: 'editor@example.com', roles: ['editor'] });
    await seedUser(ctx.prisma, { email: 'viewer@example.com', roles: ['viewer'] });
    creator = await loginAs(ctx.app, 'creator@example.com');
    editor = await loginAs(ctx.app, 'editor@example.com');
    viewer = await loginAs(ctx.app, 'viewer@example.com');
  });
  afterAll(async () => {
    await resetContent(ctx.prisma);
    await resetDb(ctx.prisma);
    await ctx.close();
  });

  const as = (cookie: string) => ({
    get: (url: string) => request(ctx.app).get(url).set('Cookie', cookie),
    post: (url: string, body: object) => request(ctx.app).post(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body),
    put: (url: string, body: object) => request(ctx.app).put(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body),
    del: (url: string, body?: object) => request(ctx.app).delete(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body ?? {}),
  });
  const C = '/api/v1/admin/content';

  it('lets creators draft but only publishers publish, and publishes to the public site', async () => {
    const draft = await as(creator).post(`${C}/shows`, { title: 'The Tank', tagline: 'Founders pitch.' });
    expect(draft.status).toBe(201);
    const show = adminShowSchema.parse(draft.body);
    expect(show.slug).toBe('the-tank');
    expect(show.status).toBe('draft');
    expect(show.isDemo).toBe(false);

    expect((await as(creator).put(`${C}/shows/${show.id}`, { title: 'The Tank', status: 'published' })).status).toBe(403);
    expect((await as(creator).put(`${C}/shows/${show.id}`, { title: 'The Tank', status: 'review' })).status).toBe(200);

    let home = homeResponseSchema.parse((await request(ctx.app).get('/api/v1/home')).body);
    expect(home.featuredShows).toHaveLength(0);

    expect((await as(editor).put(`${C}/shows/${show.id}`, { title: 'The Tank', status: 'published' })).status).toBe(200);
    home = homeResponseSchema.parse((await request(ctx.app).get('/api/v1/home')).body);
    expect(home.featuredShows.map((s) => s.title)).toEqual(['The Tank']);

    const list = adminShowListSchema.parse((await as(creator).get(`${C}/shows?status=published`)).body);
    expect(list.total).toBe(1);
    expect(await ctx.prisma.auditLog.count({ where: { action: { startsWith: 'content.show.' } } })).toBe(3);
  });

  it('rejects duplicate slugs and unknown links', async () => {
    await as(editor).post(`${C}/shows`, { title: 'Market Open' });
    expect((await as(editor).post(`${C}/shows`, { title: 'Market Open' })).status).toBe(409);
    expect((await as(editor).post(`${C}/episodes`, { showId: 'nope', title: 'Episode' })).status).toBe(400);
    expect((await as(editor).post(`${C}/shows`, { title: 'Bad', slug: 'Not A Slug' })).status).toBe(400);
  });

  it('creates episodes with entity links, stamps publication time and keeps it on re-save', async () => {
    const show = adminShowSchema.parse((await as(editor).post(`${C}/shows`, { title: 'Chain Reaction', status: 'published' })).body);
    const project = adminProjectSchema.parse(
      (await as(editor).post(`${C}/projects`, { name: 'Harbor Protocol', kind: 'protocol', chainSlug: 'ethereum', status: 'published' })).body,
    );
    expect(project.chainName).toBe('Ethereum');

    const created = await as(editor).post(`${C}/episodes`, {
      showId: show.id,
      title: 'Restaking explained',
      status: 'published',
      projectIds: [project.id],
    });
    expect(created.status).toBe(201);
    const episode = adminEpisodeSchema.parse(created.body);
    expect(episode.publishedAt).not.toBeNull();
    expect(episode.projectIds).toEqual([project.id]);

    const resaved = adminEpisodeSchema.parse(
      (await as(editor).put(`${C}/episodes/${episode.id}`, { showId: show.id, title: 'Restaking, explained', status: 'published', projectIds: [] })).body,
    );
    expect(resaved.publishedAt).toBe(episode.publishedAt);
    expect(resaved.projectIds).toEqual([]);

    expect((await as(creator).post(`${C}/projects`, { name: 'No permission' })).status).toBe(403);
  });

  it('schedules broadcasts with segments and records when they go live', async () => {
    const start = new Date(Date.now() + 3_600_000).toISOString();
    const created = await as(editor).post(`${C}/livestreams`, { title: 'Market Open', scheduledStart: start, segments: ['Open', 'Wrap'] });
    expect(created.status).toBe(201);
    const stream = adminLivestreamSchema.parse(created.body);
    expect(stream.segments.map((s) => s.title)).toEqual(['Open', 'Wrap']);

    const live = adminLivestreamSchema.parse(
      (await as(editor).put(`${C}/livestreams/${stream.id}`, { title: 'Market Open', scheduledStart: start, status: 'live', segments: ['Open'] })).body,
    );
    expect(live.status).toBe('live');
    const row = await ctx.prisma.livestream.findUniqueOrThrow({ where: { id: stream.id } });
    expect(row.startedAt).not.toBeNull();

    expect((await as(creator).post(`${C}/livestreams`, { title: 'x', scheduledStart: start })).status).toBe(403);
    expect(homeResponseSchema.parse((await request(ctx.app).get('/api/v1/home')).body).live?.id).toBe(stream.id);
  });

  it('gives viewers follows, bookmarks and a library of published items only', async () => {
    const show = adminShowSchema.parse((await as(editor).post(`${C}/shows`, { title: 'RWA Report', status: 'published' })).body);
    const hidden = adminShowSchema.parse((await as(editor).post(`${C}/shows`, { title: 'Hidden', status: 'draft' })).body);
    const episode = adminEpisodeSchema.parse((await as(editor).post(`${C}/episodes`, { showId: show.id, title: 'T-bills on-chain', status: 'published' })).body);

    expect((await as(viewer).post('/api/v1/me/follows', { target: 'show', id: show.id })).status).toBe(204);
    expect((await as(viewer).post('/api/v1/me/follows', { target: 'show', id: show.id })).status).toBe(204);
    expect((await as(viewer).post('/api/v1/me/follows', { target: 'show', id: hidden.id })).status).toBe(404);
    expect((await as(viewer).put('/api/v1/me/bookmarks', { episodeId: episode.id, positionSeconds: 90 })).status).toBe(204);

    const library = libraryResponseSchema.parse((await as(viewer).get('/api/v1/me/library')).body);
    expect(library.shows.map((s) => s.title)).toEqual(['RWA Report']);
    expect(library.bookmarks[0]?.positionSeconds).toBe(90);

    await as(viewer).del('/api/v1/me/follows', { target: 'show', id: show.id });
    await as(viewer).del(`/api/v1/me/bookmarks/${episode.id}`);
    const empty = libraryResponseSchema.parse((await as(viewer).get('/api/v1/me/library')).body);
    expect(empty.shows).toEqual([]);
    expect(empty.bookmarks).toEqual([]);

    expect((await request(ctx.app).get('/api/v1/me/library')).status).toBe(401);
    expect((await as(viewer).get(`${C}/shows`)).status).toBe(403);
  });
});
