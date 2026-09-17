import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, EmptyState, Skeleton } from '@stocktank/ui';
import { useQuery } from '@tanstack/react-query';
import { Megaphone } from 'lucide-react';
import { Link } from 'react-router';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { can, describeApiError, useMe } from '../../lib/auth';
import { formatMoney, formatNumber } from '../../lib/format';

export function AdvertisingOverviewPage() {
  const { user } = useMe();
  const q = useQuery({ queryKey: ['admin', 'ads', 'overview'], queryFn: () => api.admin.advertisingOverview() });

  const tiles = q.data
    ? [
        { label: 'Active campaigns', value: formatNumber(q.data.activeCampaigns), to: '/advertising/campaigns' },
        { label: 'Awaiting review', value: formatNumber(q.data.pendingReviews), to: '/advertising/review' },
        { label: 'Impressions (7 days)', value: formatNumber(q.data.impressionsLast7d) },
        { label: 'Clicks (7 days)', value: formatNumber(q.data.clicksLast7d) },
        { label: 'Booked (paid campaigns)', value: formatMoney(q.data.bookedRevenueCents) },
        { label: 'New leads', value: formatNumber(q.data.newInquiries), to: '/growth/leads' },
        { label: 'Confirmed subscribers', value: formatNumber(q.data.confirmedSubscribers), to: '/growth/newsletter' },
      ]
    : [];

  return (
    <>
      <PageTitle
        kicker="Advertising"
        title="Overview"
        description="Revenue pipeline, inventory health and what needs an editor. Booked value is the sum of approved paid campaign budgets."
        action={
          q.data ? (
            <Badge variant={q.data.advertisingLive ? 'primary' : 'warning'}>
              {q.data.advertisingLive ? 'Ads serving' : 'Ads off (feature flag)'}
            </Badge>
          ) : null
        }
      />
      {q.isError ? (
        <EmptyState icon={<Megaphone />} title="Could not load the overview" description={describeApiError(q.error)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {q.isPending
            ? Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-28" />)
            : tiles.map((t) => (
                <Card key={t.label}>
                  <CardHeader>
                    <CardDescription>{t.label}</CardDescription>
                    <CardTitle className="font-mono text-3xl tabular">{t.value}</CardTitle>
                  </CardHeader>
                  {t.to ? (
                    <Link to={t.to} className="text-xs font-semibold text-primary-hi hover:underline">
                      Open →
                    </Link>
                  ) : null}
                </Card>
              ))}
        </div>
      )}
      {q.data && !q.data.advertisingLive ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Ads are not serving</CardTitle>
            <CardDescription>
              The <span className="font-mono">advertising</span> feature flag is off, so no ad slot on the site renders. Approved
              campaigns start serving as soon as it is switched on.
            </CardDescription>
          </CardHeader>
          {can(user, 'feature_flags.manage') ? (
            <Button asChild variant="secondary" size="sm" className="self-start">
              <Link to="/system/feature-flags">Manage feature flags</Link>
            </Button>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
