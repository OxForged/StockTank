import { AnimatedNumber, Card, ChangeBadge, Reveal, Sparkline, cn } from '@stocktank/ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { formatNumber } from '../lib/format';

export interface StatCardProps {
  label: string;
  /** The headline number; it counts up from the previous value on change. */
  value: number;
  format?: (n: number) => string;
  /** Percent change against a comparison period. `null` renders a dash; omit to hide the badge. */
  delta?: number | null;
  /** Short label for the comparison, e.g. "vs prior 7 days". */
  deltaLabel?: string;
  /** Daily values behind the number. Only pass a series the API really returned. */
  series?: number[];
  seriesLabel?: string;
  hint?: ReactNode;
  to?: string;
  /** Stagger index for the reveal animation. */
  index?: number;
  className?: string;
}

/** Percent change against a prior period; `null` when there is nothing to compare against. */
export function percentChange(current: number, prior: number): number | null {
  if (prior <= 0) return null;
  return ((current - prior) / prior) * 100;
}

/** KPI tile: animated counter, optional delta badge and optional sparkline. */
export function StatCard({ label, value, format = formatNumber, delta, deltaLabel, series, seriesLabel, hint, to, index = 0, className }: StatCardProps) {
  const spark = series && series.length > 1 ? series : null;
  return (
    <Reveal index={index} className={cn('h-full', className)}>
      <Card className="flex h-full flex-col gap-1" data-testid="stat-card">
        <span className="text-xs uppercase tracking-[0.1em] text-muted">{label}</span>
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <AnimatedNumber value={value} format={format} className="font-display text-3xl font-extrabold" />
            {delta !== undefined ? (
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <ChangeBadge changePercent={delta} className="-ml-1.5" />
                {deltaLabel ? <span>{deltaLabel}</span> : null}
              </span>
            ) : null}
          </div>
          {spark ? <Sparkline data={spark} width={96} height={32} label={seriesLabel} className="shrink-0" /> : null}
        </div>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
        {to ? (
          <Link to={to} className="mt-1 self-start text-xs font-semibold text-primary-hi hover:underline">
            Open →
          </Link>
        ) : null}
      </Card>
    </Reveal>
  );
}
