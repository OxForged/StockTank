import { ApiClientError } from '@stocktank/api-client';
import type { EpisodeSummary, PersonSummary } from '@stocktank/types';
import { Button, EmptyState, Skeleton, cn } from '@stocktank/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Bot, Newspaper, Play, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import { AdSlot } from '../components/ads/ad-slot';
import { NewsletterSignup } from '../components/marketing/newsletter-signup';
import { api } from '../lib/api';
import { ORGANIZATION_LD, useSeo } from '../lib/seo';
import { usePlayer } from '../stores/player';
import { useWatchlist } from '../stores/watchlist';
import { NotFoundPage } from './not-found-page';

const monogram = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export function episodePath(e: Pick<EpisodeSummary, 'slug' | 'show'>): string {
  return `/shows/${e.show.slug}/${e.slug}`;
}

function Demo({ show }: { show: boolean }) {
  return show ? (
    <span className="rounded-xs border border-warning/50 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.14em] text-warning">DEMO</span>
  ) : null;
}

function Hero({ kicker, title, children }: { kicker: ReactNode; title: string; children?: ReactNode }) {
  return (
    <header className="relative overflow-hidden border-b border-hairline px-4 py-10 md:px-8 md:py-12">
      <div aria-hidden="true" className="bg-desk-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative flex flex-col gap-3">
        <span className="flex flex-wrap items-center gap-2 font-mono text-xs tracking-[0.16em] text-primary-hi">{kicker}</span>
        <h1 className="max-w-4xl font-display text-4xl font-black italic leading-[1.02] tracking-tight md:text-6xl">{title}</h1>
        {children}
      </div>
    </header>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-4 p-8" aria-busy="true">
      <Skeleton className="h-16 w-2/3" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function useDetail<T>(key: unknown[], fn: () => Promise<T>) {
  return useQuery({ queryKey: key, queryFn: fn, retry: false });
}

const isNotFound = (err: unknown) => err instanceof ApiClientError && err.status === 404;

function Retry({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="m-4 flex items-center gap-3 rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm md:m-8">
      This page could not be loaded.
      <Button variant="link" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function EpisodeList({ episodes, empty }: { episodes: EpisodeSummary[]; empty: string }) {
  if (episodes.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {episodes.map((e) => (
        <li key={e.id}>
          <Link to={episodePath(e)} className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-primary">
            <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-primary-hi">
              {e.show.title.toUpperCase()}
              {e.publishedAt ? <span className="text-muted">· {new Date(e.publishedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span> : null}
              <Demo show={e.isDemo} />
            </span>
            <span className="font-display text-lg font-bold">{e.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PersonChip({ person }: { person: PersonSummary }) {
  return (
    <Link to={`/people/${person.slug}`} className="flex items-center gap-3 rounded-xl border border-hairline bg-surface p-3 transition-colors hover:border-primary">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-raised font-display text-sm font-extrabold text-primary-hi">
        {monogram(person.name)}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-semibold">
          {person.name}
          {person.isAi ? (
            <span className="inline-flex items-center gap-1 rounded-xs border border-info/40 px-1 font-mono text-[9px] font-bold tracking-[0.12em] text-info">
              <Bot className="size-3" aria-hidden="true" />
              AI
            </span>
          ) : null}
        </span>
        <span className="block truncate text-xs text-muted">{person.title ?? (person.role === 'host' ? 'Host' : 'Guest')}</span>
      </span>
    </Link>
  );
}

function FollowButton({ id, label }: { id: string; label: string }) {
  const ids = useWatchlist((s) => s.ids);
  const toggle = useWatchlist((s) => s.toggle);
  const on = ids.includes(id);
  return (
    <Button variant={on ? 'secondary' : 'outline'} aria-pressed={on} onClick={() => toggle(id)} className="self-start">
      <Star className={cn('size-4', on && 'fill-current text-primary-hi')} aria-hidden="true" />
      {on ? `Following ${label}` : `Follow ${label}`}
    </Button>
  );
}

const DISCLAIMER_NOTE = 'Informational coverage only. StockTank is not a broker, exchange or investment adviser, and nothing here is a recommendation.';

// ───────── Episode ─────────

export function EpisodePage() {
  const { slug = '', episodeSlug = '' } = useParams();
  const q = useDetail(['episode', slug, episodeSlug], () => api.content.episode(slug, episodeSlug));
  const open = usePlayer((s) => s.open);
  const data = q.data;
  useSeo({
    title: data ? `${data.episode.title} · ${data.episode.show.title}` : 'Episode',
    description: data?.episode.summary,
    type: 'video.episode',
    jsonLd: data
      ? {
          '@context': 'https://schema.org',
          '@type': 'PodcastEpisode',
          name: data.episode.title,
          description: data.episode.summary ?? undefined,
          datePublished: data.episode.publishedAt ?? undefined,
          timeRequired: data.episode.durationSeconds ? `PT${Math.round(data.episode.durationSeconds / 60)}M` : undefined,
          partOfSeries: { '@type': 'PodcastSeries', name: data.episode.show.title, url: `${window.location.origin}/shows/${data.episode.show.slug}` },
          actor: [...data.hosts, ...data.guests].map((p) => ({ '@type': 'Person', name: p.name })),
          publisher: ORGANIZATION_LD,
        }
      : null,
  });

  if (q.isError) return isNotFound(q.error) ? <NotFoundPage /> : <Retry onRetry={() => q.refetch()} />;
  if (!data) return <Loading />;
  const { episode } = data;

  return (
    <>
      <Hero
        kicker={
          <>
            <Link to={`/shows/${episode.show.slug}`} className="hover:underline">
              {episode.show.title.toUpperCase()}
            </Link>
            {episode.number !== null ? <span className="text-muted">· EPISODE {episode.number}</span> : null}
            <Demo show={episode.isDemo} />
          </>
        }
        title={episode.title}
      >
        <p className="font-mono text-xs text-muted">
          {[episode.publishedAt ? new Date(episode.publishedAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : null, episode.durationSeconds ? `${Math.round(episode.durationSeconds / 60)} min` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <Button
          className="mt-2 self-start"
          onClick={() => open({ id: episode.id, kind: 'episode', title: episode.title, showTitle: episode.show.title, showSlug: episode.show.slug, mediaUrl: null, isDemo: episode.isDemo })}
        >
          <Play className="size-4 fill-current" aria-hidden="true" />
          Play episode
        </Button>
      </Hero>

      <div className="grid gap-8 px-4 py-8 md:px-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-8">
          {episode.summary ? <p className="text-lg text-muted">{episode.summary}</p> : null}
          {episode.description ? (
            <section aria-labelledby="notes-h" className="flex flex-col gap-3">
              <h2 id="notes-h" className="font-display text-2xl font-extrabold">
                Show notes
              </h2>
              <div className="whitespace-pre-line leading-relaxed text-fg/90">{episode.description}</div>
            </section>
          ) : null}

          {data.hosts.length + data.guests.length > 0 ? (
            <section aria-labelledby="people-h" className="flex flex-col gap-3">
              <h2 id="people-h" className="font-display text-2xl font-extrabold">
                On this episode
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {[...data.hosts, ...data.guests].map((p) => (
                  <li key={`${p.role}-${p.id}`}>
                    <PersonChip person={p} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.projects.length + data.companies.length > 0 ? (
            <section aria-labelledby="mentioned-h" className="flex flex-col gap-3">
              <h2 id="mentioned-h" className="font-display text-2xl font-extrabold">
                Discussed
              </h2>
              <ul className="flex flex-wrap gap-2">
                {data.projects.map((p) => (
                  <li key={p.id}>
                    <Link to={`/projects/${p.slug}`} className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 text-sm font-semibold hover:border-primary">
                      {p.name}
                      <span className="font-mono text-[10px] text-muted">PROJECT</span>
                    </Link>
                  </li>
                ))}
                {data.companies.map((c) => (
                  <li key={c.id}>
                    <Link to={`/companies/${c.slug}`} className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 text-sm font-semibold hover:border-primary">
                      {c.name}
                      <span className="font-mono text-[10px] text-muted">COMPANY</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">{DISCLAIMER_NOTE}</p>
            </section>
          ) : null}

          {data.clips.length > 0 ? (
            <section aria-labelledby="clips-h" className="flex flex-col gap-3">
              <h2 id="clips-h" className="font-display text-2xl font-extrabold">
                Clips from this episode
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.clips.map((c) => (
                  <li key={c.id} className="rounded-xl border border-hairline bg-surface p-4">
                    <span className="font-mono text-[11px] text-muted">
                      {Math.floor(c.startTime / 60)}:{String(Math.floor(c.startTime % 60)).padStart(2, '0')} – {Math.floor(c.endTime / 60)}:
                      {String(Math.floor(c.endTime % 60)).padStart(2, '0')}
                    </span>
                    <p className="font-semibold">{c.title}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="more-h" className="flex flex-col gap-3">
            <h2 id="more-h" className="font-display text-2xl font-extrabold">
              More from {episode.show.title}
            </h2>
            <EpisodeList episodes={data.moreFromShow} empty="No other episodes yet." />
          </section>
        </div>
        <aside className="flex flex-col gap-6">
          <AdSlot placement="episode_page" variant="sidebar" />
          <NewsletterSignup source={`episode:${episode.show.slug}`} variant="panel" />
        </aside>
      </div>
    </>
  );
}

// ───────── Project ─────────

export function ProjectPage() {
  const { slug = '' } = useParams();
  const q = useDetail(['project', slug], () => api.content.project(slug));
  const p = q.data?.project;
  useSeo({
    title: p?.name ?? 'Project',
    description: p?.description,
    jsonLd: p ? { '@context': 'https://schema.org', '@type': 'Organization', name: p.name, url: p.website ?? undefined, description: p.description ?? undefined } : null,
  });
  if (q.isError) return isNotFound(q.error) ? <NotFoundPage /> : <Retry onRetry={() => q.refetch()} />;
  if (!q.data || !p) return <Loading />;

  const facts: Array<[string, ReactNode]> = [
    ['Type', p.kind.replace(/_/g, ' ')],
    ['Chain', p.chainName ?? '—'],
    ['Token', p.symbol ? `$${p.symbol}` : 'No token'],
    ['Verified', p.verified ? 'Verified by StockTank editorial' : 'Not verified'],
  ];
  return (
    <>
      <Hero
        kicker={
          <>
            PROJECT <Demo show={p.isDemo} />
          </>
        }
        title={p.name}
      >
        {p.description ? <p className="max-w-3xl text-lg text-muted">{p.description}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <FollowButton id={`project:${p.id}`} label={p.name} />
          {p.website ? (
            <Button asChild variant="ghost">
              <a href={p.website} target="_blank" rel="noopener noreferrer nofollow">
                Website <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
          {p.explorerUrl ? (
            <Button asChild variant="ghost">
              <a href={p.explorerUrl} target="_blank" rel="noopener noreferrer nofollow">
                Contract on explorer <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
        </div>
      </Hero>
      <div className="grid gap-8 px-4 py-8 md:px-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-8">
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {facts.map(([k, v]) => (
              <div key={k} className="rounded-xl border border-hairline bg-surface p-4">
                <dt className="font-mono text-[11px] tracking-[0.12em] text-muted">{k.toUpperCase()}</dt>
                <dd className="mt-1 font-semibold capitalize">{v}</dd>
              </div>
            ))}
          </dl>
          <section aria-labelledby="coverage-h" className="flex flex-col gap-3">
            <h2 id="coverage-h" className="font-display text-2xl font-extrabold">
              Coverage on StockTank
            </h2>
            <EpisodeList episodes={q.data.episodes} empty="No episodes have discussed this project yet." />
          </section>
          <p className="text-xs text-muted">{DISCLAIMER_NOTE} Market data connects with a licensed provider.</p>
        </div>
        <AdSlot placement="project_page" variant="sidebar" />
      </div>
    </>
  );
}

// ───────── Company ─────────

export function CompanyPage() {
  const { slug = '' } = useParams();
  const q = useDetail(['company', slug], () => api.content.company(slug));
  const c = q.data?.company;
  useSeo({
    title: c?.name ?? 'Company',
    description: c?.description,
    jsonLd: c
      ? {
          '@context': 'https://schema.org',
          '@type': 'Corporation',
          name: c.name,
          url: c.website ?? undefined,
          tickerSymbol: c.ticker && c.exchange ? `${c.exchange} ${c.ticker}` : undefined,
        }
      : null,
  });
  if (q.isError) return isNotFound(q.error) ? <NotFoundPage /> : <Retry onRetry={() => q.refetch()} />;
  if (!q.data || !c) return <Loading />;
  return (
    <>
      <Hero
        kicker={
          <>
            COMPANY {c.ticker ? <span className="text-muted">· {c.exchange ? `${c.exchange}:` : ''}{c.ticker}</span> : null} <Demo show={c.isDemo} />
          </>
        }
        title={c.name}
      >
        {c.description ? <p className="max-w-3xl text-lg text-muted">{c.description}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <FollowButton id={`company:${c.id}`} label={c.name} />
          {c.website ? (
            <Button asChild variant="ghost">
              <a href={c.website} target="_blank" rel="noopener noreferrer nofollow">
                Website <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
        </div>
      </Hero>
      <div className="grid gap-8 px-4 py-8 md:px-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-8">
          <dl className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ['Sector', c.sector],
                ['Industry', c.industry],
                ['Country', c.country],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-hairline bg-surface p-4">
                <dt className="font-mono text-[11px] tracking-[0.12em] text-muted">{k.toUpperCase()}</dt>
                <dd className="mt-1 font-semibold">{v ?? '—'}</dd>
              </div>
            ))}
          </dl>
          <section aria-labelledby="coverage-h" className="flex flex-col gap-3">
            <h2 id="coverage-h" className="font-display text-2xl font-extrabold">
              Coverage on StockTank
            </h2>
            <EpisodeList episodes={q.data.episodes} empty="No episodes have discussed this company yet." />
          </section>
          <p className="text-xs text-muted">{DISCLAIMER_NOTE}</p>
        </div>
        <AdSlot placement="company_page" variant="sidebar" />
      </div>
    </>
  );
}

// ───────── Person ─────────

export function PersonPage() {
  const { slug = '' } = useParams();
  const q = useDetail(['person', slug], () => api.content.person(slug));
  const p = q.data?.person;
  useSeo({
    title: p?.name ?? 'Person',
    description: p?.bio,
    type: 'profile',
    jsonLd: p ? { '@context': 'https://schema.org', '@type': 'Person', name: p.name, jobTitle: p.title ?? undefined, url: p.website ?? undefined } : null,
  });
  if (q.isError) return isNotFound(q.error) ? <NotFoundPage /> : <Retry onRetry={() => q.refetch()} />;
  if (!q.data || !p) return <Loading />;
  return (
    <>
      <Hero
        kicker={
          <>
            {p.role === 'host' ? 'HOST' : 'GUEST'} <Demo show={p.isDemo} />
          </>
        }
        title={p.name}
      >
        {p.isAi ? (
          <p role="note" className="flex max-w-2xl items-start gap-2 rounded-lg border border-info/40 bg-info/10 p-3 text-sm">
            <Bot className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
            {p.name} is an AI personality. Its segments are produced with AI and reviewed by StockTank editors.{' '}
            <Link to="/legal/ai-disclosure" className="underline">
              AI disclosure
            </Link>
          </p>
        ) : null}
        {p.title ? <p className="text-lg text-muted">{p.title}</p> : null}
        {p.bio ? <p className="max-w-3xl text-muted">{p.bio}</p> : null}
        <div className="flex flex-wrap gap-2">
          {p.twitter ? (
            <Button asChild variant="ghost">
              <a href={`https://x.com/${p.twitter.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer nofollow">
                @{p.twitter.replace(/^@/, '')} <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
          {p.website ? (
            <Button asChild variant="ghost">
              <a href={p.website} target="_blank" rel="noopener noreferrer nofollow">
                Website <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
        </div>
      </Hero>
      <section aria-labelledby="appearances-h" className="flex flex-col gap-3 px-4 py-8 md:px-8">
        <h2 id="appearances-h" className="font-display text-2xl font-extrabold">
          Episodes
        </h2>
        <EpisodeList episodes={q.data.episodes} empty="No published episodes yet." />
      </section>
    </>
  );
}

// ───────── News ─────────

export function NewsPage() {
  useSeo({ title: 'News & explainers', description: 'Explainers and newsroom coverage from StockTank, with sources credited.' });
  const q = useQuery({ queryKey: ['articles'], queryFn: () => api.content.articles(1, 50) });
  return (
    <>
      <Hero kicker="NEWSROOM" title="News & explainers">
        <p className="max-w-2xl text-muted">Original explainers and summaries. When we cover outside reporting, we summarise it and link the source.</p>
      </Hero>
      <div className="px-4 py-8 md:px-8">
        {q.isError ? <Retry onRetry={() => q.refetch()} /> : null}
        {q.isPending ? (
          <Skeleton className="h-60 rounded-2xl" />
        ) : q.data && q.data.items.length === 0 ? (
          <EmptyState icon={<Newspaper aria-hidden="true" />} title="No articles published yet" description="New explainers appear here when editors publish them." />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(q.data?.items ?? []).map((a) => (
              <li key={a.id}>
                <Link to={`/news/${a.slug}`} className="flex h-full flex-col gap-2 rounded-2xl border border-hairline bg-surface p-5 transition-colors hover:border-primary">
                  <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-muted">
                    {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : ''}
                    <Demo show={a.isDemo} />
                  </span>
                  <span className="font-display text-xl font-bold">{a.title}</span>
                  {a.summary ? <span className="text-sm text-muted">{a.summary}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function ArticlePage() {
  const { slug = '' } = useParams();
  const q = useDetail(['article', slug], () => api.content.article(slug));
  const a = q.data?.article;
  useSeo({
    title: a?.title ?? 'Article',
    description: a?.summary,
    type: 'article',
    jsonLd: a
      ? {
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: a.title,
          description: a.summary ?? undefined,
          datePublished: a.publishedAt ?? undefined,
          author: a.author ? { '@type': 'Person', name: a.author } : ORGANIZATION_LD,
          publisher: ORGANIZATION_LD,
          isBasedOn: a.originalUrl ?? undefined,
        }
      : null,
  });
  if (q.isError) return isNotFound(q.error) ? <NotFoundPage /> : <Retry onRetry={() => q.refetch()} />;
  if (!a) return <Loading />;
  return (
    <article>
      <Hero
        kicker={
          <>
            <Link to="/news" className="hover:underline">
              NEWSROOM
            </Link>
            <Demo show={a.isDemo} />
          </>
        }
        title={a.title}
      >
        <p className="font-mono text-xs text-muted">
          {[a.author, a.publishedAt ? new Date(a.publishedAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : null].filter(Boolean).join(' · ')}
        </p>
      </Hero>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 md:px-8">
        {a.summary ? <p className="text-xl leading-relaxed text-muted">{a.summary}</p> : null}
        {a.body ? <div className="whitespace-pre-line text-lg leading-relaxed">{a.body}</div> : null}
        {a.originalUrl ? (
          <p className="rounded-lg border border-hairline bg-surface p-3 text-sm">
            Source:{' '}
            <a href={a.originalUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-primary-hi underline">
              {new URL(a.originalUrl).hostname}
            </a>
          </p>
        ) : null}
        <p className="text-xs text-muted">StockTank is a media company. This article is for information only and is not financial or investment advice.</p>
      </div>
    </article>
  );
}
