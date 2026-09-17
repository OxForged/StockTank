import type { AnalyticsRangeQuery } from '@stocktank/types';
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, EmptyState, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@stocktank/ui';
import { useQuery } from '@tanstack/react-query';
import { ChartBar } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { PageTitle } from '../../components/page-title';
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
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card>
      <div className="flex flex-col gap-1 p-5">
        <span className="text-xs uppercase tracking-[0.1em] text-muted">{label}</span>
        <span className="font-display text-3xl font-extrabold tabular-nums">{value}</span>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </div>
    </Card>
  );
}

/** Accessible bar chart: bars are decorative; the data is also available as a visually hidden table. */
function DailyBars({ data, label }: { data: Array<{ date: string; value: number }>; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex h-40 items-end gap-[2px]" aria-hidden="true">
        {data.map((d) => (
          <div key={d.date} className="flex-1 rounded-t bg-primary/70 hover:bg-primary" style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} title={`${d.date}: ${d.value}`} />
        ))}
      </div>
      <figcaption className="flex justify-between font-mono text-[11px] text-muted">
        <span>{data[0]?.date}</span>
        <span>{label}</span>
        <span>{data.at(-1)?.date}</span>
      </figcaption>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.date}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Loadable<T>({ q, children }: { q: { isPending: boolean; isError: boolean; error: unknown; data: T | undefined }; children: (data: T) => ReactNode }) {
  if (q.isError) return <EmptyState icon={<ChartBar />} title="Could not load analytics" description={describeApiError(q.error)} />;
  if (q.isPending || q.data === undefined) return <Skeleton className="h-72" />;
  return <>{children(q.data)}</>;
}

const PRIVACY_NOTE = 'First-party, anonymous analytics: no IP addresses are stored and browsers with Global Privacy Control or Do Not Track are not counted, so totals are a floor.';

export function AudienceAnalyticsPage() {
  const { days, query, setDays } = useRange();
  const q = useQuery({ queryKey: ['admin', 'analytics', 'audience', query], queryFn: () => api.admin.analytics.audience(query) });
  return (
    <>
      <PageTitle kicker="Analytics" title="Audience" description={PRIVACY_NOTE} />
      <RangePicker days={days} setDays={setDays} />
      <Loadable q={q}>
        {(d) => {
          const today = d.daily.at(-1);
          return (
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Unique visitors" value={formatNumber(d.uniqueVisitors)} hint={`${d.range.from} → ${d.range.to}`} />
                <Stat label="DAU (latest day)" value={formatNumber(today?.visitors ?? 0)} hint={today?.date} />
                <Stat label="MAU" value={formatNumber(d.mau)} hint="30 days ending on the last day" />
                <Stat label="Followers" value={formatNumber(d.followers.total)} hint={`+${formatNumber(d.followers.new)} in range`} />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Daily visitors</CardTitle>
                  <CardDescription>{formatNumber(d.pageViews)} page views in range</CardDescription>
                </CardHeader>
                <div className="px-6 pb-6">
                  <DailyBars data={d.daily.map((x) => ({ date: x.date, value: x.visitors }))} label="Visitors per day" />
                </div>
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
                        d.trafficSources.map((s) => (
                          <TableRow key={s.source}>
                            <TableCell className="font-mono text-xs">{s.source}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(s.visitors)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(s.pageViews)}</TableCell>
                          </TableRow>
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cohort week</TableHead>
                        <TableHead className="text-right">New visitors</TableHead>
                        <TableHead className="text-right">Returned</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.retention.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-sm text-muted">
                            Not enough history yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        d.retention.map((c) => (
                          <TableRow key={c.cohortWeek}>
                            <TableCell className="font-mono text-xs">{c.cohortWeek}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(c.visitors)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(c.returned)} <span className="text-muted">({formatPercent(c.rate)})</span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Top searches</CardTitle>
                </CardHeader>
                <div className="flex flex-wrap gap-2 px-6 pb-6">
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

export function ContentAnalyticsPage() {
  const { days, query, setDays } = useRange();
  const q = useQuery({ queryKey: ['admin', 'analytics', 'content', query], queryFn: () => api.admin.analytics.content(query) });
  return (
    <>
      <PageTitle kicker="Analytics" title="Content" description={PRIVACY_NOTE} />
      <RangePicker days={days} setDays={setDays} />
      <Loadable q={q}>
        {(d) => (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Plays" value={formatNumber(d.totals.plays)} hint={`${formatPercent(d.totals.completionRate)} completed`} />
              <Stat label="Listening time" value={formatDuration(d.totals.listenSeconds)} hint={`Radio: ${formatDuration(d.totals.radioSeconds)}`} />
              <Stat label="Watch time" value={formatDuration(d.totals.watchSeconds)} />
              <Stat label="Podcast downloads" value={formatNumber(d.totals.downloads)} hint={`${formatNumber(d.totals.shares)} shares`} />
            </div>
            {d.notTracked.length > 0 ? (
              <p className="text-xs text-muted">Not tracked yet (no such feature on the site): {d.notTracked.join(', ')}.</p>
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle>Top episodes</CardTitle>
              </CardHeader>
              {d.topEpisodes.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted">No episode activity in range.</p>
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
                    {d.topEpisodes.map((e) => (
                      <TableRow key={e.id}>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Clip performance</CardTitle>
              </CardHeader>
              {d.clips.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted">No clip plays in range.</p>
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
                    {d.clips.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-semibold">{c.title}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(c.plays)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(c.completions)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(c.shares)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        )}
      </Loadable>
    </>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Show</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Plays</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Completion</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Listen / watch</TableHead>
                  <TableHead className="text-right">Downloads</TableHead>
                  <TableHead className="text-right">Followers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.items.map((s) => (
                  <TableRow key={s.id}>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        }
      </Loadable>
    </>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Profile views</TableHead>
                  <TableHead className="text-right">Mentions</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Mention views</TableHead>
                  <TableHead className="text-right">Followers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-semibold">
                      {p.name} {p.isDemo ? <Badge variant="mono">DEMO</Badge> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(p.views)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(p.episodeMentions)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNumber(p.mentionViews)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(p.followers)} <span className="text-xs text-muted">+{formatNumber(p.newFollowers)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        }
      </Loadable>
    </>
  );
}
