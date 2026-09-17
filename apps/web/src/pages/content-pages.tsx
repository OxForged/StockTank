import { ApiClientError } from '@stocktank/api-client';
import type { CompanySummary, EpisodeSummary, ProjectSummary, ShowSummary } from '@stocktank/types';
import { Button, EmptyState, Skeleton, cn } from '@stocktank/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Boxes, Building2, Play, Radio, Search as SearchIcon, Star, Tv } from 'lucide-react';
import { useState, type FormEvent } from 'react';

const RECENT_KEY = 'stocktank.recentSearches';

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
}

function rememberSearch(q: string): string[] {
  const next = [q, ...readRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 8);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Recent searches are a convenience only.
  }
  return next;
}

function clearRecent(): string[] {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // ignore
  }
  return [];
}
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { AdSlot } from '../components/ads/ad-slot';
import { LiveDesk } from '../components/desk/live-desk';
import { NewsletterSignup } from '../components/marketing/newsletter-signup';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';
import { LIBRARY_QUERY_KEY, useLibrary } from '../lib/library';
import { useDocumentTitle, useSeo } from '../lib/seo';
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

function Demo({ show }: { show: boolean }) {
  return show ? (
    <span className="rounded-xs border border-warning/50 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.14em] text-warning">DEMO</span>
  ) : null;
}

function Header({ kicker, title, description, children }: { kicker: string; title: string; description?: string; children?: React.ReactNode }) {
  return (
    <header className="relative overflow-hidden border-b border-hairline px-4 py-10 md:px-8 md:py-12">
      <div aria-hidden="true" className="bg-desk-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative flex flex-col gap-3">
        <span className="font-mono text-xs tracking-[0.16em] text-primary-hi">{kicker}</span>
        <h1 className="font-display text-4xl font-black italic tracking-tight md:text-6xl">{title}</h1>
        {description ? <p className="max-w-2xl text-base text-muted md:text-lg">{description}</p> : null}
        {children}
      </div>
    </header>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="m-4 flex flex-wrap items-center gap-3 rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm md:m-8">
      We could not load this page.
      <Button variant="link" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-3 py-6">
      <Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="font-mono text-xs text-muted">
        PAGE {page} / {pages}
      </span>
      <Button variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </nav>
  );
}

// ───────── Shows ─────────

function ShowTile({ show, index }: { show: ShowSummary; index: number }) {
  const bg = ['#0f2a22', '#0e1b27', '#141a26', '#0c2230', '#15261f'][index % 5];
  return (
    <Link
      to={`/shows/${show.slug}`}
      className="group flex h-full min-h-[260px] animate-rise-in flex-col justify-between gap-6 rounded-[20px] border border-[#1b2a38] p-6 text-[#f2f5f7] transition-transform duration-300 ease-out-expo hover:-translate-y-2"
      style={{ backgroundColor: bg, animationDelay: `${index * 50}ms` }}
    >
      <span className="flex items-center justify-between font-mono text-xs tracking-[0.14em] text-[#1ef0a8]">
        {show.episodeCount} EPISODES
        <Demo show={show.isDemo} />
      </span>
      <span className="flex flex-col gap-3">
        <span className="font-display text-3xl font-black italic leading-none">{show.title}</span>
        {show.tagline ? <span className="text-sm text-[#b7c4ce]">{show.tagline}</span> : null}
        <span className="text-sm font-bold text-[#1ef0a8]">View show →</span>
      </span>
    </Link>
  );
}

export function ShowsPage() {
  useDocumentTitle('Shows');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['shows', page], queryFn: () => api.content.shows(page, 24) });
  return (
    <>
      <Header kicker="ORIGINALS" title="Shows" description="Every StockTank show: formats, hosts and every episode." />
      {q.isError ? <LoadError onRetry={() => q.refetch()} /> : null}
      <div className="grid gap-5 px-4 py-8 sm:grid-cols-2 md:px-8 xl:grid-cols-3">
        {q.isPending ? (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[260px] rounded-[20px]" />)
        ) : q.data && q.data.items.length > 0 ? (
          q.data.items.map((s, i) => <ShowTile key={s.id} show={s} index={i} />)
        ) : (
          <EmptyState icon={<Tv aria-hidden="true" />} title="No shows published yet" description="Shows appear here the moment editors publish them." className="sm:col-span-2 xl:col-span-3" />
        )}
      </div>
      {q.data ? <Pager page={page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} /> : null}
    </>
  );
}

function EpisodeRow({ episode, showTitle, saved, onSave }: { episode: EpisodeSummary; showTitle: string; saved: boolean | null; onSave: () => void }) {
  const open = usePlayer((s) => s.open);
  return (
    <li className="flex items-center gap-4 rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-hairline-strong">
      <button
        type="button"
        onClick={() =>
          open({ id: episode.id, kind: 'episode', title: episode.title, showTitle, showSlug: episode.show.slug, episodeSlug: episode.slug, isDemo: episode.isDemo })
        }
        aria-label={`Play ${episode.title}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-hi transition-colors hover:bg-[#1ef0a8] hover:text-[#04110b]"
      >
        <Play className="size-4 fill-current" aria-hidden="true" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-muted">
          {episode.publishedAt ? new Date(episode.publishedAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'UNSCHEDULED'}
          {episode.durationSeconds ? ` · ${Math.round(episode.durationSeconds / 60)} MIN` : ''}
          <Demo show={episode.isDemo} />
        </span>
        <h3 className="truncate font-display text-lg font-bold">
          <Link to={`/shows/${episode.show.slug}/${episode.slug}`} className="hover:underline">
            {episode.title}
          </Link>
        </h3>
        {episode.summary ? <p className="line-clamp-1 text-sm text-muted">{episode.summary}</p> : null}
      </div>
      {saved !== null ? (
        <Button size="sm" variant={saved ? 'secondary' : 'ghost'} aria-pressed={saved} onClick={onSave}>
          <Bookmark className={cn('size-4', saved && 'fill-current text-primary-hi')} aria-hidden="true" />
          {saved ? 'Saved' : 'Save'}
        </Button>
      ) : null}
    </li>
  );
}

export function ShowDetailPage() {
  const { slug = '' } = useParams();
  const q = useQuery({ queryKey: ['show', slug], queryFn: () => api.content.show(slug), retry: false });
  const ids = useWatchlist((s) => s.ids);
  const toggle = useWatchlist((s) => s.toggle);
  const { user } = useMe();
  const library = useLibrary(Boolean(user));
  const qc = useQueryClient();
  const bookmark = useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) => (saved ? api.me.removeBookmark(id) : api.me.bookmark(id)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY }),
  });
  const savedIds = new Set((library.data?.bookmarks ?? []).map((b) => b.id));
  useSeo({
    title: q.data?.show.title ?? 'Show',
    description: q.data?.show.description ?? q.data?.show.tagline,
    jsonLd: q.data
      ? {
          '@context': 'https://schema.org',
          '@type': 'PodcastSeries',
          name: q.data.show.title,
          description: q.data.show.description ?? q.data.show.tagline ?? undefined,
          url: `${window.location.origin}/shows/${q.data.show.slug}`,
        }
      : null,
  });

  if (q.isError && q.error instanceof ApiClientError && q.error.status === 404) return <NotFoundPage />;
  if (q.isError) return <LoadError onRetry={() => q.refetch()} />;
  if (q.isPending) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  const { show, episodes } = q.data;
  const following = ids.includes(`show:${show.id}`);

  return (
    <>
      <Header kicker={`SHOW · ${show.episodeCount} EPISODES`} title={show.title} description={show.description ?? show.tagline ?? undefined}>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button variant={following ? 'secondary' : 'outline'} aria-pressed={following} onClick={() => toggle(`show:${show.id}`)}>
            <Star className={cn('size-4', following && 'fill-current text-primary-hi')} aria-hidden="true" />
            {following ? 'Following' : 'Follow'}
          </Button>
          <Demo show={show.isDemo} />
        </div>
      </Header>
      <div className="grid gap-8 px-4 py-8 md:px-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="episodes-h" className="flex flex-col gap-4">
          {q.data.hosts.length > 0 ? (
            <p className="text-sm text-muted">
              Hosted by{' '}
              {q.data.hosts.map((h, i) => (
                <span key={h.id}>
                  {i > 0 ? ', ' : ''}
                  <Link to={`/people/${h.slug}`} className="font-semibold text-fg hover:underline">
                    {h.name}
                  </Link>
                  {h.isAi ? ' (AI)' : ''}
                </span>
              ))}
            </p>
          ) : null}
          <h2 id="episodes-h" className="font-display text-2xl font-extrabold">
            Episodes
          </h2>
          {episodes.length === 0 ? (
            <p className="text-sm text-muted">No episodes published yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {episodes.map((e) => (
                <EpisodeRow
                  key={e.id}
                  episode={e}
                  showTitle={show.title}
                  saved={user ? savedIds.has(e.id) : null}
                  onSave={() => bookmark.mutate({ id: e.id, saved: savedIds.has(e.id) })}
                />
              ))}
            </ol>
          )}
        </section>
        <div className="flex flex-col gap-6">
          <AdSlot placement="episode_page" variant="sidebar" />
          <NewsletterSignup source={`show:${show.slug}`} variant="panel" />
        </div>
      </div>
    </>
  );
}

// ───────── Projects & companies ─────────

function EntityRow({ id, anchor, name, meta, description, isDemo, to }: { id: string; anchor: string; name: string; meta: string; description: string | null; isDemo: boolean; to: string }) {
  const ids = useWatchlist((s) => s.ids);
  const toggle = useWatchlist((s) => s.toggle);
  const on = ids.includes(id);
  return (
    <li id={anchor} className="flex scroll-mt-40 items-start gap-4 rounded-2xl border border-hairline bg-surface p-5 target:border-primary">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-hairline bg-raised font-display text-base font-extrabold text-primary-hi">
        {monogram(name)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h2 className="font-display text-lg font-bold">
          <Link to={to} className="hover:underline">
            {name}
          </Link>
        </h2>
        <span className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.08em] text-muted">
          {meta}
          <Demo show={isDemo} />
        </span>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => toggle(id)}
        aria-pressed={on}
        aria-label={`${on ? 'Remove' : 'Save'} ${name} ${on ? 'from' : 'to'} watchlist`}
        className={cn('flex size-11 shrink-0 items-center justify-center rounded-[10px] border transition-colors', on ? 'border-primary bg-primary-soft text-primary-hi' : 'border-hairline text-muted hover:text-fg')}
      >
        <Star className={cn('size-[18px]', on && 'animate-hy-pop fill-current')} aria-hidden="true" />
      </button>
    </li>
  );
}

const DIRECTORY_NOTE = 'Profiles are informational coverage, not recommendations. StockTank is not a broker, exchange or investment adviser. Market data connects with a licensed provider.';

export function ProjectsPage() {
  useDocumentTitle('Projects');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['projects', page], queryFn: () => api.content.projects(page, 24) });
  return (
    <>
      <Header kicker="IN THE TANK" title="Projects" description="Protocols, DAOs, infrastructure and real-world-asset projects covered on StockTank." />
      <div className="grid gap-8 px-4 py-8 md:px-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          {q.isError ? <LoadError onRetry={() => q.refetch()} /> : null}
          <ul className="flex flex-col gap-3">
            {q.isPending
              ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
              : (q.data?.items ?? []).map((p: ProjectSummary) => (
                  <EntityRow
                    key={p.id}
                    id={`project:${p.id}`}
                    anchor={p.slug}
                    to={`/projects/${p.slug}`}
                    name={p.name}
                    meta={[p.kind.replace('_', ' ').toUpperCase(), p.chainName?.toUpperCase(), p.symbol ? `$${p.symbol}` : 'NO TOKEN'].filter(Boolean).join(' · ')}
                    description={p.description}
                    isDemo={p.isDemo}
                  />
                ))}
          </ul>
          {q.data && q.data.items.length === 0 ? <EmptyState icon={<Boxes aria-hidden="true" />} title="No projects published yet" description="Project profiles appear when editors publish them." /> : null}
          {q.data ? <Pager page={page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} /> : null}
          <p className="text-xs text-muted">{DIRECTORY_NOTE}</p>
        </div>
        <AdSlot placement="project_page" variant="sidebar" />
      </div>
    </>
  );
}

export function CompaniesPage() {
  useDocumentTitle('Companies');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['companies', page], queryFn: () => api.content.companies(page, 24) });
  return (
    <>
      <Header kicker="PUBLIC MARKETS" title="Companies" description="Listed companies discussed on StockTank shows." />
      <div className="grid gap-8 px-4 py-8 md:px-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          {q.isError ? <LoadError onRetry={() => q.refetch()} /> : null}
          <ul className="flex flex-col gap-3">
            {q.isPending
              ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
              : (q.data?.items ?? []).map((c: CompanySummary) => (
                  <EntityRow
                    key={c.id}
                    id={`company:${c.id}`}
                    anchor={c.slug}
                    to={`/companies/${c.slug}`}
                    name={c.name}
                    meta={[c.ticker && c.exchange ? `${c.exchange}:${c.ticker}` : null, c.sector?.toUpperCase(), c.country?.toUpperCase()].filter(Boolean).join(' · ')}
                    description={c.description}
                    isDemo={c.isDemo}
                  />
                ))}
          </ul>
          {q.data && q.data.items.length === 0 ? <EmptyState icon={<Building2 aria-hidden="true" />} title="No companies published yet" description="Company profiles appear when editors publish them." /> : null}
          {q.data ? <Pager page={page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} /> : null}
          <p className="text-xs text-muted">{DIRECTORY_NOTE}</p>
        </div>
        <AdSlot placement="company_page" variant="sidebar" />
      </div>
    </>
  );
}

// ───────── Search ─────────

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = (params.get('q') ?? '').trim();
  useDocumentTitle(q ? `Search: ${q}` : 'Search');
  const results = useQuery({ queryKey: ['search', q], queryFn: () => api.content.search(q), enabled: q.length > 0 });
  const trending = useQuery({ queryKey: ['search', 'trending'], queryFn: () => api.content.trending(), enabled: q.length === 0 });
  const [recent, setRecent] = useState<string[]>(() => readRecent());

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get('q') ?? '').trim();
    if (value) setRecent(rememberSearch(value));
    setParams(value ? { q: value } : {});
  }

  const groups = results.data
    ? [
        { label: 'Shows', items: results.data.shows.map((s) => ({ key: s.id, title: s.title, meta: s.tagline ?? '', to: `/shows/${s.slug}`, isDemo: s.isDemo })) },
        { label: 'Episodes', items: results.data.episodes.map((e) => ({ key: e.id, title: e.title, meta: e.show.title, to: `/shows/${e.show.slug}/${e.slug}`, isDemo: e.isDemo })) },
        { label: 'People', items: results.data.people.map((p) => ({ key: `${p.role}-${p.id}`, title: p.name, meta: p.title ?? (p.role === 'host' ? 'Host' : 'Guest'), to: `/people/${p.slug}`, isDemo: p.isDemo })) },
        { label: 'Projects', items: results.data.projects.map((p) => ({ key: p.id, title: p.name, meta: p.chainName ?? '', to: `/projects/${p.slug}`, isDemo: p.isDemo })) },
        { label: 'Companies', items: results.data.companies.map((c) => ({ key: c.id, title: c.name, meta: c.sector ?? '', to: `/companies/${c.slug}`, isDemo: c.isDemo })) },
        { label: 'News', items: results.data.articles.map((a) => ({ key: a.id, title: a.title, meta: a.summary ?? '', to: `/news/${a.slug}`, isDemo: a.isDemo })) },
      ]
    : [];
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <Header kicker="DISCOVER" title="Search">
        <form role="search" onSubmit={onSubmit} className="mt-3 flex max-w-2xl gap-2">
          <label htmlFor="search-page-q" className="sr-only">
            Search StockTank
          </label>
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              id="search-page-q"
              name="q"
              type="search"
              defaultValue={q}
              key={q}
              placeholder="Shows, episodes, projects, companies…"
              className="h-12 w-full rounded-xl border border-hairline bg-raised pl-10 pr-4 text-fg placeholder:text-faint focus:border-primary focus:outline-none"
            />
          </div>
          <Button type="submit" className="h-12">
            Search
          </Button>
        </form>
      </Header>
      <div className="flex flex-col gap-8 px-4 py-8 md:px-8">
        {!q ? (
          <div className="flex flex-col gap-6">
            <p className="text-muted">Type a show, episode, person, project or company.</p>
            {recent.length > 0 ? (
              <section aria-labelledby="recent-h" className="flex flex-col gap-2">
                <h2 id="recent-h" className="font-mono text-xs tracking-[0.16em] text-muted">
                  RECENT (THIS DEVICE)
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <li key={r}>
                      <Button size="sm" variant="outline" onClick={() => setParams({ q: r })}>
                        {r}
                      </Button>
                    </li>
                  ))}
                  <li>
                    <Button size="sm" variant="ghost" onClick={() => setRecent(clearRecent())}>
                      Clear
                    </Button>
                  </li>
                </ul>
              </section>
            ) : null}
            {trending.data && trending.data.queries.length > 0 ? (
              <section aria-labelledby="trending-h" className="flex flex-col gap-2">
                <h2 id="trending-h" className="font-mono text-xs tracking-[0.16em] text-primary-hi">
                  TRENDING
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {trending.data.queries.map((t) => (
                    <li key={t}>
                      <Button size="sm" variant="secondary" onClick={() => { setRecent(rememberSearch(t)); setParams({ q: t }); }}>
                        {t}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
        {results.data ? (
          <p className="font-mono text-[11px] text-faint">Search engine: {results.data.engine}</p>
        ) : null}
        {results.isPending && q ? <Skeleton className="h-40 rounded-2xl" /> : null}
        {results.data && total === 0 ? (
          <EmptyState icon={<SearchIcon aria-hidden="true" />} title={`No results for “${q}”`} description="Try a shorter or different term." action={<Button variant="outline" onClick={() => navigate('/shows')}>Browse shows</Button>} />
        ) : null}
        {groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.label} aria-labelledby={`g-${g.label}`} className="flex flex-col gap-3">
              <h2 id={`g-${g.label}`} className="font-mono text-xs tracking-[0.16em] text-primary-hi">
                {g.label.toUpperCase()} · {g.items.length}
              </h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {g.items.map((item) => (
                  <li key={item.key}>
                    <Link to={item.to} className="flex h-full flex-col gap-1 rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-primary">
                      <span className="flex items-center gap-2 font-display text-lg font-bold">
                        {item.title}
                        <Demo show={item.isDemo} />
                      </span>
                      {item.meta ? <span className="text-sm text-muted">{item.meta}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </>
  );
}

// ───────── Live ─────────

export function LivePage() {
  useDocumentTitle('Live');
  const q = useQuery({ queryKey: ['home'], queryFn: () => api.content.home() });
  const live = q.data?.live ?? null;
  const next = q.data?.rundown.find((r) => r.status === 'scheduled') ?? null;
  return (
    <>
      <Header
        kicker="LIVE DESK"
        title={live ? 'On air now' : 'Live'}
        description="Live shows and the day’s broadcast schedule. Streaming playback connects with the live infrastructure."
      />
      <div className="grid gap-8 px-4 py-8 md:px-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        {q.isPending ? <Skeleton className="min-h-[420px] rounded-[22px]" /> : <LiveDesk live={live} next={next} />}
        <section aria-labelledby="schedule-h" className="flex flex-col gap-3">
          <h2 id="schedule-h" className="font-display text-2xl font-extrabold">
            Schedule
          </h2>
          {q.data && q.data.rundown.length === 0 ? <EmptyState icon={<Radio aria-hidden="true" />} title="Nothing scheduled" description="Upcoming broadcasts appear here." /> : null}
          <ol className="flex flex-col gap-3">
            {(q.data?.rundown ?? []).map((r) => (
              <li key={r.id} className={cn('flex flex-col gap-1 rounded-xl border bg-surface p-4', r.status === 'live' ? 'border-[#ff4d5e]' : 'border-hairline')}>
                <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-muted">
                  {r.status === 'live' ? <span className="text-[#ff4d5e]">● ON AIR</span> : new Date(r.scheduledStart).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  <Demo show={r.isDemo} />
                </span>
                <span className="font-display text-lg font-bold">{r.show?.title ?? r.title}</span>
                {r.segments.length > 0 ? <span className="text-sm text-muted">{r.segments.map((s) => s.title).join(' · ')}</span> : null}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
