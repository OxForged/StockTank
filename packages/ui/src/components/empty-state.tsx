import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn.js';

const emptyStateVariants = cva(
  'relative flex flex-col items-center justify-center overflow-hidden rounded-lg border text-center',
  {
    variants: {
      variant: {
        /** Dashed outline, quiet. */
        outline: 'border-dashed border-hairline-strong bg-transparent',
        /** Filled surface with a soft grid. */
        surface: 'border-hairline bg-surface bg-grid-fade shadow-card',
        /** For hero-level placeholders (featured slots). */
        feature: 'border-hairline bg-[radial-gradient(120%_120%_at_0%_0%,var(--st-primary-soft),transparent_60%)] bg-surface',
      },
      size: {
        sm: 'min-h-32 gap-2 p-5',
        md: 'min-h-48 gap-3 p-8',
        lg: 'min-h-72 gap-4 p-10',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
);

export interface EmptyStateProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof emptyStateVariants> {
  icon?: ReactNode;
  /** Small uppercase label above the title, e.g. "Milestone 2". */
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

/** Honest "nothing here yet" state; never pretend data exists. */
export function EmptyState({
  icon,
  kicker,
  title,
  description,
  action,
  variant,
  size,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div className={cn(emptyStateVariants({ variant, size }), className)} {...props}>
      {icon ? (
        <div
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-md border border-hairline-strong bg-raised text-primary-hi [&_svg]:size-5"
        >
          {icon}
        </div>
      ) : null}
      {kicker ? <p className="kicker text-primary-hi">{kicker}</p> : null}
      <p className="max-w-md font-display text-lg font-bold leading-tight tracking-tight text-fg">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
