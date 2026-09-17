import { Badge, BuzzMeter, ChangeBadge, HeatMap, Reveal, Skeleton, Sparkline } from '@stocktank/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Flame } from 'lucide-react';
import { Link } from 'react-router';

import { useTrackedStocks } from '../../components/layout/markets-tape';
import { api } from '../../lib/api';

/** Home "Markets today": the heat map and the hottest radar names, linking into the Markets hub. */
export function MarketsSection() {
  const stocks = useTrackedStocks();
  const radar = useQuery({ queryKey: ['markets', 'radar'], queryFn: () => api.markets.radar(), refetchInterval: 60_000 });
  const items = stocks.data?.items ?? [];
  const hot = (radar.data?.items ?? []).slice(0, 4);

  return (
    <section aria-labelledby="markets-h" className="flex flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs tracking-[0.16em] text-primary-hi">MARKETS TODAY</span>
          <h2 id="markets-h" className="font-display text-3xl font-extrabold tracking-tight md:text-[40px]">
            Stocks &amp; meme stocks
          </h2>
        </div>
        <Link to="/markets" className="inline-flex items-center gap-1 font-semibold text-primary-hi hover:underline">
          All markets <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {stocks.data?.demoNotice ? (
        <p role="note" className="text-xs text-warning">
          <span className="mr-1 rounded-sm border border-warning/50 px-1 font-mono text-[10px] font-bold tracking-wider">DEMO</span>
          {stocks.data.demoNotice}
        </p>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        {stocks.isPending ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">No stocks tracked yet.</p>
        ) : (
          <HeatMap
            label="Stocks by volume and daily change"
            height={260}
            items={items.map((s) => ({ id: s.symbol, label: s.symbol, sublabel: s.name, change: s.quote?.changePercent ?? null, weight: Math.max(1, s.quote?.volume ?? 1), href: `/markets/${s.symbol}` }))}
            renderLink={(item, children, className) => (
              <Link to={item.href!} className={className}>
                {children}
              </Link>
            )}
          />
        )}
        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.14em] text-muted">
            <Flame className="size-4 text-warning" aria-hidden="true" /> MEME STOCK RADAR
          </h3>
          {radar.isPending ? (
            <Skeleton className="h-52 rounded-xl" />
          ) : hot.length === 0 ? (
            <p className="text-sm text-muted">Radar warms up as the audience arrives.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {hot.map((r, i) => (
                <li key={r.symbol}>
                  <Reveal index={i}>
                    <Link to={`/markets/${r.symbol}`} className="flex items-center gap-3 rounded-xl border border-hairline bg-surface px-3 py-2 transition-[border-color] hover:border-primary">
                      <BuzzMeter value={r.buzzScore} size={44} label={`${r.symbol} buzz`} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold">{r.symbol}</span>
                          {r.memeStock ? <Badge variant="warning">MEME</Badge> : null}
                          <ChangeBadge changePercent={r.quote?.changePercent} flash={false} />
                        </span>
                        <span className="truncate text-xs text-muted">{r.name}</span>
                      </span>
                      <Sparkline data={r.sparkline} width={64} height={24} />
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ol>
          )}
          <p className="text-[11px] text-muted">Buzz is StockTank audience activity, not a trading signal. Not investment advice.</p>
        </div>
      </div>
    </section>
  );
}
