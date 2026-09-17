import { SectionHeader, cn } from '@stocktank/ui';
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Full-width page header with the editorial rule and a soft brand glow. */
export function PageHeader({ kicker, title, description, action, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'relative border-b border-hairline bg-[radial-gradient(90%_140%_at_0%_0%,var(--st-primary-soft),transparent_55%)]',
        className,
      )}
    >
      <div className="container-site py-10 md:py-14">
        <SectionHeader as="h1" size="lg" kicker={kicker} title={title} description={description} action={action} />
      </div>
    </div>
  );
}
