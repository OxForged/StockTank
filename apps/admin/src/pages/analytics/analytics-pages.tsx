import type { AnalyticsRangeQuery } from '@stocktank/types';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSeriesChart,
  cn,
  useReducedMotion,
  type SeriesPoint,
} from '@stocktank/ui';
import { useQuery } from '@tanstack/react-query';
import { ChartBar, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { PageTitle } from '../../components/page-title';
import { StatCard } from '../../components/stat-card';
import { api } from '../../lib/api';
import { describeApiError } from '../../lib/auth';
import { formatNumber, formatPercent } from '../../lib/format';

const PRESETS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const;

/** Range from the URL (?days=), so dashboards are linkable. Dates are UTC days ending today. */
function useRange(): { days: number; query: AnalyticsRangeQuery; setDays: (d: number) => void } {
  const [params, setParams] = useSearchParams();
  const days = Number(params.get('days')) || 30;
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const from = new Date(today.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  return { days, query: { from, to }, setDays: (d) => setParams({ days: String(d) }) };
}

function RangePicker({ days, setDays }: { days: number; setDays: (d: number) => void }) {
  return (
    <div className="mb-6 flex flex-wrap gap-1.5" role="group" aria-label="Date range">
      {PRESETS.map((p) => (
        <Button key={p.days} size="sm" variant={days === p.days ? 'secondary' : 'ghost'} aria-pressed={days === p.days} onClick={() => setDays(p.days)}>
          {p.label}
        </Button>
      ))}
    </div>
  );
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ---------------------------------------------------------------------------
 * Shared building blocks
 * ------------------------------------------------------------------------- */

/** Segmented control that swaps which series a chart shows. */
function SeriesToggle<K extends string>({ options, value, onChange, label }: { options: ReadonlyArray<{ key: K; label: string }>; value: K; onChange: (k: K) => void; label: string }) {
  return (
    <div className="flex gap-1" role="group" aria-label={label}>
      {options.map((o) => (
        <Button key={o.key} size="sm" variant={value === o.key ? 'secondary' : 'ghost'} aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
          {o.label}
        </Button>
      ))}
    </div>
  );
}

type SortDir = 'asc' | 'desc';

/** Client-side sort over a loaded list. `null` key keeps the API order (already ranked by the server). */
export function useSort<T, K extends keyof T>(items: T[]) {
  const [sort, setSort] = useState<{ key: K; dir: SortDir } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return items;
    const { key, dir } = sort;
    return [...items].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [items, sort]);
  const toggle = (key: K) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: typeof items[0]?.[key] === 'number' ? 'desc' : 'asc' }));
  return { sorted, sort, toggle };
}

function SortableHead<K extends string>({ label, sortKey, sort, onSort, className }: { label: string; sortKey: K; sort: { key: K; dir: SortDir } | null; onSort: (k: K) => void; className?: string }) {
  const active = sort?.key === sortKey;
  const Icon = active ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <TableHead aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn('inline-flex items-center gap-1 rounded-sm uppercase tracking-[0.14em] hover:text-fg focus-visible:outline-2 focus-visible:outline-ring', active && 'text-fg')}
      >
        {label}
        <Icon className={cn('size-3', !active && 'opacity-50')} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

/** Table row that rises in with a stagger; static when the viewer prefers reduced motion. */
function RevealRow({ index, className, style, ...props }: HTMLAttributes<HTMLTableRowElement> & { index: number }) {
  const reduced = useReducedMotion();
  return <TableRow className={cn(!reduced && 'animate-rise-in', className)} style={reduced ? style : { animationDelay: `${Math.min(index, 12) * 45}ms`, ...style }} {...props} />;
}

/** Horizontal bars that grow to their value on mount. */
function BarList({ items, label }: { items: Array<{ key: string; label: string; value: number; ratio: number; detail: string }>; label: string }) {
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(reduced);
  useEffect(() => {
    // Start bars at zero width for one frame so the CSS width transition can play.
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <ol className="flex flex-col gap-3" aria-label={label}>
      {items.map((it, i) => (
        <li key={it.key} className={cn('flex flex-col gap-1', !reduced && 'animate-rise-in')} style={reduced ? undefined : { animationDelay: `${Math.min(i, 12) * 60}ms` }}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="font-mono">{it.label}</span>
            <span className="text-muted tabular-nums">{it.detail}</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-raised"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(it.ratio * 100)}
            aria-label={`${it.label}: ${it.detail}`}
          >
            <div
              className="h-full rounded-full bg-primary-hi"
              style={{ width: ready ? `${Math.max(0, Math.min(100, it.ratio * 100))}%` : '0%', transition: reduced ? undefined : `width 900ms var(--ease-out-expo) ${Math.min(i, 12) * 60}ms` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Loadable<T>({ q, children }: { q: { isPending: boolean; isError: boolean; error: unknown; data: T | undefined }; children: (data: T) => ReactNode }) {
  if (q.isError) return <EmptyState icon={<ChartBar />} title="Could not load analytics" description={describeApiError(q.error)} />;
  if (q.isPending || q.data === undefined) return <Skeleton className="h-72" />;
  return <>{children(q.data)}</>;
}

const PRIVACY_NOTE = 'First-party, anonymous analytics: no IP addresses are stored and browsers with Global Privacy Control or Do Not Track are not counted, so totals are a floor.';

/* ---------------------------------------------------------------------------
 * Audience
 * ------------------------------------------------------------------------- */

const AUDIENCE_SERIES = [
  { key: 'visitors', label: 'Visitors' },
  { key: 'pageViews', label: 'Page views' },
] as const;
type AudienceSeries = (typeof AUDIENCE_SERIES)[number]['key'];

export function AudienceAnalyticsPage() {
  const { days, query, setDays } = useRange();
  const q = useQuery({ queryKey: ['admin', 'analytics', 'audience', query], queryFn: () => api.admin.analytics.audience(query) });
  const [series, setSeries] = useState<AudienceSeries>('visitors');
  return (
    <>
      <PageTitle kicker="Analytics" title="Audience" description={PRIVACY_NOTE} />
      <RangePicker days={days} setDays={setDays} />
      <Loadable q={q}>
        {(d) => {
          const today = d.daily.at(-1);
          const visitors = d.daily.map((x) => x.visitors);
          const chart: SeriesPoint[] = d.daily.map((x) => ({ label: x.date, value: series === 'visitors' ? x.visitors : x.pageViews }));
          return (
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard index={0} label="Unique visitors" value={d.uniqueVisitors} hint={`${d.range.from} → ${d.range.to}`} series={visitors} seriesLabel="Daily visitors trend" />
                <StatCard index={1} label="DAU (latest day)" value={today?.visitors ?? 0} hint={today?.date} series={visitors} seriesLabel="Daily visitors trend" />
                <StatCard index={2} label="MAU" value={d.mau} hint="30 days ending on the last day" />
                <StatCard index={3} label="Followers" value={d.followers.total} hint={`+${formatNumber(d.followers.new)} in range`} />
              </div>
              <Card>
                <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>{series === 'visitors' ? 'Daily visitors' : 'Daily page views'}</CardTitle>
                    <CardDescription>
                      {formatNumber(d.pageViews)} page views in range. Hover or use ← → to inspect a day.
                    </CardDescription>
                  </div>
                  <SeriesToggle options={AUDIENCE_SERIES} value={series} onChange={setSeries} label="Chart series" />
                </CardHeader>
                <TimeSeriesChart key={series} data={chart} kind={series === 'visitors' ? 'area' : 'bars'} height={200} label={series === 'visitors' ? 'Visitors per day' : 'Page views per day'} />
              </Card>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Traffic sources</CardTitle>
                    <CardDescription>UTM source, otherwise the referring site</CardDescription>
                  </CardHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Visitors</TableHead>
                        <TableHead className="text-right">Page views</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.trafficSources.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-sm text-muted">
                            No visits yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        d.trafficSources.map((s, i) => (
                          <RevealRow key={s.source} index={i}>
                            <TableCell className="font-mono text-xs">{s.source}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(s.visitors)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(s.pageViews)}</TableCell>
                          </RevealRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Weekly retention</CardTitle>
                    <CardDescription>Visitors first seen in a week who came back the next week</CardDescription>
                  </CardHeader>
                  {d.retention.length === 0 ? (
                    <p className="text-sm text-muted">Not enough history yet.</p>
                  ) : (
                    <BarList
                      label="Weekly retention by cohort"
                      items={d.retention.map((c) => ({
                        key: c.cohortWeek,
                        label: c.cohortWeek,
                        value: c.returned,
                        ratio: c.rate,
                        detail: `${formatNumber(c.returned)} of ${formatNumber(c.visitors)} returned · ${formatPercent(c.rate)}`,
                      }))}
                    />
                  )}
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Top searches</CardTitle>
                </CardHeader>
                <div className="flex flex-wrap gap-2">
                  {d.topSearches.length === 0 ? (
                    <span className="text-sm text-muted">No searches in range.</span>
                  ) : (
                    d.topSearches.map((s) => (
                      <Badge key={s.query} variant="mono">
                        {s.query} · {s.count}
                      </Badge>
                    ))
                  )}
                </div>
              </Card>
            </div>
          );
        }}
      </Loadable>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Content
 * ------------------------------------------------------------------------- */

export function ContentAnalyticsPage() {
  const { days, query, setDays } = useRange();
  const q = useQuery({ queryKey: ['admin', 'analytics', 'content', query], queryFn: () => api.admin.analytics.content(query) });
  return (
    <>
      <PageTitle kicker="Analytics" title="Content" description={PRIVACY_NOTE} />
      <RangePicker days={days} setDays={setDays} />
      <Loadable q={q}>
        {(d) => {
          const mix: SeriesPoint[] = [
            { label: 'Listen', value: d.totals.listenSeconds },
            { label: 'Watch', value: d.totals.watchSeconds },
            { label: 'Radio', value: d.totals.radioSeconds },
          ];
          const mixTotal = mix.reduce((s, m) => s + m.value, 0);
          return (
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard index={0} label="Plays" value={d.totals.plays} hint={`${formatPercent(d.totals.completionRate)} completed`} />
                <StatCard index={1} label="Listening time" value={d.totals.listenSeconds} format={formatDuration} hint={`Radio: ${formatDuration(d.totals.radioSeconds)}`} />
                <StatCard index={2} label="Watch time" value={d.totals.watchSeconds} format={formatDuration} />
                <StatCard index={3} label="Podcast downloads" value={d.totals.downloads} hint={`${formatNumber(d.totals.shares)} shares`} />
              </div>
              {d.notTracked.length > 0 ? (
                <p className="text-xs text-muted">Not tracked yet (no such feature on the site): {d.notTracked.join(', ')}.</p>
              ) : null}
              <Card>
                <CardHeader>
                  <CardTitle>Content mix</CardTitle>
                  <CardDescription>Time spent by medium in range: episode audio, video and live radio.</CardDescription>
                </CardHeader>
                {mixTotal === 0 ? (
                  <p className="text-sm text-muted">No listening or watching in range.</p>
                ) : (
                  <>
                    <TimeSeriesChart data={mix} kind="bars" height={160} label="Time spent by medium" formatValue={formatDuration} />
                    <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                      {mix.map((m) => (
                        <div key={m.label} className="flex flex-col">
                          <dt className="text-xs uppercase tracking-[0.1em] text-muted">{m.label}</dt>
                          <dd className="font-mono tabular-nums">
                            {formatDuration(m.value)} <span className="text-xs text-muted">({Math.round((m.value / mixTotal) * 100)}%)</span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
              </Card>
              <Card padding="none">
                <CardHeader className="p-5 pb-0">
                  <CardTitle>Top episodes</CardTitle>
                </CardHeader>
                {d.topEpisodes.length === 0 ? (
                  <p className="p-5 text-sm text-muted">No episode activity in range.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Episode</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Plays</TableHead>
                        <TableHead className="hidden text-right md:table-cell">Completion</TableHead>
                        <TableHead className="hidden text-right lg:table-cell">Listen / watch</TableHead>
                        <TableHead className="text-right">Downloads</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.topEpisodes.map((e, i) => (
                        <RevealRow key={e.id} index={i}>
                          <TableCell>
                            <p className="font-semibold">{e.title}</p>
                            <p className="text-xs text-muted">{e.showTitle}</p>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(e.views)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(e.plays)}</TableCell>
                          <TableCell className="hidden text-right tabular-nums md:table-cell">{formatPercent(e.completionRate)}</TableCell>
                          <TableCell className="hidden text-right tabular-nums lg:table-cell">
                            {formatDuration(e.listenSeconds)} / {formatDuration(e.watchSeconds)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(e.downloads)}</TableCell>
                        </RevealRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
              <Card padding="none">
                <CardHeader className="p-5 pb-0">
                  <CardTitle>Clip performance</CardTitle>
                </CardHeader>
                {d.clips.length === 0 ? (
                  <p className="p-5 text-sm text-muted">No clip plays in range.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Clip</TableHead>
                        <TableHead className="text-right">Plays</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right">Shares</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.clips.map((c, i) => (
                        <RevealRow key={c.id} index={i}>
                          <TableCell className="font-semibold">{c.title}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(c.plays)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(c.completions)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(c.shares)}</TableCell>
                        </RevealRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </div>
          );
        }}
      </Loadable>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Shows and Projects (sortable). The API returns totals per item, not a daily
 * series, so these tables carry no sparklines rather than invented ones.
 * ------------------------------------------------------------------------- */

type ShowRow = Awaited<ReturnType<typeof api.admin.analytics.shows>>['items'][number];
type ShowSortKey = 'title' | 'views' | 'plays' | 'completionRate' | 'listenSeconds' | 'downloads' | 'followers';

function ShowsTable({ items }: { items: ShowRow[] }) {
  const { sorted, sort, toggle } = useSort<ShowRow, ShowSortKey>(items);
  const head = (label: string, key: ShowSortKey, className?: string) => <SortableHead label={label} sortKey={key} sort={sort} onSort={toggle} className={className} />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {head('Show', 'title')}
          {head('Views', 'views', 'text-right')}
          {head('Plays', 'plays', 'text-right')}
          {head('Completion', 'completionRate', 'hidden text-right md:table-cell')}
          {head('Listen / watch', 'listenSeconds', 'hidden text-right lg:table-cell')}
          {head('Downloads', 'downloads', 'text-right')}
          {head('Followers', 'followers', 'text-right')}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((s, i) => (
          <RevealRow key={s.id} index={i}>
            <TableCell className="font-semibold">
              {s.title} {s.isDemo ? <Badge variant="mono">DEMO</Badge> : null}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(s.views)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(s.plays)}</TableCell>
            <TableCell className="hidden text-right tabular-nums md:table-cell">{formatPercent(s.completionRate)}</TableCell>
            <TableCell className="hidden text-right tabular-nums lg:table-cell">
              {formatDuration(s.listenSeconds)} / {formatDuration(s.watchSeconds)}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(s.downloads)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(s.followers)} <span className="text-xs text-muted">+{formatNumber(s.newFollowers)}</span>
            </TableCell>
          </RevealRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ShowAnalyticsPage() {
  const { days, query, setDays } = useRange();
  const q = useQuery({ queryKey: ['admin', 'analytics', 'shows', query], queryFn: () => api.admin.analytics.shows(query) });
  return (
    <>
      <PageTitle kicker="Analytics" title="Shows" description={PRIVACY_NOTE} />
      <RangePicker days={days} setDays={setDays} />
      <Loadable q={q}>
        {(d) =>
          d.items.length === 0 ? (
            <EmptyState icon={<ChartBar />} title="No shows yet" description="Show performance appears once shows exist." />
          ) : (
            <ShowsTable items={d.items} />
          )
        }
      </Loadable>
    </>
  );
}

type ProjectRow = Awaited<ReturnType<typeof api.admin.analytics.projects>>['items'][number];
type ProjectSortKey = 'name' | 'views' | 'episodeMentions' | 'mentionViews' | 'followers';

function ProjectsTable({ items }: { items: ProjectRow[] }) {
  const { sorted, sort, toggle } = useSort<ProjectRow, ProjectSortKey>(items);
  const head = (label: string, key: ProjectSortKey, className?: string) => <SortableHead label={label} sortKey={key} sort={sort} onSort={toggle} className={className} />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {head('Project', 'name')}
          {head('Profile views', 'views', 'text-right')}
          {head('Mentions', 'episodeMentions', 'text-right')}
          {head('Mention views', 'mentionViews', 'hidden text-right md:table-cell')}
          {head('Followers', 'followers', 'text-right')}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((p, i) => (
          <RevealRow key={p.id} index={i}>
            <TableCell className="font-semibold">
              {p.name} {p.isDemo ? <Badge variant="mono">DEMO</Badge> : null}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(p.views)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(p.episodeMentions)}</TableCell>
            <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNumber(p.mentionViews)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(p.followers)} <span className="text-xs text-muted">+{formatNumber(p.newFollowers)}</span>
            </TableCell>
          </RevealRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ProjectAnalyticsPage() {
  const { days, query, setDays } = useRange();
  const q = useQuery({ queryKey: ['admin', 'analytics', 'projects', query], queryFn: () => api.admin.analytics.projects(query) });
  return (
    <>
      <PageTitle kicker="Analytics" title="Projects" description={`Interest in covered projects. Informational only. ${PRIVACY_NOTE}`} />
      <RangePicker days={days} setDays={setDays} />
      <Loadable q={q}>
        {(d) =>
          d.items.length === 0 ? (
            <EmptyState icon={<ChartBar />} title="No projects yet" description="Project analytics appear once profiles exist." />
          ) : (
            <ProjectsTable items={d.items} />
          )
        }
      </Loadable>
    </>
  );
}
