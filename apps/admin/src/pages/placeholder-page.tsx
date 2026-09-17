import { Button, EmptyState } from '@stocktank/ui';
import { Construction } from 'lucide-react';
import { Link } from 'react-router';

import { PageTitle } from '../components/page-title';
import type { AdminNavItem } from '../lib/nav';

const MILESTONE_NAMES: Record<number, string> = {
  2: 'Content',
  3: 'Media',
  4: 'Podcast',
  5: 'Live',
  6: 'Admin',
  7: 'AI',
  8: 'Distribution',
  9: 'Mobile',
  10: 'TV',
  11: 'Monetization',
  12: 'Production',
};

/** Honest state for admin pages whose API and workflow are scheduled for a later milestone. */
export function PlaceholderPage({ item }: { item: AdminNavItem & { group?: string } }) {
  const Icon = item.icon ?? Construction;
  const m = item.milestone ?? 6;
  return (
    <>
      <PageTitle kicker={item.group} title={item.label} description={item.description} />
      <EmptyState
        variant="surface"
        size="lg"
        icon={<Icon />}
        kicker={`Scheduled for Milestone ${m} · ${MILESTONE_NAMES[m] ?? ''}`}
        title={`${item.label} is not built yet`}
        description="This page is part of a later milestone in the development order. No placeholder data is shown so nothing here can be mistaken for real records."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to="/">Back to dashboard</Link>
          </Button>
        }
      />
    </>
  );
}
