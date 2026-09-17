import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] leading-4 whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'border-hairline-strong bg-raised text-muted',
        primary: 'border-primary/30 bg-primary-soft text-primary-hi',
        solid: 'border-transparent bg-gradient-primary text-on-primary',
        danger: 'border-danger/30 bg-danger-soft text-danger',
        warning: 'border-warning/30 bg-warning-soft text-warning',
        info: 'border-info/30 bg-info/10 text-info',
        outline: 'border-hairline-strong bg-transparent text-fg',
        mono: 'border-hairline-strong bg-surface font-mono normal-case tracking-normal text-fg',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export interface LiveBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** `live` pulses red; `offair` is a quiet neutral state; `upcoming` hints at a scheduled slot. */
  status?: 'live' | 'offair' | 'upcoming';
  label?: string;
}

export function LiveBadge({ status = 'live', label, className, ...props }: LiveBadgeProps) {
  const text = label ?? (status === 'live' ? 'Live' : status === 'upcoming' ? 'Upcoming' : 'Off air');
  return (
    <span
      role="status"
      className={cn(
        badgeVariants({ variant: status === 'live' ? 'danger' : status === 'upcoming' ? 'primary' : 'neutral' }),
        status === 'live' && 'border-live/40 bg-live/15 text-live',
        className,
      )}
      {...props}
    >
      <span className="relative flex size-2" aria-hidden="true">
        {status === 'live' ? (
          <span className="absolute inline-flex size-full animate-live-pulse rounded-full bg-live opacity-75" />
        ) : null}
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            status === 'live' ? 'bg-live' : status === 'upcoming' ? 'bg-primary-hi' : 'bg-faint',
          )}
        />
      </span>
      {text}
    </span>
  );
}
