import { ChangeBadge, Sparkline, useReducedMotion } from '@stocktank/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { api } from '../../lib/api';

export const STOCKS_QUERY_KEY = ['markets', 'stocks'] as const;

export function useTrackedStocks() {
  return useQuery({ queryKey: STOCKS_QUERY_KEY, queryFn: () => api.markets.stocks(), refetchInterval: 30_000, staleTime: 15_000 });
}

/**
 * MARKETS ticker tape (Concept B). Live quotes from the markets API; meme stocks lead. The strip scrolls on
 * desktop (paused on hover, static under reduced motion) and every price carries its source so DEMO data
 * is never mistaken for real quotes.
 */
export function MarketsTape() {
  const q = useTrackedStocks();
  const reduced = useReducedMotion();
  const items = q.data ? [...q.data.items].sort((a, b) => Number(b.memeStock) - Number(a.memeStock)).slice(0, 16) : [];
  const demo = q.data?.demoNotice ?? null;
  // Duplicated once so the CSS marquee loops seamlessly.
  const loop = items.length > 0 ? [...items, ...items] : [];
  const cells = (aria: boolean) =>
    loop.map((s, i) => (
      <li key={`${s.symbol}-${i}`} className="shrink-0" aria-hidden={aria ? undefined : true}>
        <Link
          to={`/markets/${s.symbol}`}
          className="flex h-8 items-center gap-2 rounded-md border border-hairline px-3 transition-[border-color,background-color] hover:border-primary hover:bg-primary-soft focus-visible:border-primary"
        >
          <span className="font-mono text-xs font-bold">{s.symbol}</span>
          {s.memeStock ? <span className="rounded-sm bg-warning-soft px-1 font-mono text-[9px] font-bold tracking-wider text-warning">MEME</span> : null}
          {s.quote ? (
            <>
              <span className="font-mono text-xs tabular-nums">{s.quote.price.toFixed(2)}</span>
              <ChangeBadge changePercent={s.quote.changePercent} flash={false} className="px-0" />
              <Sparkline data={s.sparkline} width={44} height={16} animate={false} />
            </>
          ) : (
            <span className="font-mono text-[11px] text-muted">no quote</span>
          )}
        </Link>
      </li>
    ));

  return (
    <section aria-label="Markets ticker" className="flex h-14 items-center gap-2.5 overflow-hidden border-b border-hairline bg-surface px-4 md:px-8">
      <Link to="/markets" className="shrink-0 font-mono text-[11px] font-bold tracking-[0.14em] text-primary-hi hover:underline">
        MARKETS
      </Link>
      {q.isPending ? (
        <ul className="flex items-center gap-2.5" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="h-8 w-28 shrink-0 animate-pulse rounded-md border border-hairline bg-raised" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted">No tracked stocks yet.</p>
      ) : (
        <div className="group relative min-w-0 flex-1 overflow-hidden">
          <ul className={reduced ? 'flex items-center gap-2.5 overflow-x-auto scrollbar-none' : 'st-ticker-track flex w-max items-center gap-2.5 animate-ticker group-hover:[animation-play-state:paused]'}>
            {cells(true)}
          </ul>
        </div>
      )}
      {demo ? (
        <span className="ml-auto hidden shrink-0 rounded-sm border border-warning/40 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-warning xl:block" title={demo}>
          DEMO DATA
        </span>
      ) : q.data?.source ? (
        <span className="ml-auto hidden shrink-0 text-[11px] text-muted xl:block">{q.data.items.some((s) => s.quote?.delayed) ? 'Delayed quotes' : 'Live quotes'}</span>
      ) : null}
      <span className="sr-only">{demo ?? 'Prices are for information only and may be delayed.'}</span>
    </section>
  );
}
