import { Router } from 'express';
import type { PrismaClient } from '@stocktank/database';
import type { ApiEnv } from '../env.js';
import { PUBLISHED } from '../lib/content.js';

export interface SeoDeps {
  env: ApiEnv;
  prisma: PrismaClient;
}

function xmlEscape(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

/**
 * Sitemap and RSS for published content (§46). The edge maps /sitemap.xml and /rss.xml on the public site
 * to these routes (the Vite dev proxy does the same locally).
 */
export function seoRouter({ env, prisma }: SeoDeps): Router {
  const router = Router();
  const site = env.PUBLIC_WEB_URL.replace(/\/$/, '');

  router.get('/robots.txt', (_req, res) => {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(
      ['User-agent: *', 'Allow: /', 'Disallow: /account', 'Disallow: /library', 'Disallow: /login', 'Disallow: /signup', 'Disallow: /newsletter/', 'Disallow: /api/', '', `Sitemap: ${site}/sitemap.xml`, ''].join('\n'),
    );
  });

  router.get('/sitemap.xml', async (_req, res) => {
    const [shows, episodes, projects, companies, articles, hosts, guests] = await Promise.all([
      prisma.show.findMany({ where: { status: PUBLISHED }, select: { slug: true, updatedAt: true } }),
      prisma.episode.findMany({
        where: { status: PUBLISHED, show: { status: PUBLISHED } },
        select: { slug: true, updatedAt: true, show: { select: { slug: true } } },
        orderBy: { publishedAt: 'desc' },
        take: 40_000,
      }),
      prisma.project.findMany({ where: { status: PUBLISHED }, select: { slug: true, updatedAt: true } }),
      prisma.company.findMany({ where: { status: PUBLISHED }, select: { slug: true, updatedAt: true } }),
      prisma.article.findMany({ where: { status: PUBLISHED }, select: { slug: true, updatedAt: true } }),
      prisma.host.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.guest.findMany({ where: { episodes: { some: { episode: { status: PUBLISHED } } } }, select: { slug: true, updatedAt: true } }),
    ]);
    const urls: Array<{ loc: string; lastmod?: Date }> = [
      ...['/', '/shows', '/live', '/projects', '/companies', '/news', '/advertise', '/newsletter'].map((p) => ({ loc: p })),
      ...shows.map((s) => ({ loc: `/shows/${s.slug}`, lastmod: s.updatedAt })),
      ...episodes.map((e) => ({ loc: `/shows/${e.show.slug}/${e.slug}`, lastmod: e.updatedAt })),
      ...projects.map((p) => ({ loc: `/projects/${p.slug}`, lastmod: p.updatedAt })),
      ...companies.map((c) => ({ loc: `/companies/${c.slug}`, lastmod: c.updatedAt })),
      ...articles.map((a) => ({ loc: `/news/${a.slug}`, lastmod: a.updatedAt })),
      ...[...hosts, ...guests].map((p) => ({ loc: `/people/${p.slug}`, lastmod: p.updatedAt })),
    ];
    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map(
        (u) =>
          `  <url><loc>${xmlEscape(site + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString()}</lastmod>` : ''}</url>`,
      ),
      '</urlset>',
    ].join('\n');
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=900');
    res.send(body);
  });

  /** Site feed of new episodes and articles. Podcast RSS with enclosures arrives with Castopod (Milestone 4). */
  router.get('/rss.xml', async (_req, res) => {
    const [episodes, articles] = await Promise.all([
      prisma.episode.findMany({
        where: { status: PUBLISHED, show: { status: PUBLISHED }, publishedAt: { not: null } },
        select: { title: true, slug: true, summary: true, publishedAt: true, show: { select: { slug: true, title: true } } },
        orderBy: { publishedAt: 'desc' },
        take: 30,
      }),
      prisma.article.findMany({
        where: { status: PUBLISHED, publishedAt: { not: null } },
        select: { title: true, slug: true, summary: true, publishedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 30,
      }),
    ]);
    const items = [
      ...episodes.map((e) => ({
        title: `${e.show.title}: ${e.title}`,
        link: `${site}/shows/${e.show.slug}/${e.slug}`,
        description: e.summary ?? '',
        date: e.publishedAt!,
      })),
      ...articles.map((a) => ({ title: a.title, link: `${site}/news/${a.slug}`, description: a.summary ?? '', date: a.publishedAt! })),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 40);
    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      '<channel>',
      '  <title>StockTank</title>',
      `  <link>${xmlEscape(site)}</link>`,
      `  <atom:link href="${xmlEscape(`${site}/rss.xml`)}" rel="self" type="application/rss+xml" />`,
      '  <description>On-chain stocks and crypto: shows, episodes and explainers. Informational only, not financial advice.</description>',
      '  <language>en</language>',
      ...items.map((i) =>
        [
          '  <item>',
          `    <title>${xmlEscape(i.title)}</title>`,
          `    <link>${xmlEscape(i.link)}</link>`,
          `    <guid isPermaLink="true">${xmlEscape(i.link)}</guid>`,
          `    <pubDate>${i.date.toUTCString()}</pubDate>`,
          `    <description>${xmlEscape(i.description)}</description>`,
          '  </item>',
        ].join('\n'),
      ),
      '</channel>',
      '</rss>',
    ].join('\n');
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=900');
    res.send(body);
  });

  return router;
}
