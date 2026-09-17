import type {
  ArticleSummary,
  ClipSummary,
  CompanySummary,
  EpisodeSummary,
  HomeResponse,
  LivestreamSummary,
  ProjectSummary,
  ShowSummary,
} from '@stocktank/types';
import { Skeleton, cn } from '@stocktank/ui';
import { Info, Play, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { usePlayer } from '../../stores/player';
import { useWatchlist } from '../../stores/watchlist';

const COVERS = ['#0f2a22', '#122030', '#1a1f2b', '#0c2230', '#15261f'];
const MONO_COLORS = ['#1ef0a8', '#f2f5f7'];

const monogram = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % mod;
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

function formatClipLength(start: number, end: number): string {
  const s = Math.max(0, Math.round(end - start));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function DemoTag({ show }: { show: boolean }) {
  return show ? (
    <span className="rounded-xs border border-warning/50 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.14em] text-warning">DEMO</span>
  ) : null;
}

function SectionTitle({ id, kicker, title, action }: { id: string; kicker: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs tracking-[0.16em] text-primary-hi">{kicker}</span>
        <h2 id={id} className="font-display text-3xl font-extrabold tracking-tight md:text-[40px]">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function DemoNotice() {
  return (
    <div className="flex items-start gap-3 border-b border-warning/30 bg-warning-soft px-4 py-2.5 text-xs text-fg md:px-8">
      <Info className="mt-px size-4 shrink-0 text-warning" aria-hidden="true" />
      <p>
        <strong className="font-semibold">Preview content.</strong> Shows, episodes, projects, companies and broadcasts
        marked DEMO are fictional sample data for this preview. Nothing here is market data or advice.
      </p>
    </div>
  );
}

// ───────── Latest (Episodes / Clips / Explainers) ─────────

type Tab = 'episodes' | 'clips' | 'explainers';

interface CardModel {
  id: string;
  kind: string;
  showTitle: string;
  showSlug: string;
  title: string;
  meta: string;
  to: string;
  isDemo: boolean;
  playable: 'episode' | 'clip' | null;
}

function fromEpisode(e: EpisodeSummary): CardModel {
  return {
    id: e.id,
    kind: 'EPISODE',
    showTitle: e.show.title,
    showSlug: e.show.slug,
    title: e.title,
    meta: [formatDuration(e.durationSeconds), e.publishedAt ? new Date(e.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null]
      .filter(Boolean)
      .join(' · '),
    to: `/shows/${e.show.slug}`,
    isDemo: e.isDemo,
    playable: 'episode',
  };
}

function fromClip(c: ClipSummary): CardModel {
  return {
    id: c.id,
    kind: `CLIP ${formatClipLength(c.startTime, c.endTime)}`,
    showTitle: c.show.title,
    showSlug: c.show.slug,
    title: c.title,
    meta: `From “${c.episode.title}” · linked to source timestamp`,
    to: `/shows/${c.show.slug}`,
    isDemo: c.isDemo,
    playable: 'clip',
  };
}

function fromArticle(a: ArticleSummary): CardModel {
  return {
    id: a.id,
    kind: 'EXPLAINER',
    showTitle: 'Newsroom',
    showSlug: '',
    title: a.title,
    meta: a.summary ?? '',
    to: '/news',
    isDemo: a.isDemo,
    playable: null,
  };
}

function ContentCard({ card, index }: { card: CardModel; index: number }) {
  const open = usePlayer((s) => s.open);
  const cover = COVERS[hashIndex(card.showTitle, COVERS.length)]!;
  const monoColor = MONO_COLORS[index % 2]!;

  return (
    <article
      className="group flex animate-rise-in overflow-hidden rounded-2xl border border-hairline bg-surface transition-[transform,box-shadow] duration-300 ease-out-expo hover:-translate-y-1.5 hover:shadow-raised"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="bg-desk-grid relative flex min-h-[190px] w-[42%] max-w-[190px] shrink-0 items-end p-4" style={{ backgroundColor: cover }}>
        <span aria-hidden="true" className="font-display text-[44px] font-black italic leading-none" style={{ color: monoColor }}>
          {monogram(card.showTitle)}
        </span>
        {card.playable ? (
          <button
            type="button"
            onClick={() =>
              open({ id: card.id, kind: card.playable!, title: card.title, showTitle: card.showTitle, showSlug: card.showSlug, mediaUrl: null, isDemo: card.isDemo })
            }
            aria-label={`Play ${card.title}`}
            className="absolute right-3.5 top-3.5 flex size-11 scale-90 items-center justify-center rounded-full bg-[#1ef0a8] text-[#04110b] opacity-0 transition-[opacity,transform] duration-200 group-hover:scale-100 group-hover:opacity-100 focus-visible:scale-100 focus-visible:opacity-100"
          >
            <Play className="size-4 fill-current" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-2.5 p-5">
        <span className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-primary-hi">
          {card.kind} · {card.showTitle.toUpperCase()}
          <DemoTag show={card.isDemo} />
        </span>
        <h3 className="font-display text-lg font-bold leading-snug md:text-xl">
          <Link to={card.to} className="hover:underline focus-visible:underline">
            {card.title}
          </Link>
        </h3>
        {card.meta ? <p className="mt-auto line-clamp-2 text-[13px] text-muted">{card.meta}</p> : null}
      </div>
    </article>
  );
}

export function LatestSection({ home, loading }: { home: HomeResponse | undefined; loading: boolean }) {
  const [tab, setTab] = useState<Tab>('episodes');
  const cards: Record<Tab, CardModel[]> = {
    episodes: (home?.latestEpisodes ?? []).slice(0, 4).map(fromEpisode),
    clips: (home?.clips ?? []).slice(0, 4).map(fromClip),
    explainers: (home?.explainers ?? []).slice(0, 4).map(fromArticle),
  };
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'episodes', label: 'Episodes' },
    { key: 'clips', label: 'Clips' },
    { key: 'explainers', label: 'Explainers' },
  ];

  return (
    <section aria-labelledby="latest-h" className="flex flex-col gap-6">
      <SectionTitle
        id="latest-h"
        kicker="FROM THE NETWORK"
        title="Latest on StockTank"
        action={
          <div role="tablist" aria-label="Content type" className="flex gap-1 rounded-xl border border-hairline bg-surface p-1.5">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`latest-tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls="latest-panel"
                onClick={() => setTab(t.key)}
                className={cn(
                  'h-11 rounded-lg px-4 text-sm font-semibold transition-colors',
                  tab === t.key ? 'bg-[#1ef0a8] text-[#04110b]' : 'text-muted hover:text-fg',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />
      <div id="latest-panel" role="tabpanel" aria-labelledby={`latest-tab-${tab}`} className="grid gap-5 md:grid-cols-2">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[190px] rounded-2xl" />)
        ) : cards[tab].length === 0 ? (
          <p className="rounded-2xl border border-dashed border-hairline p-8 text-sm text-muted md:col-span-2">
            Nothing published here yet. New {tab} appear the moment editors publish them.
          </p>
        ) : (
          cards[tab].map((card, i) => <ContentCard key={card.id} card={card} index={i} />)
        )}
      </div>
    </section>
  );
}

// ───────── Watchlist ─────────

interface WatchRow {
  key: string;
  anchor: string;
  mono: string;
  name: string;
  meta: string;
  isDemo: boolean;
  to: string;
}

const KIND_LABEL: Record<ProjectSummary['kind'], string> = {
  crypto_project: 'CRYPTO PROJECT',
  protocol: 'PROTOCOL',
  dao: 'DAO',
  infrastructure: 'INFRASTRUCTURE',
  rwa: 'RWA',
  ecosystem: 'ECOSYSTEM',
  application: 'APPLICATION',
  traditional_company: 'COMPANY',
};

export function WatchlistPanel({ projects, companies, loading }: { projects: ProjectSummary[]; companies: CompanySummary[]; loading: boolean }) {
  const [tab, setTab] = useState<'projects' | 'companies'>('projects');
  const ids = useWatchlist((s) => s.ids);
  const toggle = useWatchlist((s) => s.toggle);

  const rows: WatchRow[] =
    tab === 'projects'
      ? projects.map((p) => ({
          key: `project:${p.id}`,
          anchor: p.slug,
          mono: monogram(p.name),
          name: p.name,
          meta: [KIND_LABEL[p.kind], p.chainName?.toUpperCase() ?? (p.symbol ? null : 'NO TOKEN')].filter(Boolean).join(' · '),
          isDemo: p.isDemo,
          to: `/projects#${p.slug}`,
        }))
      : companies.map((c) => ({
          key: `company:${c.id}`,
          anchor: c.slug,
          mono: monogram(c.name),
          name: c.name,
          meta: [c.sector?.toUpperCase(), c.country?.toUpperCase()].filter(Boolean).join(' · '),
          isDemo: c.isDemo,
          to: `/companies#${c.slug}`,
        }));
  const followed = ids.filter((id) => id.startsWith('project:') || id.startsWith('company:')).length;

  return (
    <section aria-labelledby="watch-h" className="flex flex-col overflow-hidden rounded-[20px] border border-hairline bg-surface">
      <div className="flex flex-col gap-3.5 px-5 pb-3 pt-5">
        <div className="flex items-baseline justify-between">
          <h2 id="watch-h" className="font-display text-2xl font-extrabold">
            Watchlist
          </h2>
          <span className="text-xs text-muted">{followed} saved</span>
        </div>
        <div role="tablist" aria-label="Entity type" className="relative grid grid-cols-2 rounded-xl bg-raised p-1">
          <span
            aria-hidden="true"
            className="absolute left-1 top-1 h-10 w-[calc(50%-4px)] rounded-[9px] bg-surface shadow-card transition-transform duration-500 ease-out-expo"
            style={{ transform: tab === 'projects' ? 'translateX(0)' : 'translateX(100%)' }}
          />
          {(['projects', 'companies'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn('relative h-10 text-sm font-bold capitalize transition-colors', tab === t ? 'text-fg' : 'text-muted')}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <ul className="flex flex-col gap-0.5 px-2.5 pb-2.5">
        {loading
          ? Array.from({ length: 6 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-[64px] rounded-xl" />
              </li>
            ))
          : rows.length === 0
            ? <li className="px-3 py-6 text-sm text-muted">No {tab} published yet.</li>
            : rows.map((row, i) => {
                const on = ids.includes(row.key);
                return (
                  <li
                    key={row.key}
                    className="flex min-h-[68px] animate-rise-in items-center gap-3 rounded-xl px-2.5 py-2 transition-transform hover:translate-x-1"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <span className="flex size-[42px] shrink-0 items-center justify-center rounded-[11px] border border-hairline bg-raised font-display text-sm font-extrabold text-primary-hi">
                      {row.mono}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <Link to={row.to} className="truncate text-[15px] font-semibold hover:underline">
                        {row.name}
                      </Link>
                      <span className="flex items-center gap-2 truncate font-mono text-[10px] tracking-[0.06em] text-muted">
                        {row.meta}
                        <DemoTag show={row.isDemo} />
                      </span>
                    </span>
                    <span aria-hidden="true" className="shimmer hidden h-2.5 w-[52px] animate-hy-shimmer rounded-xs sm:block" />
                    <button
                      type="button"
                      onClick={() => toggle(row.key)}
                      aria-pressed={on}
                      aria-label={`${on ? 'Remove' : 'Save'} ${row.name} ${on ? 'from' : 'to'} watchlist`}
                      className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-[10px] border transition-colors',
                        on ? 'border-primary bg-primary-soft text-primary-hi' : 'border-hairline text-muted hover:text-fg',
                      )}
                    >
                      <Star key={String(on)} className={cn('size-[18px]', on && 'animate-hy-pop fill-current')} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
      </ul>
      <p className="mt-auto border-t border-hairline px-5 py-4 text-xs leading-relaxed text-muted">
        Watchlist is saved on this device. Profiles are informational; StockTank is not a broker, exchange or investment
        adviser. Price data connects with the market data provider.
      </p>
    </section>
  );
}

// ───────── Rundown ─────────

function slotLabel(stream: LivestreamSummary): string {
  if (stream.status === 'live') return 'NOW';
  const start = new Date(stream.scheduledStart);
  return start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function RundownSection({ rundown, loading }: { rundown: LivestreamSummary[]; loading: boolean }) {
  return (
    <section aria-labelledby="rundown-h" className="flex flex-col gap-5 px-4 pb-4 pt-10 md:px-8">
      <SectionTitle
        id="rundown-h"
        kicker="SCHEDULE"
        title="Today’s rundown"
        action={
          <Link to="/live" className="text-[15px] font-semibold text-primary-hi hover:underline">
            Full schedule →
          </Link>
        }
      />
      <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-[120px] rounded-2xl" />
            </li>
          ))
        ) : rundown.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-hairline p-6 text-sm text-muted sm:col-span-2 xl:col-span-4">
            No broadcasts scheduled today.
          </li>
        ) : (
          rundown.slice(0, 4).map((r, i) => {
            const live = r.status === 'live';
            return (
              <li
                key={r.id}
                className={cn('flex animate-rise-in flex-col gap-3 rounded-2xl border bg-surface p-[18px]', live ? 'border-[#ff4d5e]' : 'border-hairline')}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'flex h-6 items-center gap-2 rounded-md px-2.5 font-mono text-[10px] font-bold tracking-[0.1em]',
                      live ? 'bg-[#ff4d5e] text-white' : i === 1 ? 'bg-primary-soft text-primary-hi' : 'bg-raised text-muted',
                    )}
                  >
                    {live ? <span className="size-1.5 animate-live-pulse rounded-full bg-white" /> : null}
                    {live ? 'ON AIR' : i === 1 ? 'UP NEXT' : 'LATER'}
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[11px] text-muted">
                    <DemoTag show={r.isDemo} />
                    {slotLabel(r)}
                  </span>
                </div>
                <span className="font-display text-xl font-extrabold">{r.show?.title ?? r.title}</span>
                <span className="text-[13px] text-muted">
                  {r.segments.length > 0 ? `${r.segments.length} segments · ${r.segments[0]!.title}` : (r.description ?? 'Broadcast')}
                </span>
              </li>
            );
          })
        )}
      </ol>
    </section>
  );
}

// ───────── Lineup ─────────

const LINEUP_BG = ['#0f2a22', '#0e1b27', '#141a26', '#0c2230', '#15261f'];

export function LineupSection({ shows, loading }: { shows: ShowSummary[]; loading: boolean }) {
  return (
    <section aria-labelledby="lineup-h" className="flex flex-col gap-6 px-4 py-10 md:px-8">
      <SectionTitle
        id="lineup-h"
        kicker="ORIGINALS"
        title="The StockTank lineup"
        action={
          <Link to="/shows" className="text-[15px] font-semibold text-primary-hi hover:underline">
            All shows →
          </Link>
        }
      />
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-[320px] rounded-[20px]" />
              </li>
            ))
          : shows.map((show, i) => {
              const [first, ...rest] = show.title.split(' ');
              return (
                <li key={show.id}>
                  <Link
                    to={`/shows/${show.slug}`}
                    className="group relative flex h-[320px] flex-col justify-between overflow-hidden rounded-[20px] border border-[#1b2a38] p-[22px] text-[#f2f5f7] transition-transform duration-300 ease-out-expo hover:-translate-y-2 focus-visible:-translate-y-2"
                    style={{ backgroundColor: LINEUP_BG[i % LINEUP_BG.length] }}
                  >
                    <span className="flex items-center justify-between font-mono text-xs tracking-[0.14em] text-[#1ef0a8]">
                      {String(i + 1).padStart(2, '0')}
                      <DemoTag show={show.isDemo} />
                    </span>
                    <span className="flex flex-col gap-2.5">
                      <span className="font-display text-[30px] font-black italic leading-none">
                        {first}
                        {rest.length > 0 ? (
                          <>
                            <br />
                            {rest.join(' ')}
                          </>
                        ) : null}
                      </span>
                      {show.tagline ? <span className="line-clamp-3 text-sm leading-normal text-[#b7c4ce]">{show.tagline}</span> : null}
                      <span className="translate-y-2.5 text-sm font-bold text-[#1ef0a8] opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                        {show.episodeCount} episodes · View show →
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
      </ul>
    </section>
  );
}
