import { createHash } from 'node:crypto';

/**
 * Podcast RSS 2.0 feed builder (§11, Milestone 4): Apple Podcasts (itunes:*) and Podcasting 2.0 (podcast:*) tags.
 * Pure: callers supply already-published, playable episodes. StockTank owns this feed; Castopod is optional.
 */

export const FINANCIAL_DISCLAIMER = 'Informational only. Not financial or investment advice.';

export interface FeedShow {
  slug: string;
  title: string;
  description: string | null;
  author: string | null;
  coverUrl: string | null;
  language: string;
  category: string | null;
  subcategory: string | null;
  explicit: boolean;
  isDemo: boolean;
  /** Public page for the show. */
  link: string;
  /** Absolute URL this feed is served from. */
  feedUrl: string;
  ownerName: string;
  ownerEmail: string | null;
  copyright: string;
}

export interface FeedEpisode {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  link: string;
  publishedAt: Date;
  durationSeconds: number | null;
  number: number | null;
  type: 'full' | 'trailer' | 'bonus';
  audioUrl: string;
  audioBytes: number;
  imageUrl: string | null;
  isDemo: boolean;
}

export function xmlEscape(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

/** Strips characters XML 1.0 forbids (control codes pasted from other tools would break every podcast app). */
function clean(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
}

const text = (value: string) => xmlEscape(clean(value));

/** Podcasting 2.0 `podcast:guid`: UUIDv5 of the feed URL without scheme and trailing slashes. */
export function podcastGuid(feedUrl: string): string {
  const namespace = Buffer.from('ead4c236bf5858c6a2c6a6b28d128cb6', 'hex');
  const name = feedUrl.replace(/^[a-z]+:\/\//i, '').replace(/\/+$/, '');
  const hash = createHash('sha1').update(namespace).update(name).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** HH:MM:SS as Apple recommends. */
export function itunesDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

function episodeDescription(e: FeedEpisode): string {
  return [e.summary, e.description, FINANCIAL_DISCLAIMER].filter((p): p is string => Boolean(p && p.trim())).join('\n\n');
}

export function buildPodcastFeed(show: FeedShow, episodes: FeedEpisode[], now = new Date()): string {
  const demo = show.isDemo ? ' (DEMO)' : '';
  const channelDescription = [show.description, show.isDemo ? 'DEMO feed with sample content; not for public distribution.' : null, FINANCIAL_DISCLAIMER]
    .filter(Boolean)
    .join('\n\n');
  const lastBuild = episodes.reduce((max, e) => (e.publishedAt > max ? e.publishedAt : max), new Date(0));

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    '<channel>',
    `<title>${text(show.title + demo)}</title>`,
    `<link>${text(show.link)}</link>`,
    `<atom:link href="${text(show.feedUrl)}" rel="self" type="application/rss+xml"/>`,
    `<description>${text(channelDescription)}</description>`,
    `<language>${text(show.language)}</language>`,
    `<copyright>${text(show.copyright)}</copyright>`,
    `<lastBuildDate>${(episodes.length ? lastBuild : now).toUTCString()}</lastBuildDate>`,
    `<generator>StockTank</generator>`,
    `<itunes:author>${text(show.author ?? show.ownerName)}</itunes:author>`,
    `<itunes:summary>${text(channelDescription)}</itunes:summary>`,
    `<itunes:type>episodic</itunes:type>`,
    `<itunes:explicit>${show.explicit ? 'true' : 'false'}</itunes:explicit>`,
    `<itunes:owner><itunes:name>${text(show.ownerName)}</itunes:name>${show.ownerEmail ? `<itunes:email>${text(show.ownerEmail)}</itunes:email>` : ''}</itunes:owner>`,
    `<podcast:guid>${podcastGuid(show.feedUrl)}</podcast:guid>`,
  ];
  if (show.coverUrl) lines.push(`<itunes:image href="${text(show.coverUrl)}"/>`, `<image><url>${text(show.coverUrl)}</url><title>${text(show.title + demo)}</title><link>${text(show.link)}</link></image>`);
  if (show.category) {
    lines.push(
      show.subcategory
        ? `<itunes:category text="${text(show.category)}"><itunes:category text="${text(show.subcategory)}"/></itunes:category>`
        : `<itunes:category text="${text(show.category)}"/>`,
    );
  }
  // Demo feeds must never be listed by directories.
  if (show.isDemo) lines.push('<itunes:block>Yes</itunes:block>');
  if (show.ownerEmail) lines.push(`<podcast:locked owner="${text(show.ownerEmail)}">yes</podcast:locked>`);

  for (const e of episodes) {
    const description = episodeDescription(e);
    lines.push(
      '<item>',
      `<title>${text(e.title + (e.isDemo ? ' (DEMO)' : ''))}</title>`,
      `<link>${text(e.link)}</link>`,
      `<guid isPermaLink="false">stocktank:episode:${text(e.id)}</guid>`,
      `<pubDate>${e.publishedAt.toUTCString()}</pubDate>`,
      `<description>${text(description)}</description>`,
      `<content:encoded>${text(description.split('\n\n').map((p) => `<p>${xmlEscape(p)}</p>`).join(''))}</content:encoded>`,
      `<enclosure url="${text(e.audioUrl)}" length="${Math.max(0, Math.round(e.audioBytes))}" type="audio/mpeg"/>`,
      `<itunes:title>${text(e.title)}</itunes:title>`,
      `<itunes:episodeType>${e.type}</itunes:episodeType>`,
      `<itunes:explicit>${show.explicit ? 'true' : 'false'}</itunes:explicit>`,
    );
    if (e.durationSeconds) lines.push(`<itunes:duration>${itunesDuration(e.durationSeconds)}</itunes:duration>`);
    if (e.number !== null) lines.push(`<itunes:episode>${e.number}</itunes:episode>`);
    if (e.imageUrl) lines.push(`<itunes:image href="${text(e.imageUrl)}"/>`);
    lines.push('</item>');
  }
  lines.push('</channel>', '</rss>', '');
  return lines.join('\n');
}
