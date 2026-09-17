import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { HTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';

export interface TickerItem {
  id: string;
  /** Symbol or short label, e.g. a ticker or token symbol. */
  label: string;
  /** Pre-formatted value (the design system never formats market data itself). */
  value?: string;
  /** Pre-formatted change, e.g. "+1.2%". */
  change?: string;
  direction?: 'up' | 'down' | 'flat';
  href?: string;
  /** Optional source/attribution shown as a title attribute. */
  source?: string;
}

export interface TickerProps extends HTMLAttributes<HTMLDivElement> {
  items: readonly TickerItem[];
  /** Text shown when there are no items. */
  emptyMessage?: string;
  /** Seconds for one loop. Longer = slower. */
  speed?: number;
  /** Accessible name for the region. */
  label?: string;
}

const dirClass = { up: 'text-primary-hi', down: 'text-danger', flat: 'text-muted' } as const;
const dirIcon = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;

/**
 * Horizontal scrolling tape. Purely presentational: items are provided by the caller, so it never
 * fabricates data. Pauses on hover/focus and respects prefers-reduced-motion.
 */
export function Ticker({ items, emptyMessage, speed = 60, label = 'Market ticker', className, ...props }: TickerProps) {
  if (items.length === 0) {
    return (
      <div
        role="region"
        aria-label={label}
        className={cn('flex h-9 items-center overflow-hidden border-b border-hairline bg-surface/60 px-4', className)}
        {...props}
      >
        {emptyMessage ? (
          <p className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            <span aria-hidden="true" className="mr-2 text-primary/60">
              //
            </span>
            {emptyMessage}
          </p>
        ) : null}
      </div>
    );
  }

  const row = (ariaHidden: boolean) => (
    <ul
      className="flex shrink-0 items-center gap-8 pr-8"
      aria-hidden={ariaHidden || undefined}
    >
      {items.map((item) => {
        const dir = item.direction ?? 'flat';
        const Icon = dirIcon[dir];
        const inner = (
          <>
            <span className="font-semibold text-fg">{item.label}</span>
            {item.value ? <span className="tabular text-fg/90">{item.value}</span> : null}
            {item.change ? (
              <span className={cn('inline-flex items-center gap-0.5 tabular', dirClass[dir])}>
                <Icon className="size-3" aria-hidden="true" />
                {item.change}
              </span>
            ) : null}
          </>
        );
        return (
          <li key={item.id} className="flex items-center gap-2 font-mono text-xs" title={item.source}>
            {item.href ? (
              <a href={item.href} className="flex items-center gap-2 hover:underline" tabIndex={ariaHidden ? -1 : 0}>
                {inner}
              </a>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      role="region"
      aria-label={label}
      className={cn(
        'group relative flex h-9 items-center overflow-hidden border-b border-hairline bg-surface/60',
        className,
      )}
      {...props}
    >
      <div
        className="st-ticker-track flex w-max animate-ticker will-change-transform group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none"
        style={{ animationDuration: `${speed}s` }}
      >
        {row(false)}
        {row(true)}
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-bg to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-bg to-transparent" />
    </div>
  );
}
