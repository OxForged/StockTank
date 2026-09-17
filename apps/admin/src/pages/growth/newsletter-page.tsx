import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@stocktank/ui';
import { useQuery } from '@tanstack/react-query';
import { Download, Mail } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { describeApiError } from '../../lib/auth';
import { formatDate, formatNumber } from '../../lib/format';

const STATUSES = ['pending', 'confirmed', 'unsubscribed'] as const;
type Status = (typeof STATUSES)[number];
const VARIANT = { pending: 'warning', confirmed: 'primary', unsubscribed: 'neutral' } as const;

export function NewsletterAudiencePage() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as Status | null) ?? undefined;
  const q = useQuery({ queryKey: ['admin', 'subscribers', status ?? 'all'], queryFn: () => api.admin.listSubscribers({ status, pageSize: 100 }) });

  return (
    <>
      <PageTitle
        kicker="Growth"
        title="Newsletter audience"
        description="Double opt-in subscribers. Only confirmed subscribers can be exported, so consent is never broken."
        action={
          <Button asChild size="sm" variant="secondary">
            <a href={api.admin.subscribersExportUrl()} download>
              <Download aria-hidden="true" />
              Export confirmed (CSV)
            </a>
          </Button>
        }
      />
      {q.data ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {STATUSES.map((s) => (
            <Card key={s}>
              <CardHeader>
                <CardDescription className="capitalize">{s}</CardDescription>
                <CardTitle className="font-mono text-3xl tabular">{formatNumber(q.data.counts[s])}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        <Button size="sm" variant={!status ? 'secondary' : 'ghost'} onClick={() => setParams({})}>
          All
        </Button>
        {STATUSES.map((s) => (
          <Button key={s} size="sm" variant={status === s ? 'secondary' : 'ghost'} className="capitalize" onClick={() => setParams({ status: s })}>
            {s}
          </Button>
        ))}
      </div>
      {q.isError ? (
        <EmptyState icon={<Mail />} title="Could not load subscribers" description={describeApiError(q.error)} />
      ) : q.isPending ? (
        <Skeleton className="h-72" />
      ) : q.data.items.length === 0 ? (
        <EmptyState icon={<Mail />} title="No subscribers yet" description="Sign-ups from the site appear here once submitted." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Source</TableHead>
              <TableHead className="hidden lg:table-cell">Campaign</TableHead>
              <TableHead className="hidden md:table-cell">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.items.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-sm">{s.email}</TableCell>
                <TableCell>
                  <Badge variant={VARIANT[s.status]}>{s.status}</Badge>
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">{s.source ?? '—'}</TableCell>
                <TableCell className="hidden font-mono text-xs lg:table-cell">
                  {[s.utmSource, s.utmMedium, s.utmCampaign].filter(Boolean).join(' / ') || '—'}
                </TableCell>
                <TableCell className="hidden text-sm text-muted md:table-cell">{formatDate(s.confirmedAt ?? s.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
