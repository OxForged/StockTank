import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { PrismaClient } from '@stocktank/database';
import type { SearchResponse, SearchSuggestion } from '@stocktank/types';
import {
  PUBLISHED,
  articleSelect,
  companySelect,
  episodeSelect,
  projectSelect,
  showSelect,
  toArticleSummary,
  toCompanySummary,
  toEpisodeSummary,
  toProjectSummary,
  toShowSummary,
} from './content.js';
import { personSelect, toGuestSummary, toHostSummary } from './people.js';

export const SEARCH_TYPES = ['show', 'episode', 'person', 'project', 'company', 'article'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
export type SearchHits = Record<SearchType, string[]>;

const GROUP_LIMIT = 6;

// ───────── Provider abstraction (§10; replaceable engine) ─────────

export interface SearchEngine {
  readonly name: 'meilisearch' | 'postgres';
  /** Ranked ids per group. Throws when the engine is unavailable; callers fall back to Postgres. */
  search(query: string, limit: number): Promise<SearchHits>;
  upsert(type: SearchType, docs: SearchDocument[]): Promise<void>;
  remove(type: SearchType, ids: string[]): Promise<void>;
  /** Replaces every document of a type (used by reindex). */
  replaceAll(type: SearchType, docs: SearchDocument[]): Promise<void>;
}

export interface SearchDocument {
  id: string;
  /** Primary label (title or name). */
  label: string;
  /** Secondary searchable text. */
  text: string;
  path: string;
}

const emptyHits = (): SearchHits => ({ show: [], episode: [], person: [], project: [], company: [], article: [] });

// ───────── Meilisearch adapter (REST over fetch; no SDK coupling) ─────────

export class MeilisearchEngine implements SearchEngine {
  readonly name = 'meilisearch' as const;

  constructor(
    private readonly url: string,
    private readonly apiKey: string | undefined,
    private readonly prefix = 'stocktank',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private indexUid(type: SearchType): string {
    return `${this.prefix}_${type}`;
  }

  private async call(path: string, init: { method: string; body?: unknown }): Promise<unknown> {
    const res = await this.fetchImpl(`${this.url.replace(/\/$/, '')}${path}`, {
      method: init.method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok && res.status !== 404) throw new Error(`Meilisearch ${init.method} ${path} failed with ${res.status}`);
    const text = await res.text();
    return text ? (JSON.parse(text) as unknown) : null;
  }

  async search(query: string, limit: number): Promise<SearchHits> {
    const body = {
      queries: SEARCH_TYPES.map((type) => ({ indexUid: this.indexUid(type), q: query, limit, attributesToRetrieve: ['id'] })),
    };
    const result = (await this.call('/multi-search', { method: 'POST', body })) as {
      results?: Array<{ indexUid: string; hits: Array<{ id: string }> }>;
    } | null;
    const hits = emptyHits();
    for (const r of result?.results ?? []) {
      const type = SEARCH_TYPES.find((t) => this.indexUid(t) === r.indexUid);
      if (type) hits[type] = r.hits.map((h) => h.id);
    }
    return hits;
  }

  async upsert(type: SearchType, docs: SearchDocument[]): Promise<void> {
    if (docs.length === 0) return;
    await this.call(`/indexes/${this.indexUid(type)}/documents?primaryKey=id`, { method: 'POST', body: docs });
  }

  async remove(type: SearchType, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.call(`/indexes/${this.indexUid(type)}/documents/delete-batch`, { method: 'POST', body: ids });
  }

  async replaceAll(type: SearchType, docs: SearchDocument[]): Promise<void> {
    const uid = this.indexUid(type);
    await this.call('/indexes', { method: 'POST', body: { uid, primaryKey: 'id' } }).catch(() => undefined);
    await this.call(`/indexes/${uid}/settings`, {
      method: 'PATCH',
      body: { searchableAttributes: ['label', 'text'], displayedAttributes: ['id', 'label', 'path'], typoTolerance: { enabled: true } },
    });
    await this.call(`/indexes/${uid}/documents`, { method: 'DELETE' });
    await this.upsert(type, docs);
  }
}

// ───────── Postgres engine (always available; also the fallback) ─────────

export class PostgresEngine implements SearchEngine {
  readonly name = 'postgres' as const;

  constructor(private readonly prisma: PrismaClient) {}

  async search(query: string, limit: number): Promise<SearchHits> {
    const contains = { contains: query, mode: 'insensitive' as const };
    const ids = <T extends { id: string }>(rows: T[]) => rows.map((r) => r.id);
    const [show, episode, host, guest, project, company, article] = await Promise.all([
      this.prisma.show.findMany({ where: { status: PUBLISHED, OR: [{ title: contains }, { tagline: contains }] }, select: { id: true }, take: limit }),
      this.prisma.episode.findMany({
        where: { status: PUBLISHED, show: { status: PUBLISHED }, OR: [{ title: contains }, { summary: contains }] },
        select: { id: true },
        orderBy: { publishedAt: 'desc' },
        take: limit,
      }),
      this.prisma.host.findMany({ where: { name: contains }, select: { id: true }, take: limit }),
      this.prisma.guest.findMany({ where: { OR: [{ name: contains }, { title: contains }] }, select: { id: true }, take: limit }),
      this.prisma.project.findMany({ where: { status: PUBLISHED, OR: [{ name: contains }, { symbol: contains }] }, select: { id: true }, take: limit }),
      this.prisma.company.findMany({
        where: { status: PUBLISHED, OR: [{ name: contains }, { ticker: contains }, { sector: contains }] },
        select: { id: true },
        take: limit,
      }),
      this.prisma.article.findMany({ where: { status: PUBLISHED, OR: [{ title: contains }, { summary: contains }] }, select: { id: true }, take: limit }),
    ]);
    return {
      show: ids(show),
      episode: ids(episode),
      person: [...ids(host).map((id) => `host_${id}`), ...ids(guest).map((id) => `guest_${id}`)].slice(0, limit),
      project: ids(project),
      company: ids(company),
      article: ids(article),
    };
  }

  async upsert(): Promise<void> {}
  async remove(): Promise<void> {}
  async replaceAll(): Promise<void> {}
}

// ───────── Document building (what gets indexed; published only) ─────────

export async function buildDocuments(prisma: PrismaClient, type: SearchType, ids?: string[]): Promise<{ docs: SearchDocument[]; removed: string[] }> {
  const idFilter = ids ? { id: { in: ids } } : {};
  switch (type) {
    case 'show': {
      const rows = await prisma.show.findMany({ where: idFilter, select: { id: true, slug: true, title: true, tagline: true, description: true, status: true } });
      return split(rows, (r) => r.status === PUBLISHED, (r) => ({ id: r.id, label: r.title, text: [r.tagline, r.description].filter(Boolean).join(' '), path: `/shows/${r.slug}` }), ids);
    }
    case 'episode': {
      const rows = await prisma.episode.findMany({
        where: idFilter,
        select: { id: true, slug: true, title: true, summary: true, status: true, show: { select: { slug: true, title: true, status: true } } },
      });
      return split(
        rows,
        (r) => r.status === PUBLISHED && r.show.status === PUBLISHED,
        (r) => ({ id: r.id, label: r.title, text: [r.summary, r.show.title].filter(Boolean).join(' '), path: `/shows/${r.show.slug}/${r.slug}` }),
        ids,
      );
    }
    case 'person': {
      const hostIds = ids?.filter((i) => i.startsWith('host_')).map((i) => i.slice(5));
      const guestIds = ids?.filter((i) => i.startsWith('guest_')).map((i) => i.slice(6));
      const [hosts, guests] = await Promise.all([
        ids && hostIds?.length === 0 ? [] : prisma.host.findMany({ where: hostIds ? { id: { in: hostIds } } : {}, select: { id: true, slug: true, name: true, bio: true } }),
        ids && guestIds?.length === 0 ? [] : prisma.guest.findMany({ where: guestIds ? { id: { in: guestIds } } : {}, select: { id: true, slug: true, name: true, title: true, bio: true } }),
      ]);
      const docs = [
        ...hosts.map((h) => ({ id: `host_${h.id}`, label: h.name, text: h.bio ?? '', path: `/people/${h.slug}` })),
        ...guests.map((g) => ({ id: `guest_${g.id}`, label: g.name, text: [g.title, g.bio].filter(Boolean).join(' '), path: `/people/${g.slug}` })),
      ];
      const found = new Set(docs.map((d) => d.id));
      return { docs, removed: (ids ?? []).filter((i) => !found.has(i)) };
    }
    case 'project': {
      const rows = await prisma.project.findMany({ where: idFilter, select: { id: true, slug: true, name: true, symbol: true, description: true, status: true } });
      return split(rows, (r) => r.status === PUBLISHED, (r) => ({ id: r.id, label: r.name, text: [r.symbol, r.description].filter(Boolean).join(' '), path: `/projects/${r.slug}` }), ids);
    }
    case 'company': {
      const rows = await prisma.company.findMany({
        where: idFilter,
        select: { id: true, slug: true, name: true, ticker: true, sector: true, industry: true, description: true, status: true },
      });
      return split(
        rows,
        (r) => r.status === PUBLISHED,
        (r) => ({ id: r.id, label: r.name, text: [r.ticker, r.sector, r.industry, r.description].filter(Boolean).join(' '), path: `/companies/${r.slug}` }),
        ids,
      );
    }
    case 'article': {
      const rows = await prisma.article.findMany({ where: idFilter, select: { id: true, slug: true, title: true, summary: true, status: true } });
      return split(rows, (r) => r.status === PUBLISHED, (r) => ({ id: r.id, label: r.title, text: r.summary ?? '', path: `/news/${r.slug}` }), ids);
    }
  }
}

function split<T extends { id: string }>(rows: T[], isPublic: (r: T) => boolean, toDoc: (r: T) => SearchDocument, requested?: string[]) {
  const docs = rows.filter(isPublic).map(toDoc);
  const kept = new Set(docs.map((d) => d.id));
  const removed = (requested ?? rows.map((r) => r.id)).filter((id) => !kept.has(id));
  return { docs, removed };
}

// ───────── Service ─────────

export class SearchService {
  private readonly fallback: PostgresEngine;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly primary: SearchEngine,
    private readonly logger: Logger,
    private readonly redis: Redis | null = null,
  ) {
    this.fallback = new PostgresEngine(prisma);
  }

  get engineName(): 'meilisearch' | 'postgres' {
    return this.primary.name;
  }

  /** Keeps the index in step with editorial changes. Never throws: a failed index update must not fail a save. */
  async sync(type: SearchType, ids: string[]): Promise<void> {
    if (this.primary.name === 'postgres') return;
    try {
      const { docs, removed } = await buildDocuments(this.prisma, type, ids);
      await this.primary.upsert(type, docs);
      await this.primary.remove(type, removed);
    } catch (err) {
      this.logger.warn({ err: { message: (err as Error).message }, type }, 'Search index sync failed; run a reindex');
    }
  }

  async reindex(): Promise<Record<SearchType, number>> {
    const counts = { show: 0, episode: 0, person: 0, project: 0, company: 0, article: 0 };
    for (const type of SEARCH_TYPES) {
      const { docs } = await buildDocuments(this.prisma, type);
      await this.primary.replaceAll(type, docs);
      counts[type] = docs.length;
    }
    return counts;
  }

  private async hits(query: string, limit: number): Promise<{ engine: 'meilisearch' | 'postgres'; hits: SearchHits }> {
    if (this.primary.name !== 'postgres') {
      try {
        return { engine: this.primary.name, hits: await this.primary.search(query, limit) };
      } catch (err) {
        this.logger.warn({ err: { message: (err as Error).message } }, 'Search engine unavailable; using Postgres');
      }
    }
    return { engine: 'postgres', hits: await this.fallback.search(query, limit) };
  }

  /** Grouped results, hydrated from Postgres so only currently published content is returned. */
  async search(query: string): Promise<SearchResponse> {
    const { engine, hits } = await this.hits(query, GROUP_LIMIT);
    const order = <T extends { id: string }>(ids: string[], rows: T[]) => {
      const byId = new Map(rows.map((r) => [r.id, r]));
      return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    };
    const hostIds = hits.person.filter((i) => i.startsWith('host_')).map((i) => i.slice(5));
    const guestIds = hits.person.filter((i) => i.startsWith('guest_')).map((i) => i.slice(6));
    const [shows, episodes, hosts, guests, projects, companies, articles] = await Promise.all([
      this.prisma.show.findMany({ where: { id: { in: hits.show }, status: PUBLISHED }, select: showSelect }),
      this.prisma.episode.findMany({ where: { id: { in: hits.episode }, status: PUBLISHED, show: { status: PUBLISHED } }, select: episodeSelect }),
      this.prisma.host.findMany({ where: { id: { in: hostIds } }, select: { ...personSelect, isAi: true } }),
      this.prisma.guest.findMany({ where: { id: { in: guestIds } }, select: { ...personSelect, title: true } }),
      this.prisma.project.findMany({ where: { id: { in: hits.project }, status: PUBLISHED }, select: projectSelect }),
      this.prisma.company.findMany({ where: { id: { in: hits.company }, status: PUBLISHED }, select: companySelect }),
      this.prisma.article.findMany({ where: { id: { in: hits.article }, status: PUBLISHED }, select: articleSelect }),
    ]);
    const people = hits.person.flatMap((key) => {
      if (key.startsWith('host_')) {
        const h = hosts.find((x) => `host_${x.id}` === key);
        return h ? [toHostSummary(h)] : [];
      }
      const g = guests.find((x) => `guest_${x.id}` === key);
      return g ? [toGuestSummary(g)] : [];
    });
    const response: SearchResponse = {
      query,
      engine,
      shows: order(hits.show, shows).map(toShowSummary),
      episodes: order(hits.episode, episodes).map(toEpisodeSummary),
      people,
      projects: order(hits.project, projects).map(toProjectSummary),
      companies: order(hits.company, companies).map(toCompanySummary),
      articles: order(hits.article, articles).map(toArticleSummary),
    };
    const total = response.shows.length + response.episodes.length + people.length + response.projects.length + response.companies.length + response.articles.length;
    if (total > 0) await this.recordQuery(query);
    return response;
  }

  async suggest(query: string): Promise<SearchSuggestion[]> {
    const r = await this.search(query);
    const out: SearchSuggestion[] = [
      ...r.shows.map((s) => ({ type: 'show' as const, id: s.id, label: s.title, path: `/shows/${s.slug}` })),
      ...r.people.map((p) => ({ type: 'person' as const, id: p.id, label: p.name, path: `/people/${p.slug}` })),
      ...r.projects.map((p) => ({ type: 'project' as const, id: p.id, label: p.name, path: `/projects/${p.slug}` })),
      ...r.companies.map((c) => ({ type: 'company' as const, id: c.id, label: c.name, path: `/companies/${c.slug}` })),
      ...r.episodes.map((e) => ({ type: 'episode' as const, id: e.id, label: e.title, path: `/shows/${e.show.slug}/${e.slug}` })),
      ...r.articles.map((a) => ({ type: 'article' as const, id: a.id, label: a.title, path: `/news/${a.slug}` })),
    ];
    return out.slice(0, 8);
  }

  // ───── Trending (anonymous, aggregated) ─────

  private static normalise(query: string): string | null {
    const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
    // Never store things that look personal.
    if (q.length < 2 || q.length > 40 || /@|\d{6,}|0x[0-9a-f]{8,}/i.test(q)) return null;
    return q;
  }

  private async recordQuery(query: string): Promise<void> {
    const q = SearchService.normalise(query);
    if (!q || !this.redis) return;
    const key = `search:trending:${new Date().toISOString().slice(0, 10)}`;
    try {
      await this.redis.multi().zincrby(key, 1, q).expire(key, 8 * 24 * 3600).exec();
    } catch (err) {
      this.logger.debug({ err: { message: (err as Error).message } }, 'Trending search not recorded');
    }
  }

  async trending(limit = 8): Promise<string[]> {
    if (!this.redis) return [];
    const keys = Array.from({ length: 7 }, (_, i) => `search:trending:${new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)}`);
    const dest = `search:trending:week:${Date.now()}`;
    try {
      await this.redis.zunionstore(dest, keys.length, ...keys);
      const rows = await this.redis.zrevrange(dest, 0, limit - 1);
      await this.redis.del(dest);
      return rows;
    } catch {
      return [];
    }
  }
}

export function createSearchService(
  prisma: PrismaClient,
  logger: Logger,
  redis: Redis | null,
  config: { url?: string; key?: string; prefix?: string },
): SearchService {
  const engine = config.url ? new MeilisearchEngine(config.url, config.key, config.prefix) : new PostgresEngine(prisma);
  return new SearchService(prisma, engine, logger, redis);
}

