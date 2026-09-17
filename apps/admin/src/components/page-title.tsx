import { SectionHeader } from '@stocktank/ui';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

export function PageTitle({ kicker, title, description, action }: { kicker?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} — StockTank Admin`;
  }, [title]);
  return <SectionHeader as="h1" size="md" kicker={kicker} title={title} description={description} action={action} className="mb-6" />;
}
