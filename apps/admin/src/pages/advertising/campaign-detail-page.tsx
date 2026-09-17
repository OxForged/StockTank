import { ApiClientError } from '@stocktank/api-client';
import type { Creative, CreativeInput } from '@stocktank/types';
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
  Input,
  Skeleton,
  Textarea,
  toast,
} from '@stocktank/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Megaphone, Pause, Play, Plus, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { can, describeApiError, useMe } from '../../lib/auth';
import {
  CAMPAIGN_STATUS_VARIANT,
  POLICY_FLAG_LABEL,
  PRICING_LABEL,
  REVIEW_STATUS_VARIANT,
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  humanize,
} from '../../lib/format';
import { CampaignForm } from './campaigns-page';

const SELECT = 'h-10 w-full rounded-md border border-hairline-strong bg-bg px-3 text-sm text-fg focus:border-primary focus:outline-none';

function CreativeDialog({ campaignId, creative, open, onClose }: { campaignId: string; creative: Creative | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (input: CreativeInput) => (creative ? api.admin.updateCreative(creative.id, input) : api.admin.addCreative(campaignId, input)),
    onSuccess: (c) => {
      if (c.policyFlags.length > 0) {
        toast.info('Saved with policy flags', { description: 'An editor must acknowledge each flag before approving.' });
      } else {
        toast.success('Creative saved');
      }
      void qc.invalidateQueries({ queryKey: ['admin', 'ads'] });
      onClose();
    },
    onError: (err) => toast.error('Could not save creative', { description: describeApiError(err) }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const text = (k: string) => String(d.get(k) ?? '').trim() || null;
    save.mutate({
      kind: d.get('kind') as CreativeInput['kind'],
      headline: String(d.get('headline') ?? '').trim(),
      body: text('body'),
      imageUrl: text('imageUrl'),
      altText: text('altText'),
      ctaLabel: text('ctaLabel') ?? undefined,
      clickUrl: String(d.get('clickUrl') ?? '').trim(),
      disclosureLabel: d.get('disclosureLabel') as CreativeInput['disclosureLabel'],
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent size="lg" className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={onSubmit} key={creative?.id ?? 'new'} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{creative ? 'Edit creative' : 'New creative'}</DialogTitle>
            <DialogDescription>Copy is scanned for unsupported financial claims. Any edit sends the creative back to review.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Format" htmlFor="cr-kind">
              {({ id }) => (
                <select id={id} name="kind" defaultValue={creative?.kind ?? 'native'} className={SELECT}>
                  <option value="native">Native card</option>
                  <option value="display">Display image</option>
                  <option value="audio_script">Audio script (host read)</option>
                  <option value="video">Video</option>
                </select>
              )}
            </FormField>
            <FormField label="Disclosure label" htmlFor="cr-disc">
              {({ id }) => (
                <select id={id} name="disclosureLabel" defaultValue={creative?.disclosureLabel ?? 'Sponsored'} className={SELECT}>
                  {['Sponsored', 'Paid partnership', 'Presented by', 'Advertisement'].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              )}
            </FormField>
          </div>
          <FormField label="Headline (max 90)" htmlFor="cr-head" required>
            {({ id }) => <Input id={id} name="headline" maxLength={90} minLength={3} defaultValue={creative?.headline} required />}
          </FormField>
          <FormField label="Body (max 280)" htmlFor="cr-body">
            {({ id }) => <Textarea id={id} name="body" maxLength={280} rows={3} defaultValue={creative?.body ?? ''} />}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Destination URL" htmlFor="cr-url" required>
              {({ id }) => <Input id={id} name="clickUrl" type="url" placeholder="https://" defaultValue={creative?.clickUrl} required />}
            </FormField>
            <FormField label="CTA label" htmlFor="cr-cta">
              {({ id }) => <Input id={id} name="ctaLabel" maxLength={24} defaultValue={creative?.ctaLabel ?? 'Learn more'} />}
            </FormField>
            <FormField label="Image URL" htmlFor="cr-img" hint="https only">
              {({ id }) => <Input id={id} name="imageUrl" type="url" defaultValue={creative?.imageUrl ?? ''} />}
            </FormField>
            <FormField label="Image alt text" htmlFor="cr-alt">
              {({ id }) => <Input id={id} name="altText" maxLength={200} defaultValue={creative?.altText ?? ''} />}
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              Save creative
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PolicyFlags({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Policy flags">
      {flags.map((f) => (
        <li key={f}>
          <Badge variant="danger">
            <AlertTriangle className="size-3" aria-hidden="true" />
            {POLICY_FLAG_LABEL[f] ?? humanize(f)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function CampaignDetailPage() {
  const { id = '' } = useParams();
  const { user } = useMe();
  const qc = useQueryClient();
  const [creativeDialog, setCreativeDialog] = useState<{ open: boolean; creative: Creative | null }>({ open: false, creative: null });
  const [editing, setEditing] = useState(false);

  const q = useQuery({ queryKey: ['admin', 'ads', 'campaign', id], queryFn: () => api.admin.getCampaign(id), retry: false });
  const report = useQuery({ queryKey: ['admin', 'ads', 'report', id], queryFn: () => api.admin.campaignReport(id), enabled: q.isSuccess });

  const action = useMutation({
    mutationFn: (kind: 'submit' | 'pause' | 'resume') =>
      kind === 'submit' ? api.admin.submitCampaign(id) : kind === 'pause' ? api.admin.pauseCampaign(id) : api.admin.resumeCampaign(id),
    onSuccess: (c) => {
      toast.success(`Campaign ${humanize(c.status)}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'ads'] });
    },
    onError: (err) => toast.error('Action failed', { description: describeApiError(err) }),
  });

  if (q.isError) {
    return (
      <EmptyState
        icon={<Megaphone />}
        title={q.error instanceof ApiClientError && q.error.status === 404 ? 'Campaign not found' : 'Could not load campaign'}
        description={describeApiError(q.error)}
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to="/advertising/campaigns">Back to campaigns</Link>
          </Button>
        }
      />
    );
  }
  if (q.isPending) return <Skeleton className="h-96" />;

  const c = q.data;
  const editable = ['draft', 'rejected', 'paused'].includes(c.status);

  return (
    <>
      <Link to="/advertising/campaigns" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden="true" /> Campaigns
      </Link>
      <PageTitle
        kicker={c.advertiser.name}
        title={c.name}
        description={c.objective ?? undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={CAMPAIGN_STATUS_VARIANT[c.status]}>{humanize(c.status)}</Badge>
            {editable ? (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : null}
            {c.status === 'draft' || c.status === 'rejected' ? (
              <Button size="sm" loading={action.isPending} onClick={() => action.mutate('submit')}>
                <Send aria-hidden="true" /> Submit for review
              </Button>
            ) : null}
            {c.status === 'approved' ? (
              <Button size="sm" variant="secondary" loading={action.isPending} onClick={() => action.mutate('pause')}>
                <Pause aria-hidden="true" /> Pause
              </Button>
            ) : null}
            {c.status === 'paused' && c.reviewedAt ? (
              <Button size="sm" loading={action.isPending} onClick={() => action.mutate('resume')}>
                <Play aria-hidden="true" /> Resume
              </Button>
            ) : null}
          </div>
        }
      />

      {c.status === 'rejected' && c.rejectionReason ? (
        <p role="note" className="mb-6 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm">
          <strong>Rejected:</strong> {c.rejectionReason}
        </p>
      ) : null}
      {c.advertiser.status !== 'approved' ? (
        <p role="note" className="mb-6 rounded-md border border-warning/30 bg-warning-soft p-3 text-sm">
          The advertiser is {humanize(c.advertiser.status)}. An editor must approve it before this campaign can be approved.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Flight', `${formatDate(c.startsAt)} – ${formatDate(c.endsAt)}`],
          ['Pricing', `${formatMoney(c.rateCents, c.currency)} ${PRICING_LABEL[c.pricingModel]}`],
          ['Budget', formatMoney(c.budgetCents, c.currency)],
          ['Placements', c.placementKeys.map(humanize).join(', ')],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-base">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <section aria-labelledby="report-h" className="mt-8">
        <h2 id="report-h" className="mb-3 font-display text-xl font-bold">
          Performance
        </h2>
        {report.isPending ? (
          <Skeleton className="h-24" />
        ) : report.isError ? (
          <p className="text-sm text-danger">{describeApiError(report.error)}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ['Impressions', formatNumber(report.data.impressions)],
              ['Clicks', formatNumber(report.data.clicks)],
              ['CTR', formatPercent(report.data.ctr)],
              ['Estimated spend', formatMoney(report.data.estimatedSpendCents, report.data.currency)],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader>
                  <CardDescription>{label}</CardDescription>
                  <CardTitle className="font-mono text-2xl tabular">{value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
            {report.data.daily.length > 0 ? (
              <table className="text-sm md:col-span-4">
                <caption className="sr-only">Daily delivery</caption>
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-1 font-semibold">Date</th>
                    <th className="py-1 font-semibold">Impressions</th>
                    <th className="py-1 font-semibold">Clicks</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {report.data.daily.map((d) => (
                    <tr key={d.date} className="border-t border-hairline">
                      <td className="py-1.5">{d.date}</td>
                      <td>{formatNumber(d.impressions)}</td>
                      <td>{formatNumber(d.clicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        )}
      </section>

      <section aria-labelledby="creatives-h" className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="creatives-h" className="font-display text-xl font-bold">
            Creatives
          </h2>
          {c.status !== 'completed' && can(user, 'ads.manage') ? (
            <Button size="sm" variant="secondary" onClick={() => setCreativeDialog({ open: true, creative: null })}>
              <Plus aria-hidden="true" /> Add creative
            </Button>
          ) : null}
        </div>
        {c.creatives.length === 0 ? (
          <EmptyState title="No creatives yet" description="Add at least one creative before submitting for review." />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {c.creatives.map((cr) => (
              <li key={cr.id}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={REVIEW_STATUS_VARIANT[cr.reviewStatus]}>{humanize(cr.reviewStatus)}</Badge>
                      <Badge variant="mono">{cr.disclosureLabel}</Badge>
                      <Badge variant="outline">{humanize(cr.kind)}</Badge>
                    </div>
                    <CardTitle className="mt-2">{cr.headline}</CardTitle>
                    {cr.body ? <CardDescription>{cr.body}</CardDescription> : null}
                  </CardHeader>
                  <PolicyFlags flags={cr.policyFlags} />
                  <p className="mt-3 truncate font-mono text-xs text-muted">
                    {cr.ctaLabel} → {cr.clickUrl}
                  </p>
                  {cr.reviewNotes ? <p className="mt-2 text-xs text-muted">Reviewer: {cr.reviewNotes}</p> : null}
                  <Button size="sm" variant="ghost" className="mt-3 self-start" onClick={() => setCreativeDialog({ open: true, creative: cr })}>
                    Edit
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreativeDialog campaignId={c.id} creative={creativeDialog.creative} open={creativeDialog.open} onClose={() => setCreativeDialog({ open: false, creative: null })} />
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent size="lg" className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit campaign</DialogTitle>
            <DialogDescription>Saving returns the campaign to draft; submit it again for review.</DialogDescription>
          </DialogHeader>
          {editing ? <CampaignForm campaign={c} onDone={() => setEditing(false)} /> : null}
          <DialogFooter />
        </DialogContent>
      </Dialog>
    </>
  );
}
