import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminPersonSchema,
  companyDetailResponseSchema,
  episodeDetailResponseSchema,
  personDetailResponseSchema,
  projectDetailResponseSchema,
  searchResponseSchema,
  searchSuggestResponseSchema,
  showDetailResponseSchema,
} from '@stocktank/types';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/lib/logger.js';
import { MeilisearchEngine, PostgresEngine, SearchService, type SearchEngine } from '../src/lib/search.js';
import { CSRF_HEADERS, createTestContext, loginAs, resetContent, resetDb, seedUser, type TestContext } from './helpers.js';

const logger = createLogger({ level: 'silent' });

describe('media graph, people CMS, SEO feeds', () => {
  let ctx: TestContext;
  let editor: string;
  let creator: string;

  beforeAll(async () => {
    ctx = await createTestContext({ redis: false });
  });
  beforeEach(async () => {
    await resetContent(ctx.prisma);
    await ctx.prisma.host.deleteMany({});
    await ctx.prisma.guest.deleteMany({});
    await resetDb(ctx.prisma);
    await ctx.prisma.chain.upsert({ where: { slug: 'ethereum' }, update: { explorer: 'https://etherscan.io' }, create: { slug: 'ethereum', name: 'Ethereum', explorer: 'https://etherscan.io' } });
    await seedUser(ctx.prisma, { email: 'editor@example.com', roles: ['editor'] });
    await seedUser(ctx.prisma, { email: 'creator@example.com', roles: ['creator'] });
    editor = await loginAs(ctx.app, 'editor@example.com');
    creator = await loginAs(ctx.app, 'creator@example.com');
  });
  afterAll(async () => {
    await resetContent(ctx.prisma);
    await ctx.prisma.host.deleteMany({});
    await ctx.prisma.guest.deleteMany({});
    await resetDb(ctx.prisma);
    await ctx.close();
  });

  const post = (cookie: string, url: string, body: object) => request(ctx.app).post(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body);
  const C = '/api/v1/admin/content';

  async function buildGraph() {
    const host = adminPersonSchema.parse((await post(editor, `${C}/hosts`, { name: 'Jordan Vale', bio: 'Anchor' })).body);
    const aiHost = adminPersonSchema.parse((await post(editor, `${C}/hosts`, { name: 'Desk Anchor AI', isAi: true })).body);
    const guest = adminPersonSchema.parse((await post(editor, `${C}/guests`, { name: 'Rafael Costa', title: 'Founder' })).body);
    const show = (await post(editor, `${C}/shows`, { title: 'The Tank', status: 'published', hostIds: [host.id, aiHost.id] })).body;
    const project = (await post(editor, `${C}/projects`, { name: 'Harbor Protocol', chainSlug: 'ethereum', contractAddress: '0xabc', status: 'published' })).body;
    const company = (await post(editor, `${C}/companies`, { name: 'Meridian Robotics', status: 'published' })).body;
    const episode = (
      await post(editor, `${C}/episodes`, {
        showId: show.id,
        title: 'Treasury protocols in a bear market',
        status: 'published',
        hostIds: [host.id],
        guestIds: [guest.id],
        projectIds: [project.id],
        companyIds: [company.id],
      })
    ).body;
    const draft = (await post(editor, `${C}/episodes`, { showId: show.id, title: 'Unreleased', status: 'draft' })).body;
    await post(editor, `${C}/articles`, { title: 'Harbor explainer', summary: 'What Harbor does', status: 'published' });
    return { host, aiHost, guest, show, project, company, episode, draft };
  }

  it('connects show → episode → people → project → company (§9)', async () => {
    const g = await buildGraph();

    const show = showDetailResponseSchema.parse((await request(ctx.app).get('/api/v1/shows/the-tank')).body);
    expect(show.hosts.map((h) => [h.name, h.isAi])).toEqual([
      ['Desk Anchor AI', true],
      ['Jordan Vale', false],
    ]);

    const episode = episodeDetailResponseSchema.parse((await request(ctx.app).get(`/api/v1/shows/the-tank/episodes/${g.episode.slug}`)).body);
    expect(episode.guests.map((p) => p.name)).toEqual(['Rafael Costa']);
    expect(episode.projects.map((p) => p.name)).toEqual(['Harbor Protocol']);
    expect(episode.companies.map((c) => c.name)).toEqual(['Meridian Robotics']);
    expect((await request(ctx.app).get(`/api/v1/shows/the-tank/episodes/${g.draft.slug}`)).status).toBe(404);

    const project = projectDetailResponseSchema.parse((await request(ctx.app).get('/api/v1/projects/harbor-protocol')).body);
    expect(project.project.explorerUrl).toBe('https://etherscan.io/address/0xabc');
    expect(project.episodes.map((e) => e.title)).toEqual(['Treasury protocols in a bear market']);

    const company = companyDetailResponseSchema.parse((await request(ctx.app).get('/api/v1/companies/meridian-robotics')).body);
    expect(company.episodes).toHaveLength(1);

    const guest = personDetailResponseSchema.parse((await request(ctx.app).get('/api/v1/people/rafael-costa')).body);
    expect(guest.person.role).toBe('guest');
    expect(guest.episodes).toHaveLength(1);
    const host = personDetailResponseSchema.parse((await request(ctx.app).get('/api/v1/people/jordan-vale')).body);
    expect(host.episodes).toHaveLength(1);
  });

  it('only lets editors mark a host as an AI personality', async () => {
    expect((await post(creator, `${C}/hosts`, { name: 'Sneaky Bot', isAi: true })).status).toBe(403);
    expect((await post(creator, `${C}/hosts`, { name: 'Human Host' })).status).toBe(201);
    expect((await post(editor, `${C}/guests`, { name: 'AI Guest', isAi: true })).status).toBe(400);
  });

  it('searches every group through the Postgres engine and suggests paths', async () => {
    await buildGraph();
    const body = searchResponseSchema.parse((await request(ctx.app).get('/api/v1/search').query({ q: 'harbor' })).body);
    expect(body.projects.map((p) => p.name)).toEqual(['Harbor Protocol']);
    expect(body.articles.map((a) => a.title)).toEqual(['Harbor explainer']);

    const people = searchResponseSchema.parse((await request(ctx.app).get('/api/v1/search').query({ q: 'costa' })).body);
    expect(people.people.map((p) => p.name)).toEqual(['Rafael Costa']);

    const suggest = searchSuggestResponseSchema.parse((await request(ctx.app).get('/api/v1/search/suggest').query({ q: 'tank' })).body);
    expect(suggest.suggestions[0]).toMatchObject({ type: 'show', path: '/shows/the-tank' });
  });

  it('publishes sitemap, RSS and robots with only public URLs', async () => {
    const g = await buildGraph();
    const sitemap = await request(ctx.app).get('/api/v1/seo/sitemap.xml');
    expect(sitemap.headers['content-type']).toMatch(/application\/xml/);
    expect(sitemap.text).toContain(`/shows/the-tank/${g.episode.slug}</loc>`);
    expect(sitemap.text).toContain('/projects/harbor-protocol</loc>');
    expect(sitemap.text).toContain('/people/rafael-costa</loc>');
    expect(sitemap.text).not.toContain(g.draft.slug);

    const rss = await request(ctx.app).get('/api/v1/seo/rss.xml');
    expect(rss.text).toContain('<title>The Tank: Treasury protocols in a bear market</title>');
    expect(rss.text).not.toContain('Unreleased');

    const robots = await request(ctx.app).get('/api/v1/seo/robots.txt');
    expect(robots.text).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
  });

  it('reindex requires settings.manage', async () => {
    expect((await post(editor, `${C}/search/reindex`, {})).status).toBe(403);
    await seedUser(ctx.prisma, { email: 'admin@example.com', roles: ['admin'] });
    const admin = await loginAs(ctx.app, 'admin@example.com');
    const res = await post(admin, `${C}/search/reindex`, {});
    expect(res.status).toBe(200);
    expect(res.body.engine).toBe('postgres');
  });
});

describe('search engine adapters', () => {
  it('builds a Meilisearch multi-search request and maps hits per group', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { queries: Array<{ indexUid: string }> };
      expect(body.queries.map((q) => q.indexUid)).toContain('pfx_project');
      return new Response(JSON.stringify({ results: [{ indexUid: 'pfx_project', hits: [{ id: 'p1' }] }, { indexUid: 'pfx_person', hits: [{ id: 'guest_g1' }] }] }), { status: 200 });
    });
    const engine = new MeilisearchEngine('http://meili:7700', 'key', 'pfx', fetchMock as unknown as typeof fetch);
    const hits = await engine.search('harbor', 5);
    expect(hits.project).toEqual(['p1']);
    expect(hits.person).toEqual(['guest_g1']);
    const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer key');
  });

  it('falls back to Postgres when the primary engine is down', async () => {
    const ctx = await createTestContext({ redis: false });
    try {
      const broken: SearchEngine = {
        name: 'meilisearch',
        search: () => Promise.reject(new Error('connection refused')),
        upsert: () => Promise.resolve(),
        remove: () => Promise.resolve(),
        replaceAll: () => Promise.resolve(),
      };
      const service = new SearchService(ctx.prisma, broken, logger);
      const app = createApp({ env: ctx.env, prisma: ctx.prisma, redis: null, logger, search: service });
      const res = await request(app).get('/api/v1/search').query({ q: 'anything' });
      expect(res.status).toBe(200);
      expect(res.body.engine).toBe('postgres');
      expect(new PostgresEngine(ctx.prisma).name).toBe('postgres');
    } finally {
      await ctx.close();
    }
  });
});

const MEILI_URL = process.env.MEILISEARCH_TEST_URL;
const meiliReachable = MEILI_URL
  ? await fetch(`${MEILI_URL}/health`, { signal: AbortSignal.timeout(1500) }).then((r) => r.ok).catch(() => false)
  : false;

describe.runIf(meiliReachable)('Meilisearch integration (local only)', () => {
  it('indexes published content, finds it with a typo, and drops unpublished items', async () => {
    const ctx = await createTestContext({ redis: false });
    try {
      await resetContent(ctx.prisma);
      const project = await ctx.prisma.project.create({ data: { name: 'Tidewater Treasury', slug: 'tidewater-treasury', status: 'published' } });
      await ctx.prisma.project.create({ data: { name: 'Tidewater Draft', slug: 'tidewater-draft', status: 'draft' } });
      const engine = new MeilisearchEngine(MEILI_URL!, process.env.MEILISEARCH_KEY, `stocktank_test_${Date.now()}`);
      const service = new SearchService(ctx.prisma, engine, logger);
      const counts = await service.reindex();
      expect(counts.project).toBe(1);

      let result = await service.search('tidewatr');
      for (let i = 0; i < 40 && result.projects.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 250));
        result = await service.search('tidewatr');
      }
      expect(result.engine).toBe('meilisearch');
      expect(result.projects.map((p) => p.id)).toEqual([project.id]);
    } finally {
      await resetContent(ctx.prisma);
      await ctx.close();
    }
  }, 20_000);
});
