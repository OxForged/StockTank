import type { Creative, ReviewDecision } from '@stocktank/types';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Skeleton,
  Textarea,
  toast,
} from '@stocktank/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, ListChecks } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { describeApiError, useMe } from '../../lib/auth';
import { POLICY_FLAG_LABEL, PRICING_LABEL, formatDate, formatMoney, humanize } from '../../lib/format';
import { PolicyFlags } from './campaign-detail-page';

type Target = { kind: 'creative'; item: Creative & { campaignName: string; advertiserName: string } } | { kind: 'campaign'; id: string; name: string; createdById: string | null };

function DecisionDialog({ target, onClose }: { target: Target | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const flags = target?.kind === 'creative' ? target.item.policyFlags : [];

  const submit = useMutation({
    mutationFn: async (body: ReviewDecision): Promise<void> => {
      if (target!.kind === 'creative') await api.admin.reviewCreative(target!.item.id, body);
      else await api.admin.reviewCampaign(target!.id, body);
    },
    onSuccess: () => {
      toast.success(decision === 'approve' ? 'Approved' : 'Rejected');
      void qc.invalidateQueries({ queryKey: ['admin', 'ads'] });
      onClose();
    },
    onError: (err) => toast.error('Review failed', { description: describeApiError(err) }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const notes = String(d.get('notes') ?? '').trim();
    if (decision === 'reject') {
      if (notes.length < 3) {
        toast.error('Explain why it is rejected');
        return;
      }
      submit.mutate({ decision: 'reject', notes });
    } else {
      const acknowledgedFlags = d.getAll('ack').map(String);
      submit.mutate({ decision: 'approve', acknowledgedFlags, ...(notes ? { notes } : {}) });
    }
  }

  const allAcknowledged = (form: HTMLFormElement | null) => !form || flags.every((f) => (form.elements.namedItem(`ack-${f}`) as HTMLInputElement | null)?.checked);
  const [ackCount, setAckCount] = useState(0);

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent size="md">
        {target ? (
          <form
            onSubmit={onSubmit}
            onChange={(e) => setAckCount(allAcknowledged(e.currentTarget) ? flags.length : -1)}
            key={target.kind === 'creative' ? target.item.id : target.id}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>Review {target.kind}</DialogTitle>
              <DialogDescription>{target.kind === 'creative' ? target.item.headline : target.name}</DialogDescription>
            </DialogHeader>
            <div role="radiogroup" aria-label="Decision" className="grid grid-cols-2 gap-2">
              {(['approve', 'reject'] as const).map((d) => (
                <label key={d} className="flex items-center gap-2 rounded-md border border-hairline p-3 text-sm font-semibold capitalize has-[:checked]:border-primary/50 has-[:checked]:bg-primary-soft">
                  <input type="radio" name="decision" value={d} checked={decision === d} onChange={() => setDecision(d)} className="accent-[var(--st-primary)]" />
                  {d}
                </label>
              ))}
            </div>
            {decision === 'approve' && flags.length > 0 ? (
              <fieldset className="flex flex-col gap-2 rounded-md border border-danger/30 bg-danger-soft p-3">
                <legend className="px-1 text-sm font-semibold text-danger">Acknowledge each policy flag</legend>
                <p className="text-xs text-muted">Confirm you checked each claim is supported, disclosed and allowed by the advertising policy.</p>
                {flags.map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="ack" id={`ack-${f}`} value={f} className="size-4 accent-[var(--st-primary)]" />
                    {POLICY_FLAG_LABEL[f] ?? humanize(f)}
                  </label>
                ))}
              </fieldset>
            ) : null}
            <FormField label={decision === 'reject' ? 'Reason (sent back to sales)' : 'Notes (optional)'} htmlFor="review-notes" required={decision === 'reject'}>
              {({ id }) => <Textarea id={id} name="notes" rows={3} />}
            </FormField>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={decision === 'reject' ? 'danger' : 'primary'}
                loading={submit.isPending}
                disabled={decision === 'approve' && flags.length > 0 && ackCount !== flags.length}
              >
                {decision === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ReviewQueuePage() {
  const { user } = useMe();
  const [target, setTarget] = useState<Target | null>(null);
  const q = useQuery({ queryKey: ['admin', 'ads', 'review-queue'], queryFn: () => api.admin.reviewQueue() });

  return (
    <>
      <PageTitle
        kicker="Advertising"
        title="Review queue"
        description="Nothing runs without a person approving it. Approve creatives first, then the campaign. You cannot review campaigns you created."
      />
      {q.isError ? (
        <EmptyState icon={<ListChecks />} title="Could not load the queue" description={describeApiError(q.error)} />
      ) : q.isPending ? (
        <Skeleton className="h-72" />
      ) : q.data.creatives.length === 0 && q.data.campaigns.length === 0 ? (
        <EmptyState variant="surface" icon={<CheckCheck />} title="Queue is clear" description="New submissions from sales appear here." />
      ) : (
        <div className="flex flex-col gap-8">
          <section aria-labelledby="rq-creatives">
            <h2 id="rq-creatives" className="mb-3 font-display text-lg font-bold">
              Creatives · {q.data.creatives.length}
            </h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {q.data.creatives.map((cr) => (
                <li key={cr.id}>
                  <Card className="h-full">
                    <CardHeader>
                      <CardDescription>
                        {cr.advertiserName} · {cr.campaignName}
                      </CardDescription>
                      <CardTitle>{cr.headline}</CardTitle>
                      {cr.body ? <CardDescription>{cr.body}</CardDescription> : null}
                    </CardHeader>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="mono">{cr.disclosureLabel}</Badge>
                      <Badge variant="outline">{humanize(cr.kind)}</Badge>
                    </div>
                    <div className="mt-3">
                      <PolicyFlags flags={cr.policyFlags} />
                    </div>
                    <p className="mt-3 truncate font-mono text-xs text-muted">→ {cr.clickUrl}</p>
                    <Button size="sm" className="mt-4 self-start" onClick={() => setTarget({ kind: 'creative', item: cr })}>
                      Review
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="rq-campaigns">
            <h2 id="rq-campaigns" className="mb-3 font-display text-lg font-bold">
              Campaigns · {q.data.campaigns.length}
            </h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {q.data.campaigns.map((c) => {
                const own = c.createdById === user?.id;
                return (
                  <li key={c.id}>
                    <Card className="h-full">
                      <CardHeader>
                        <CardDescription>
                          {c.advertiser.name} · advertiser {humanize(c.advertiser.status)}
                        </CardDescription>
                        <CardTitle>
                          <Link to={`/advertising/campaigns/${c.id}`} className="hover:underline">
                            {c.name}
                          </Link>
                        </CardTitle>
                        <CardDescription>
                          {formatDate(c.startsAt)} – {formatDate(c.endsAt)} · {formatMoney(c.rateCents, c.currency)} {PRICING_LABEL[c.pricingModel]} ·
                          budget {formatMoney(c.budgetCents, c.currency)}
                        </CardDescription>
                      </CardHeader>
                      <p className="text-xs text-muted">
                        Creatives approved: {c.creatives.filter((cr) => cr.reviewStatus === 'approved').length} / {c.creatives.length}
                      </p>
                      <Button
                        size="sm"
                        className="mt-4 self-start"
                        disabled={own && !user?.permissions.includes('roles.manage')}
                        title={own ? 'Another staff member must review a campaign you created' : undefined}
                        onClick={() => setTarget({ kind: 'campaign', id: c.id, name: c.name, createdById: c.createdById })}
                      >
                        Review
                      </Button>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
      <DecisionDialog target={target} onClose={() => setTarget(null)} />
    </>
  );
}
