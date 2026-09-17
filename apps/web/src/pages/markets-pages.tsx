import { ApiClientError } from '@stocktank/api-client';
import { chartRangeSchema, type ChartRange, type RadarItem, type StockSummary } from '@stocktank/types';
import { AnimatedNumber, Badge, Button, BuzzMeter, ChangeBadge, EmptyState, HeatMap, PriceChart, Reveal, Skeleton, Sparkline, TimeSeriesChart, cn } from '@stocktank/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Flame, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { AdSlot } from '../components/ads/ad-slot';
import { useTrackedStocks } from '../components/layout/markets-tape';
import { NewsletterSignup } from '../components/marketing/newsletter-signup';
import { api } from '../lib/api';
import { useSeo } from '../lib/seo';
import { EpisodeList } from './detail-pages';
import { NotFoundPage } from './not-found-page';

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = (n: number) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);

function DemoBanner({ notice }: { notice: string | null }) {
  if (!notice) return null;
  return (
    <p role="note" className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning">
      <span className="rounded-sm border border-warning/50 px-1 font-mono text-[10px] font-bold tracking-wider">DEMO</span>
      {notice}
    </p>
  );
}

function Disclaimer({ text }: { text: string }) {
  return <p className="text-xs text-muted">{text}</p>;
}

function StockRow({ s, index }: { s: StockSummary; index: number }) {
  return (
    <Reveal index={index}>
      <Link
        to={`/markets/${s.symbol}`}
        className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary md:grid-cols-[minmax(0,1fr)_96px_96px_120px]"
      >
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold">{s.symbol}</span>
            {s.memeStock ? <Badge variant="warning">MEME</Badge> : null}
            {s.isDemo ? <Badge variant="mono">DEMO</Badge> : null}
          </span>
          <span className="truncate text-xs text-muted">{s.name}</span>
        </span>
        <span className="font-mono text-sm tabular-nums">{s.quote ? money(s.quote.price) : '—'}</span>
        <ChangeBadge changePercent={s.quote?.changePercent} />
        <span className="hidden md:block">
          <Sparkline data={s.sparkline} width={120} height={32} />
        </span>
      </Link>
    </Reveal>
  );
}

// ───────── Markets hub ─────────

export function MarketsPage() {
  useSeo({ title: 'Markets', description: 'Stocks and meme stocks covered on StockTank: heat map, movers and the Meme Stock Radar. Informational only, not investment advice.' });
  const stocks = useTrackedStocks();
  const movers = useQuery({ queryKey: ['markets', 'movers'], queryFn: () => api.markets.movers(), refetchInterval: 30_000 });
  const radar = useQuery({ queryKey: ['markets', 'radar'], queryFn: () => api.markets.radar(), refetchInterval: 60_000 });
  const [view, setView] = useState<'heatmap' | 'list'>('heatmap');

  const items = stocks.data?.items ?? [];
  const totalVolume = items.reduce((s, i) => s + (i.quote?.volume ?? 0), 0);
  const up = items.filter((i) => (i.quote?.changePercent ?? 0) > 0).length;

  return (
    <>
      <section className="border-b border-hairline px-4 py-8 md:px-8">
        <span className="font-mono text-kicker font-bold tracking-[0.22em] text-primary-hi">MARKETS</span>
        <h1 className="mt-2 font-display text-4xl font-black md:text-5xl">Stocks &amp; meme stocks</h1>
        <p className="mt-2 max-w-2xl text-muted">The names the network is talking about, with prices, buzz and the shows that cover them. For information and entertainment, never advice.</p>
        {stocks.data ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-hairline bg-surface p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-muted">Tracked</p>
              <p className="font-display text-3xl font-extrabold">
                <AnimatedNumber value={items.length} />
              </p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-muted">Advancing today</p>
              <p className="font-display text-3xl font-extrabold">
                <AnimatedNumber value={up} /> <span className="text-base text-muted">/ {items.length}</span>
              </p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-muted">Volume</p>
              <p className="font-display text-3xl font-extrabold">
                <AnimatedNumber value={totalVolume} format={compact} />
              </p>
            </div>
          </div>
        ) : null}
        <div className="mt-4">
          <DemoBanner notice={stocks.data?.demoNotice ?? null} />
        </div>
      </section>

      <div className="grid gap-8 px-4 py-8 md:px-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-10">
          <section aria-labelledby="map-h" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="map-h" className="font-display text-2xl font-extrabold">
                Market map
              </h2>
              <div role="group" aria-label="View" className="flex gap-1">
                <Button size="sm" variant={view === 'heatmap' ? 'secondary' : 'ghost'} aria-pressed={view === 'heatmap'} onClick={() => setView('heatmap')}>
                  Heat map
                </Button>
                <Button size="sm" variant={view === 'list' ? 'secondary' : 'ghost'} aria-pressed={view === 'list'} onClick={() => setView('list')}>
                  List
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted">Tile size is today’s volume; colour is the day’s move.</p>
            {stocks.isPending ? (
              <Skeleton className="h-80 rounded-xl" />
            ) : stocks.isError ? (
              <EmptyState icon={<TrendingUp aria-hidden="true" />} title="Markets are unavailable" description="Try again shortly." />
            ) : items.length === 0 ? (
              <EmptyState icon={<TrendingUp aria-hidden="true" />} title="No stocks tracked yet" description="Companies with tickers appear here once editors publish them." />
            ) : view === 'heatmap' ? (
              <HeatMap
                label="Stocks by volume and daily change"
                height={360}
                items={items.map((s) => ({ id: s.symbol, label: s.symbol, sublabel: s.name, change: s.quote?.changePercent ?? null, weight: Math.max(1, s.quote?.volume ?? 1), href: `/markets/${s.symbol}` }))}
                renderLink={(item, children, className) => (
                  <Link to={item.href!} className={className}>
                    {children}
                  </Link>
                )}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((s, i) => (
                  <li key={s.symbol}>
                    <StockRow s={s} index={i} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="radar-h" className="flex flex-col gap-3">
            <h2 id="radar-h" className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <Flame className="size-6 text-warning" aria-hidden="true" />
              Meme Stock Radar
            </h2>
            {radar.data ? <p className="text-xs text-muted">{radar.data.methodology}</p> : null}
            {radar.isPending ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : radar.isError || !radar.data ? (
              <p className="text-sm text-muted">Radar unavailable right now.</p>
            ) : (
              <ol className="grid gap-3 md:grid-cols-2">
                {radar.data.items.slice(0, 8).map((r, i) => (
                  <li key={r.symbol}>
                    <RadarCard item={r} index={i} />
                  </li>
                ))}
              </ol>
            )}
          </section>

          {movers.data ? (
            <section aria-labelledby="movers-h" className="flex flex-col gap-3">
              <h2 id="movers-h" className="font-display text-2xl font-extrabold">
                Movers
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                {(
                  [
                    ['Gainers', movers.data.gainers],
                    ['Losers', movers.data.losers],
                    ['Most active', movers.data.mostActive],
                  ] as const
                ).map(([title, list]) => (
                  <div key={title} className="rounded-xl border border-hairline bg-surface p-3">
                    <h3 className="mb-2 font-mono text-[11px] font-bold tracking-[0.14em] text-muted">{title.toUpperCase()}</h3>
                    {list.length === 0 ? (
                      <p className="text-sm text-muted">None today.</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {list.map((s) => (
                          <li key={s.symbol}>
                            <Link to={`/markets/${s.symbol}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-raised">
                              <span className="font-mono text-sm font-bold">{s.symbol}</span>
                              {title === 'Most active' ? <span className="font-mono text-xs text-muted">{compact(s.quote!.volume)}</span> : <ChangeBadge changePercent={s.quote!.changePercent} flash={false} />}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {stocks.data ? <Disclaimer text={stocks.data.disclaimer} /> : null}
        </div>
        <aside className="flex flex-col gap-6">
          <AdSlot placement="episode_page" variant="sidebar" />
          <NewsletterSignup source="markets" variant="panel" />
        </aside>
      </div>
    </>
  );
}

function RadarCard({ item, index }: { item: RadarItem; index: number }) {
  return (
    <Reveal index={index}>
      <Link
        to={`/markets/${item.symbol}`}
        className={cn(
          'flex items-center gap-4 rounded-2xl border bg-surface p-4 transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-primary',
          item.buzzScore >= 70 ? 'border-warning/50 animate-glow-pulse' : 'border-hairline',
        )}
      >
        <BuzzMeter value={item.buzzScore} label={`${item.symbol} buzz`} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-extrabold">{item.symbol}</span>
            {item.memeStock ? <Badge variant="warning">MEME</Badge> : null}
            {item.isDemo ? <Badge variant="mono">DEMO</Badge> : null}
            <ChangeBadge changePercent={item.quote?.changePercent} flash={false} />
          </span>
          <span className="truncate text-sm text-muted">{item.name}</span>
          <span className="font-mono text-[11px] text-muted">
            {item.signals.mentions} mentions · {item.signals.pageViews} views · {item.signals.searches} searches
            {item.buzzChange !== null ? (
              <span className={item.buzzChange >= 0 ? 'text-primary-hi' : 'text-danger'}>
                {' '}
                · buzz {item.buzzChange >= 0 ? '+' : ''}
                {item.buzzChange}% w/w
              </span>
            ) : null}
          </span>
        </span>
        <Sparkline data={item.sparkline} width={72} height={28} />
      </Link>
    </Reveal>
  );
}

// ───────── Stock page ─────────

const RANGE_LABEL: Record<ChartRange, string> = { '1D': '1 day', '5D': '5 days', '1M': '1 month', '6M': '6 months', '1Y': '1 year' };

export function StockPage() {
  const { symbol = '' } = useParams();
  const q = useQuery({ queryKey: ['markets', 'stock', symbol], queryFn: () => api.markets.stock(symbol), retry: false, refetchInterval: 30_000 });
  const [range, setRange] = useState<ChartRange>('1M');
  const [mode, setMode] = useState<'area' | 'candles'>('area');
  const bars = useQuery({ queryKey: ['markets', 'bars', symbol, range], queryFn: () => api.markets.bars(symbol, range), enabled: Boolean(symbol), refetchInterval: range === '1D' ? 30_000 : false });
  const stock = q.data?.stock;
  useSeo({
    title: stock ? `${stock.symbol} · ${stock.name}` : 'Stock',
    description: stock ? `${stock.name} (${stock.symbol}) on StockTank: price chart, buzz and the episodes that cover it. Informational only.` : undefined,
    loading: q.isPending,
    entity: q.data ? { entityType: 'company', entityId: q.data.company.id } : null,
  });

  if (q.isError) return q.error instanceof ApiClientError && q.error.status === 404 ? <NotFoundPage /> : <EmptyState icon={<TrendingUp aria-hidden="true" />} title="Stock unavailable" description="Try again shortly." />;
  if (!q.data || !stock) return <Skeleton className="m-8 h-96" />;
  const quote = stock.quote;
  const stats = bars.data?.stats;

  return (
    <>
      <section className="border-b border-hairline px-4 py-8 md:px-8">
        <Link to="/markets" className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-fg">
          <ArrowLeft className="size-3.5" aria-hidden="true" /> Markets
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-4xl font-black md:text-5xl">{stock.symbol}</h1>
              {stock.memeStock ? <Badge variant="warning">MEME STOCK</Badge> : null}
              {stock.isDemo ? <Badge variant="mono">DEMO</Badge> : null}
            </span>
            <p className="text-lg text-muted">
              {stock.name}
              {stock.exchange ? <span className="font-mono text-sm"> · {stock.exchange}</span> : null}
              {stock.sector ? <span className="text-sm"> · {stock.sector}</span> : null}
            </p>
          </div>
          {quote ? (
            <div className="text-right">
              <p className="font-display text-4xl font-black tabular-nums">
                <AnimatedNumber value={quote.price} format={money} />
              </p>
              <p className="flex items-center justify-end gap-2 font-mono text-sm">
                <span className={quote.change >= 0 ? 'text-primary-hi' : 'text-danger'}>
                  {quote.change >= 0 ? '+' : ''}
                  {money(quote.change)}
                </span>
                <ChangeBadge changePercent={quote.changePercent} />
              </p>
              <p className="text-[11px] text-muted">
                {quote.delayed ? 'Delayed · ' : ''}as of {new Date(quote.asOf).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">No quote available.</p>
          )}
        </div>
        <div className="mt-4">
          <DemoBanner notice={q.data.demoNotice} />
        </div>
      </section>

      <div className="grid gap-8 px-4 py-8 md:px-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-10">
          <section aria-labelledby="chart-h" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="chart-h" className="font-display text-2xl font-extrabold">
                Price
              </h2>
              <div className="flex flex-wrap gap-1">
                <div role="group" aria-label="Range" className="flex gap-1">
                  {chartRangeSchema.options.map((r) => (
                    <Button key={r} size="sm" variant={range === r ? 'secondary' : 'ghost'} aria-pressed={range === r} onClick={() => setRange(r)}>
                      {r}
                    </Button>
                  ))}
                </div>
                <div role="group" aria-label="Chart type" className="ml-2 flex gap-1">
                  <Button size="sm" variant={mode === 'area' ? 'secondary' : 'ghost'} aria-pressed={mode === 'area'} onClick={() => setMode('area')}>
                    Line
                  </Button>
                  <Button size="sm" variant={mode === 'candles' ? 'secondary' : 'ghost'} aria-pressed={mode === 'candles'} onClick={() => setMode('candles')}>
                    Candles
                  </Button>
                </div>
              </div>
            </div>
            {bars.isPending ? (
              <Skeleton className="h-80 rounded-xl" />
            ) : bars.data ? (
              <PriceChart
                key={`${range}-${mode}`}
                bars={bars.data.bars}
                mode={mode}
                sma={bars.data.sma20}
                label={`${stock.symbol} price, ${RANGE_LABEL[range]}`}
                formatPrice={money}
                formatTime={(t) => new Date(t).toLocaleString(undefined, range === '1D' || range === '5D' ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', year: '2-digit' })}
                badge={q.data.demoNotice ? <Badge variant="warning">DEMO</Badge> : null}
              />
            ) : (
              <p className="text-sm text-muted">Chart unavailable.</p>
            )}
            {stats ? (
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-6">
                {(
                  [
                    ['Open', stats.open === null ? '—' : money(stats.open)],
                    ['High', stats.high === null ? '—' : money(stats.high)],
                    ['Low', stats.low === null ? '—' : money(stats.low)],
                    ['Change', stats.changePercent === null ? '—' : `${stats.changePercent >= 0 ? '+' : ''}${stats.changePercent.toFixed(2)}%`],
                    ['Volume', compact(stats.volume)],
                    ['Rel. volume', stats.relativeVolume === null ? '—' : `${stats.relativeVolume.toFixed(2)}×`],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-hairline bg-surface px-3 py-2">
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-muted">{k}</dt>
                    <dd className={cn('font-mono tabular-nums', k === 'Rel. volume' && stats.relativeVolume !== null && stats.relativeVolume >= 2 && 'text-warning')}>{v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <p className="text-xs text-muted">Dashed line: 20-period simple moving average. {q.data.disclaimer}</p>
          </section>

          <section aria-labelledby="buzz-h" className="flex flex-col gap-3">
            <h2 id="buzz-h" className="font-display text-2xl font-extrabold">
              StockTank buzz
            </h2>
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <TimeSeriesChart data={q.data.buzz.daily.map((d) => ({ label: d.date.slice(5), value: d.pageViews + d.searches }))} kind="bars" label="Daily StockTank views and searches, last 30 days" height={160} />
              <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-1">
                {(
                  [
                    ['Mentions', q.data.buzz.signals.mentions],
                    ['Views', q.data.buzz.signals.pageViews],
                    ['Searches', q.data.buzz.signals.searches],
                    ['Follows', q.data.buzz.signals.follows],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 rounded-lg border border-hairline bg-surface px-3 py-2">
                    <dt className="text-xs text-muted">{k} · 7d</dt>
                    <dd className="font-mono font-bold tabular-nums">
                      <AnimatedNumber value={v} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="text-xs text-muted">Buzz is StockTank audience activity, not market sentiment or a trading signal.</p>
          </section>

          {stock.description ? (
            <section aria-labelledby="about-h" className="flex flex-col gap-2">
              <h2 id="about-h" className="font-display text-2xl font-extrabold">
                About
              </h2>
              <p className="text-fg/90">{stock.description}</p>
              <p className="text-sm">
                <Link to={`/companies/${q.data.company.slug}`} className="font-semibold text-primary-hi hover:underline">
                  Company profile
                </Link>
                {stock.website ? (
                  <>
                    {' · '}
                    <a href={stock.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      Website
                    </a>
                  </>
                ) : null}
              </p>
            </section>
          ) : null}

          <section aria-labelledby="episodes-h" className="flex flex-col gap-3">
            <h2 id="episodes-h" className="font-display text-2xl font-extrabold">
              On StockTank
            </h2>
            <EpisodeList episodes={q.data.episodes} empty={`No episodes mention ${stock.symbol} yet.`} />
          </section>
        </div>
        <aside className="flex flex-col gap-6">
          <AdSlot placement="episode_page" variant="sidebar" />
          <NewsletterSignup source={`stock:${stock.symbol}`} variant="panel" />
        </aside>
      </div>
    </>
  );
}
