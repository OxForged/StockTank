import { Router } from 'express';
import { Prisma, type PrismaClient } from '@stocktank/database';
import {
  analyticsRangeQuerySchema,
  type AudienceAnalytics,
  type ContentAnalytics,
  type ProjectAnalytics,
  type ShowAnalytics,
} from '@stocktank/types';
import { errors } from '../lib/errors.js';
import { validate } from '../lib/validate.js';
import { requirePermission } from '../middleware/auth.js';

export interface AdminAnalyticsDeps {
  prisma: PrismaClient;
}

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;

/** §29 metrics with no product feature yet (comments, likes). Reported as not tracked instead of zero. */
export const NOT_TRACKED_METRICS = ['likes', 'comments'];

export function resolveRange(q: { from?: string; to?: string }, today = new Date()): { from: string; to: string; start: Date; end: Date } {
  const to = q.to ?? today.toISOString().slice(0, 10);
  const end = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + DAY_MS);
  const from = q.from ?? new Date(end.getTime() - 30 * DAY_MS).toISOString().slice(0, 10);
  const start = new Date(`${from}T00:00:00.000Z`);
  if (start >= end) throw errors.badRequest('from must be on or before to');
  if ((end.getTime() - start.getTime()) / DAY_MS > MAX_RANGE_DAYS) throw errors.badRequest(`Ranges are limited to ${MAX_RANGE_DAYS} days`);
  return { from, to, start, end };
}

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);
const rate = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 1000 : 0);

interface EngagementRow {
  key: string | null;
  views: bigint;
  plays: bigint;
  completions: bigint;
  listen: bigint | null;
  watch: bigint | null;
  radio: bigint | null;
  downloads: bigint;
  shares: bigint;
}

function toEngagement(r: EngagementRow | undefined) {
  const plays = n(r?.plays);
  const completions = n(r?.completions);
  return {
    views: n(r?.views),
    plays,
    completions,
    completionRate: rate(completions, plays),
    listenSeconds: n(r?.listen),
    watchSeconds: n(r?.watch),
    downloads: n(r?.downloads),
    shares: n(r?.shares),
  };
}

/** Admin analytics dashboards (§29), computed from first-party events. Requires `analytics.read`. */
export function adminAnalyticsRouter({ prisma }: AdminAnalyticsDeps): Router {
  const router = Router();
  const read = requirePermission('analytics.read');

  // One aggregate shape reused by content and show dashboards; grouping column is fixed SQL, never user input.
  const engagementBy = (groupSql: Prisma.Sql, where: Prisma.Sql, start: Date, end: Date) =>
    prisma.$queryRaw<EngagementRow[]>`
      SELECT ${groupSql} AS key,
        COUNT(*) FILTER (WHERE type = 'page_view') AS views,
        COUNT(*) FILTER (WHERE type = 'play_start') AS plays,
        COUNT(*) FILTER (WHERE type = 'play_complete') AS completions,
        SUM(seconds) FILTER (WHERE type = 'play_progress' AND media_kind = 'audio') AS listen,
        SUM(seconds) FILTER (WHERE type = 'play_progress' AND media_kind = 'video') AS watch,
        SUM(seconds) FILTER (WHERE type = 'play_progress' AND media_kind = 'radio') AS radio,
        COUNT(DISTINCT (visitor_hash || ':' || entity_id || ':' || to_char(occurred_at, 'YYYY-MM-DD'))) FILTER (WHERE type = 'download') AS downloads,
        COUNT(*) FILTER (WHERE type = 'share') AS shares
      FROM analytics_events
      WHERE occurred_at >= ${start} AND occurred_at < ${end} AND ${where}
      GROUP BY 1`;

  router.get('/audience', read, async (req, res) => {
    const r = resolveRange(validate(analyticsRangeQuerySchema, req.query, 'query'));
    const web = Prisma.sql`type <> 'download'`;
    const [[totals], [mau], daily, sources, retention, searches, followersTotal, followersNew] = await Promise.all([
      prisma.$queryRaw<Array<{ visitors: bigint; views: bigint }>>`
        SELECT COUNT(DISTINCT visitor_hash) AS visitors, COUNT(*) FILTER (WHERE type = 'page_view') AS views
        FROM analytics_events WHERE occurred_at >= ${r.start} AND occurred_at < ${r.end} AND ${web}`,
      prisma.$queryRaw<Array<{ visitors: bigint }>>`
        SELECT COUNT(DISTINCT visitor_hash) AS visitors FROM analytics_events
        WHERE occurred_at >= ${new Date(r.end.getTime() - 30 * DAY_MS)} AND occurred_at < ${r.end} AND ${web}`,
      prisma.$queryRaw<Array<{ date: string; visitors: bigint; views: bigint }>>`
        SELECT to_char(occurred_at, 'YYYY-MM-DD') AS date, COUNT(DISTINCT visitor_hash) AS visitors, COUNT(*) FILTER (WHERE type = 'page_view') AS views
        FROM analytics_events WHERE occurred_at >= ${r.start} AND occurred_at < ${r.end} AND ${web}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<Array<{ source: string; visitors: bigint; views: bigint }>>`
        SELECT COALESCE(utm_source, referrer_host, 'direct') AS source, COUNT(DISTINCT visitor_hash) AS visitors, COUNT(*) FILTER (WHERE type = 'page_view') AS views
        FROM analytics_events WHERE occurred_at >= ${r.start} AND occurred_at < ${r.end} AND ${web}
        GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`,
      prisma.$queryRaw<Array<{ week: string; visitors: bigint; returned: bigint }>>`
        WITH firsts AS (
          SELECT visitor_hash, date_trunc('week', MIN(occurred_at)) AS week FROM analytics_events WHERE ${web} GROUP BY visitor_hash
        ), weeks AS (
          SELECT DISTINCT visitor_hash, date_trunc('week', occurred_at) AS week FROM analytics_events
          WHERE ${web} AND occurred_at >= ${new Date(r.start.getTime() - 7 * DAY_MS)} AND occurred_at < ${new Date(r.end.getTime() + 7 * DAY_MS)}
        )
        SELECT to_char(f.week, 'YYYY-MM-DD') AS week, COUNT(*) AS visitors, COUNT(w.visitor_hash) AS returned
        FROM firsts f LEFT JOIN weeks w ON w.visitor_hash = f.visitor_hash AND w.week = f.week + interval '7 days'
        WHERE f.week >= date_trunc('week', ${r.start}::timestamp) AND f.week < ${r.end}
        GROUP BY f.week ORDER BY f.week`,
      prisma.$queryRaw<Array<{ query: string; count: bigint }>>`
        SELECT query, COUNT(*) AS count FROM analytics_events
        WHERE type = 'search' AND query IS NOT NULL AND occurred_at >= ${r.start} AND occurred_at < ${r.end}
        GROUP BY query ORDER BY 2 DESC, 1 LIMIT 10`,
      prisma.follow.count(),
      prisma.follow.count({ where: { createdAt: { gte: r.start, lt: r.end } } }),
    ]);

    // Fill days without events so charts have a continuous axis.
    const byDate = new Map(daily.map((d) => [d.date, d]));
    const days: AudienceAnalytics['daily'] = [];
    for (let t = r.start.getTime(); t < r.end.getTime(); t += DAY_MS) {
      const date = new Date(t).toISOString().slice(0, 10);
      const row = byDate.get(date);
      days.push({ date, visitors: n(row?.visitors), pageViews: n(row?.views) });
    }

    const response: AudienceAnalytics = {
      range: { from: r.from, to: r.to },
      uniqueVisitors: n(totals?.visitors),
      mau: n(mau?.visitors),
      pageViews: n(totals?.views),
      daily: days,
      followers: { total: followersTotal, new: followersNew },
      trafficSources: sources.map((s) => ({ source: s.source, visitors: n(s.visitors), pageViews: n(s.views) })),
      retention: retention.map((c) => ({ cohortWeek: c.week, visitors: n(c.visitors), returned: n(c.returned), rate: rate(n(c.returned), n(c.visitors)) })),
      topSearches: searches.map((s) => ({ query: s.query, count: n(s.count) })),
    };
    res.json(response);
  });

  router.get('/content', read, async (req, res) => {
    const r = resolveRange(validate(analyticsRangeQuerySchema, req.query, 'query'));
    const [allRows, episodeRows, clipRows] = await Promise.all([
      engagementBy(Prisma.sql`'all'`, Prisma.sql`entity_type IN ('episode', 'clip', 'radio')`, r.start, r.end),
      engagementBy(Prisma.sql`entity_id`, Prisma.sql`entity_type = 'episode'`, r.start, r.end),
      engagementBy(Prisma.sql`entity_id`, Prisma.sql`entity_type = 'clip'`, r.start, r.end),
    ]);
    const topEpisodeRows = [...episodeRows].sort((a, b) => n(b.plays) + n(b.views) + n(b.downloads) - (n(a.plays) + n(a.views) + n(a.downloads))).slice(0, 25);
    const topClipRows = [...clipRows].sort((a, b) => n(b.plays) - n(a.plays)).slice(0, 25);
    const [episodes, clips] = await Promise.all([
      prisma.episode.findMany({ where: { id: { in: topEpisodeRows.map((e) => e.key!).filter(Boolean) } }, select: { id: true, title: true, show: { select: { title: true } } } }),
      prisma.clip.findMany({ where: { id: { in: topClipRows.map((c) => c.key!).filter(Boolean) } }, select: { id: true, title: true } }),
    ]);
    const episodeById = new Map(episodes.map((e) => [e.id, e]));
    const clipById = new Map(clips.map((c) => [c.id, c]));
    const all = allRows[0];

    const response: ContentAnalytics = {
      range: { from: r.from, to: r.to },
      totals: { ...toEngagement(all), radioSeconds: n(all?.radio) },
      topEpisodes: topEpisodeRows
        .filter((row) => row.key && episodeById.has(row.key))
        .map((row) => {
          const e = episodeById.get(row.key!)!;
          return { id: e.id, title: e.title, showTitle: e.show.title, ...toEngagement(row) };
        }),
      clips: topClipRows
        .filter((row) => row.key && clipById.has(row.key))
        .map((row) => ({ id: row.key!, title: clipById.get(row.key!)!.title, plays: n(row.plays), completions: n(row.completions), shares: n(row.shares), views: n(row.views) })),
      notTracked: NOT_TRACKED_METRICS,
    };
    res.json(response);
  });

  router.get('/shows', read, async (req, res) => {
    const r = resolveRange(validate(analyticsRangeQuerySchema, req.query, 'query'));
    const [rows, shows, followers, newFollowers] = await Promise.all([
      engagementBy(Prisma.sql`show_id`, Prisma.sql`show_id IS NOT NULL`, r.start, r.end),
      prisma.show.findMany({ select: { id: true, slug: true, title: true, isDemo: true }, orderBy: { title: 'asc' } }),
      prisma.follow.groupBy({ by: ['showId'], where: { showId: { not: null } }, _count: { _all: true } }),
      prisma.follow.groupBy({ by: ['showId'], where: { showId: { not: null }, createdAt: { gte: r.start, lt: r.end } }, _count: { _all: true } }),
    ]);
    const byShow = new Map(rows.map((row) => [row.key, row]));
    const followerMap = new Map(followers.map((f) => [f.showId, f._count._all]));
    const newFollowerMap = new Map(newFollowers.map((f) => [f.showId, f._count._all]));
    const response: ShowAnalytics = {
      range: { from: r.from, to: r.to },
      items: shows
        .map((s) => ({ ...s, ...toEngagement(byShow.get(s.id)), followers: followerMap.get(s.id) ?? 0, newFollowers: newFollowerMap.get(s.id) ?? 0 }))
        .sort((a, b) => b.plays + b.views + b.downloads - (a.plays + a.views + a.downloads) || a.title.localeCompare(b.title)),
    };
    res.json(response);
  });

  router.get('/projects', read, async (req, res) => {
    const r = resolveRange(validate(analyticsRangeQuerySchema, req.query, 'query'));
    const [views, mentionViews, projects, mentions, followers, newFollowers] = await Promise.all([
      prisma.$queryRaw<Array<{ id: string; views: bigint }>>`
        SELECT entity_id AS id, COUNT(*) AS views FROM analytics_events
        WHERE type = 'page_view' AND entity_type = 'project' AND occurred_at >= ${r.start} AND occurred_at < ${r.end}
        GROUP BY 1`,
      prisma.$queryRaw<Array<{ id: string; views: bigint }>>`
        SELECT ep.project_id AS id, COUNT(*) AS views FROM analytics_events ae
        JOIN episode_projects ep ON ep.episode_id = ae.entity_id
        WHERE ae.type = 'page_view' AND ae.entity_type = 'episode' AND ae.occurred_at >= ${r.start} AND ae.occurred_at < ${r.end}
        GROUP BY 1`,
      prisma.project.findMany({ select: { id: true, slug: true, name: true, isDemo: true }, orderBy: { name: 'asc' } }),
      prisma.episodeProject.groupBy({ by: ['projectId'], _count: { _all: true } }),
      prisma.follow.groupBy({ by: ['projectId'], where: { projectId: { not: null } }, _count: { _all: true } }),
      prisma.follow.groupBy({ by: ['projectId'], where: { projectId: { not: null }, createdAt: { gte: r.start, lt: r.end } }, _count: { _all: true } }),
    ]);
    const viewMap = new Map(views.map((v) => [v.id, n(v.views)]));
    const mentionViewMap = new Map(mentionViews.map((v) => [v.id, n(v.views)]));
    const mentionMap = new Map(mentions.map((m) => [m.projectId, m._count._all]));
    const followerMap = new Map(followers.map((f) => [f.projectId, f._count._all]));
    const newFollowerMap = new Map(newFollowers.map((f) => [f.projectId, f._count._all]));
    const response: ProjectAnalytics = {
      range: { from: r.from, to: r.to },
      items: projects
        .map((p) => ({
          ...p,
          views: viewMap.get(p.id) ?? 0,
          followers: followerMap.get(p.id) ?? 0,
          newFollowers: newFollowerMap.get(p.id) ?? 0,
          episodeMentions: mentionMap.get(p.id) ?? 0,
          mentionViews: mentionViewMap.get(p.id) ?? 0,
        }))
        .sort((a, b) => b.views + b.mentionViews - (a.views + a.mentionViews) || a.name.localeCompare(b.name)),
    };
    res.json(response);
  });

  return router;
}
