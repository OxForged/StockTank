import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn.js';

export interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Editorial kicker (e.g. "Latest episodes"). */
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned slot for a "See all" link or controls. */
  action?: ReactNode;
  /** Heading level for the title. */
  as?: 'h1' | 'h2' | 'h3';
  size?: 'sm' | 'md' | 'lg';
  /** Adds the signature emerald rule above the kicker. */
  rule?: boolean;
  /** Pass through to the heading element (useful for aria-labelledby). */
  headingId?: string;
}

const titleSize = {
  sm: 'text-display-sm',
  md: 'text-display-md',
  lg: 'text-display-lg',
} as const;

export function SectionHeader({
  kicker,
  title,
  description,
  action,
  as: Heading = 'h2',
  size = 'md',
  rule = true,
  headingId,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)} {...props}>
      <div className="min-w-0">
        {rule ? <span aria-hidden="true" className="mb-3 block h-0.5 w-10 rounded-pill bg-gradient-primary" /> : null}
        {kicker ? <p className="kicker mb-2 text-primary-hi">{kicker}</p> : null}
        <Heading id={headingId} className={cn('font-display font-extrabold text-fg', titleSize[size])}>
          {title}
        </Heading>
        {description ? <p className="mt-2 max-w-prose text-sm text-muted md:text-base">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
