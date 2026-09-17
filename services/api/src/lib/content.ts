import type { Prisma } from '@stocktank/database';
import type {
  ArticleSummary,
  ClipSummary,
  CompanySummary,
  EpisodeSummary,
  LivestreamSummary,
  ProjectSummary,
  ShowSummary,
} from '@stocktank/types';
import { toClipMedia, type MediaService } from './media.js';

/** Only published content is public; drafts and review items never leave the admin. */
export const PUBLISHED = 'published' as const;

export const showSelect = {
  id: true,
  slug: true,
  title: true,
  tagline: true,
  description: true,
  coverUrl: true,
  isDemo: true,
  _count: { select: { episodes: { where: { status: PUBLISHED } } } },
} satisfies Prisma.ShowSelect;

export function toShowSummary(row: Prisma.ShowGetPayload<{ select: typeof showSelect }>): ShowSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    coverUrl: row.coverUrl,
    episodeCount: row._count.episodes,
    isDemo: row.isDemo,
  };
}

export const episodeSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  coverUrl: true,
  durationSeconds: true,
  publishedAt: true,
  isDemo: true,
  show: { select: { slug: true, title: true } },
} satisfies Prisma.EpisodeSelect;

export function toEpisodeSummary(row: Prisma.EpisodeGetPayload<{ select: typeof episodeSelect }>): EpisodeSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    coverUrl: row.coverUrl,
    durationSeconds: row.durationSeconds,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    show: row.show,
    isDemo: row.isDemo,
  };
}

export const clipSelect = {
  id: true,
  title: true,
  startTime: true,
  endTime: true,
  isDemo: true,
  renderStatus: true,
  renditions: true,
  sourceEpisode: { select: { slug: true, title: true, show: { select: { slug: true, title: true } } } },
} satisfies Prisma.ClipSelect;

export function toClipSummary(row: Prisma.ClipGetPayload<{ select: typeof clipSelect }>, publicUrl: MediaService['publicUrl']): ClipSummary {
  return {
    id: row.id,
    title: row.title,
    startTime: row.startTime,
    endTime: row.endTime,
    episode: { slug: row.sourceEpisode.slug, title: row.sourceEpisode.title },
    show: row.sourceEpisode.show,
    media: toClipMedia(row, publicUrl),
    isDemo: row.isDemo,
  };
}

export const articleSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  publishedAt: true,
  isDemo: true,
  source: { select: { name: true } },
} satisfies Prisma.ArticleSelect;

export function toArticleSummary(row: Prisma.ArticleGetPayload<{ select: typeof articleSelect }>): ArticleSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    sourceName: row.source?.name ?? null,
    isDemo: row.isDemo,
  };
}

export const projectSelect = {
  id: true,
  slug: true,
  name: true,
  symbol: true,
  kind: true,
  description: true,
  logoUrl: true,
  verified: true,
  isDemo: true,
  chain: { select: { name: true } },
} satisfies Prisma.ProjectSelect;

export function toProjectSummary(row: Prisma.ProjectGetPayload<{ select: typeof projectSelect }>): ProjectSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    symbol: row.symbol,
    kind: row.kind,
    description: row.description,
    chainName: row.chain?.name ?? null,
    logoUrl: row.logoUrl,
    verified: row.verified,
    isDemo: row.isDemo,
  };
}

export const companySelect = {
  id: true,
  slug: true,
  name: true,
  ticker: true,
  exchange: true,
  sector: true,
  country: true,
  description: true,
  logoUrl: true,
  isDemo: true,
} satisfies Prisma.CompanySelect;

export function toCompanySummary(row: Prisma.CompanyGetPayload<{ select: typeof companySelect }>): CompanySummary {
  return { ...row };
}

export const livestreamSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  scheduledStart: true,
  scheduledEnd: true,
  streamUrl: true,
  isDemo: true,
  show: { select: { slug: true, title: true } },
  segments: { select: { position: true, title: true }, orderBy: { position: 'asc' } },
} satisfies Prisma.LivestreamSelect;

export function toLivestreamSummary(
  row: Prisma.LivestreamGetPayload<{ select: typeof livestreamSelect }>,
): LivestreamSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    scheduledStart: row.scheduledStart.toISOString(),
    scheduledEnd: row.scheduledEnd?.toISOString() ?? null,
    streamUrl: row.streamUrl,
    show: row.show,
    segments: row.segments,
    isDemo: row.isDemo,
  };
}
