import { useEffect, useRef, useState, useSyncExternalStore, type HTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const mql = window.matchMedia(QUERY);
  mql.addEventListener?.('change', onChange);
  return () => mql.removeEventListener?.('change', onChange);
}

/** True when the viewer asked for reduced motion; animations must then jump straight to their end state. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY).matches : false),
    () => false,
  );
}

export interface AnimatedNumberProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  value: number;
  format?: (n: number) => string;
  /** Milliseconds for the count animation. */
  duration?: number;
}

/** Counts from the previous value to the new one. Screen readers get the final value only. */
export function AnimatedNumber({ value, format = (n) => n.toLocaleString(), duration = 700, className, ...props }: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (reduced || start === value || typeof requestAnimationFrame === 'undefined') {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(start + (value - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return (
    <span className={cn('tabular-nums', className)} {...props}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

export interface ChangeBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  changePercent: number | null | undefined;
  /** Adds a brief background flash whenever the value changes direction or magnitude. */
  flash?: boolean;
}

/** ▲ / ▼ percent change with market colours and a direction word for screen readers. */
export function ChangeBadge({ changePercent, flash = true, className, ...props }: ChangeBadgeProps) {
  if (changePercent === null || changePercent === undefined) {
    return (
      <span className={cn('font-mono text-xs text-muted', className)} {...props}>
        —
      </span>
    );
  }
  const up = changePercent > 0;
  const flat = changePercent === 0;
  return (
    <span
      key={flash ? changePercent : undefined}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums',
        flat ? 'text-muted' : up ? 'text-primary-hi' : 'text-danger',
        flash && !flat && (up ? 'animate-flash-up' : 'animate-flash-down'),
        className,
      )}
      {...props}
    >
      <span aria-hidden="true">{flat ? '■' : up ? '▲' : '▼'}</span>
      <span className="sr-only">{flat ? 'unchanged' : up ? 'up' : 'down'}</span>
      {Math.abs(changePercent).toFixed(2)}%
    </span>
  );
}

/** Reveals children with a staggered rise-in; each direct child gets an increasing delay. */
export function Reveal({ index = 0, className, style, ...props }: HTMLAttributes<HTMLDivElement> & { index?: number }) {
  return <div className={cn('animate-rise-in', className)} style={{ animationDelay: `${Math.min(index, 12) * 60}ms`, ...style }} {...props} />;
}
