import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, EmptyState, Skeleton, TimeSeriesChart, type SeriesPoint } from '@stocktank/ui';
import { useQuery } from '@tanstack/react-query';
import { Megaphone } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { PageTitle } from '../../components/page-title';
import { StatCard, percentChange } from '../../components/stat-card';
import { api } from '../../lib/api';
import { can, describeApiError, useMe } from '../../lib/auth';
import { formatMoney, formatNumber } from '../../lib/format';

const SERIES = [
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
] as const;
type SeriesKey = (typeof SERIES)[number]['key'];

export function AdvertisingOverviewPage() {
  const { user } = useMe();
  const q = useQuery({ queryKey: ['admin', 'ads', 'overview'], queryFn: () => api.admin.advertisingOverview() });
  const [series, setSeries] = useState<SeriesKey>('impressions');

  const d = q.data;
  const chart: SeriesPoint[] = d ? d.daily.map((x) => ({ label: x.date, value: x[series] })) : [];
  const total14 = chart.reduce((s, p) => s + p.value, 0);

  return (
    <>
      <PageTitle
        kicker="Advertising"
        title="Overview"
        description="Revenue pipeline, inventory health and what needs an editor. Booked value is the sum of approved paid campaign budgets."
        action={
          d ? (
            <Badge variant={d.advertisingLive ? 'primary' : 'warning'} className={d.advertisingLive ? 'animate-glow-pulse' : undefined}>
              {d.advertisingLive ? 'Ads serving' : 'Ads off (feature flag)'}
            </Badge>
          ) : null
        }
      />
      {q.isError ? (
        <EmptyState icon={<Megaphone />} title="Could not load the overview" description={describeApiError(q.error)} />
      ) : q.isPending || !d ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard index={0} label="Active campaigns" value={d.activeCampaigns} to="/advertising/campaigns" />
            <StatCard index={1} label="Awaiting review" value={d.pendingReviews} to="/advertising/review" />
            <StatCard
              index={2}
              label="Impressions (7 days)"
              value={d.impressionsLast7d}
              delta={percentChange(d.impressionsLast7d, d.impressionsPrior7d)}
              deltaLabel="vs prior 7 days"
              series={d.daily.map((x) => x.impressions)}
              seriesLabel="Impressions per day, last 14 days"
            />
            <StatCard
              index={3}
              label="Clicks (7 days)"
              value={d.clicksLast7d}
              delta={percentChange(d.clicksLast7d, d.clicksPrior7d)}
              deltaLabel="vs prior 7 days"
              series={d.daily.map((x) => x.clicks)}
              seriesLabel="Clicks per day, last 14 days"
            />
            <StatCard index={4} label="Booked (paid campaigns)" value={d.bookedRevenueCents} format={(n) => formatMoney(Math.round(n))} />
            <StatCard index={5} label="New leads" value={d.newInquiries} to="/growth/leads" />
            <StatCard index={6} label="Confirmed subscribers" value={d.confirmedSubscribers} to="/growth/newsletter" />
          </div>

          <Card>
            <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{series === 'impressions' ? 'Daily impressions' : 'Daily clicks'}</CardTitle>
                <CardDescription>
                  {formatNumber(total14)} {series} across all campaigns in the last 14 days. Hover or use ← → to inspect a day.
                </CardDescription>
              </div>
              <div className="flex gap-1" role="group" aria-label="Chart series">
                {SERIES.map((s) => (
                  <Button key={s.key} size="sm" variant={series === s.key ? 'secondary' : 'ghost'} aria-pressed={series === s.key} onClick={() => setSeries(s.key)}>
                    {s.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <TimeSeriesChart key={series} data={chart} kind="bars" height={200} label={series === 'impressions' ? 'Impressions per day' : 'Clicks per day'} />
          </Card>

          {!d.advertisingLive ? (
            <Card>
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
        </div>
      )}
    </>
  );
}
