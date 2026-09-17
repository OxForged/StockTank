import { inquiryStatusSchema, type Inquiry, type InquiryStatus } from '@stocktank/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  toast,
} from '@stocktank/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { describeApiError } from '../../lib/auth';
import { INQUIRY_STATUS_VARIANT, formatDate, humanize } from '../../lib/format';

const BUDGET_LABEL: Record<string, string> = {
  under_5k: '< $5k',
  from_5k_to_25k: '$5k–$25k',
  from_25k_to_100k: '$25k–$100k',
  over_100k: '> $100k',
  undisclosed: 'Undisclosed',
};

const SELECT = 'h-10 w-full rounded-md border border-hairline-strong bg-bg px-3 text-sm text-fg focus:border-primary focus:outline-none';

function LeadDialog({ lead, onClose }: { lead: Inquiry | null; onClose: () => void }) {
  const qc = useQueryClient();
  const advertisers = useQuery({ queryKey: ['admin', 'ads', 'advertisers'], queryFn: () => api.admin.listAdvertisers(), enabled: Boolean(lead) });
  const save = useMutation({
    mutationFn: (body: { status: InquiryStatus; notes: string | null; advertiserId: string | null }) => api.admin.updateInquiry(lead!.id, body),
    onSuccess: () => {
      toast.success('Lead updated');
      void qc.invalidateQueries({ queryKey: ['admin', 'leads'] });
      onClose();
    },
    onError: (err) => toast.error('Could not update lead', { description: describeApiError(err) }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    save.mutate({
      status: d.get('status') as InquiryStatus,
      notes: String(d.get('notes') ?? '').trim() || null,
      advertiserId: String(d.get('advertiserId') ?? '') || null,
    });
  }

  return (
    <Dialog open={Boolean(lead)} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent size="lg" className="max-h-[90dvh] overflow-y-auto">
        {lead ? (
          <form onSubmit={onSubmit} key={lead.id} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{lead.company}</DialogTitle>
              <DialogDescription>
                {lead.contactName} · <a href={`mailto:${lead.email}`} className="font-mono underline">{lead.email}</a>
                {lead.website ? (
                  <>
                    {' · '}
                    <a href={lead.website} target="_blank" rel="noopener noreferrer" className="underline">
                      website
                    </a>
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted">Budget</dt>
                <dd className="font-semibold">{BUDGET_LABEL[lead.budgetRange]}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Received</dt>
                <dd>{formatDate(lead.createdAt, true)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Source</dt>
                <dd className="font-mono text-xs">
                  {[lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(' / ') || lead.referrer || 'direct'}
                </dd>
              </div>
              <div className="sm:col-span-3">
                <dt className="text-xs text-muted">Formats</dt>
                <dd className="flex flex-wrap gap-1.5 pt-1">
                  {lead.placementKeys.length === 0 ? '—' : lead.placementKeys.map((k) => <Badge key={k} variant="mono">{k}</Badge>)}
                </dd>
              </div>
            </dl>
            <blockquote className="whitespace-pre-wrap rounded-md border border-hairline bg-raised/50 p-3 text-sm">{lead.message}</blockquote>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Status" htmlFor="lead-status">
                {({ id }) => (
                  <select id={id} name="status" defaultValue={lead.status} className={SELECT}>
                    {inquiryStatusSchema.options.map((s) => (
                      <option key={s} value={s}>
                        {humanize(s)}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField label="Linked advertiser" htmlFor="lead-adv" hint="Create the advertiser first, then link it.">
                {({ id }) => (
                  <select id={id} name="advertiserId" defaultValue={lead.advertiserId ?? ''} className={SELECT}>
                    <option value="">None</option>
                    {(advertisers.data?.items ?? []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            </div>
            <FormField label="Internal notes" htmlFor="lead-notes">
              {({ id }) => <Textarea id={id} name="notes" rows={4} defaultValue={lead.notes ?? ''} />}
            </FormField>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button type="submit" loading={save.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function LeadsPage() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as InquiryStatus | null) ?? undefined;
  const [open, setOpen] = useState<Inquiry | null>(null);
  const q = useQuery({ queryKey: ['admin', 'leads', status ?? 'all'], queryFn: () => api.admin.listInquiries({ status, pageSize: 100 }) });

  return (
    <>
      <PageTitle
        kicker="Growth"
        title="Advertising leads"
        description="Inbound inquiries from /advertise with campaign attribution. Work them from new → contacted → qualified → proposal → won or lost."
      />
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        <Button size="sm" variant={!status ? 'secondary' : 'ghost'} onClick={() => setParams({})}>
          All
        </Button>
        {inquiryStatusSchema.options.map((s) => (
          <Button key={s} size="sm" variant={status === s ? 'secondary' : 'ghost'} onClick={() => setParams({ status: s })}>
            {humanize(s)}
          </Button>
        ))}
      </div>
      {q.isError ? (
        <EmptyState icon={<Inbox />} title="Could not load leads" description={describeApiError(q.error)} />
      ) : q.isPending ? (
        <Skeleton className="h-72" />
      ) : q.data.items.length === 0 ? (
        <EmptyState icon={<Inbox />} title="No leads" description="Inquiries submitted on the Advertise page land here." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Budget</TableHead>
              <TableHead className="hidden lg:table-cell">Source</TableHead>
              <TableHead className="hidden md:table-cell">Received</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.items.map((l) => (
              <TableRow key={l.id}>
                <TableCell>
                  <p className="font-semibold">{l.company}</p>
                  <p className="font-mono text-xs text-muted">{l.email}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={INQUIRY_STATUS_VARIANT[l.status]}>{humanize(l.status)}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">{BUDGET_LABEL[l.budgetRange]}</TableCell>
                <TableCell className="hidden font-mono text-xs lg:table-cell">{l.utmSource ?? (l.referrer ? new URL(l.referrer).hostname : 'direct')}</TableCell>
                <TableCell className="hidden text-sm text-muted md:table-cell">{formatDate(l.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setOpen(l)}>
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <LeadDialog lead={open} onClose={() => setOpen(null)} />
    </>
  );
}
