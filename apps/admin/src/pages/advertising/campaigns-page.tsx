import { PLACEMENT_KEYS, type Campaign, type CampaignInput, type CampaignStatus, type PlacementKey } from '@stocktank/types';
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
  Input,
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
import { Megaphone, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { describeApiError } from '../../lib/auth';
import { CAMPAIGN_STATUS_VARIANT, PRICING_LABEL, formatDate, formatMoney, humanize, parseMoneyToCents } from '../../lib/format';

const SELECT = 'h-10 w-full rounded-md border border-hairline-strong bg-bg px-3 text-sm text-fg focus:border-primary focus:outline-none';
const STATUSES: CampaignStatus[] = ['draft', 'in_review', 'approved', 'rejected', 'paused', 'completed'];

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/** Shared create/edit form. Edits to a paused or rejected campaign send it back to draft for re-review. */
export function CampaignForm({ campaign, onDone }: { campaign?: Campaign; onDone: (c: Campaign) => void }) {
  const qc = useQueryClient();
  const advertisers = useQuery({ queryKey: ['admin', 'ads', 'advertisers'], queryFn: () => api.admin.listAdvertisers() });
  const placements = useQuery({ queryKey: ['admin', 'ads', 'placements'], queryFn: () => api.admin.listPlacements() });
  const [errors, setErrors] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (input: CampaignInput) => (campaign ? api.admin.updateCampaign(campaign.id, input) : api.admin.createCampaign(input)),
    onSuccess: (c) => {
      toast.success(campaign ? 'Campaign updated' : 'Campaign created as draft');
      void qc.invalidateQueries({ queryKey: ['admin', 'ads'] });
      onDone(c);
    },
    onError: (err) => setErrors(describeApiError(err)),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors(null);
    const d = new FormData(e.currentTarget);
    const placementKeys = d.getAll('placementKeys').map(String) as PlacementKey[];
    const rateCents = parseMoneyToCents(String(d.get('rate') ?? ''));
    const budgetCents = parseMoneyToCents(String(d.get('budget') ?? ''));
    const startsAt = new Date(String(d.get('startsAt')));
    const endsAt = new Date(String(d.get('endsAt')));
    const problems = [
      !d.get('advertiserId') && 'Choose an advertiser.',
      placementKeys.length === 0 && 'Choose at least one placement.',
      rateCents === null && 'Enter a rate (0 for house campaigns).',
      budgetCents === null && 'Enter a budget.',
      (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) && 'Set start and end dates.',
      endsAt <= startsAt && 'End must be after start.',
    ].filter(Boolean);
    if (problems.length > 0) {
      setErrors(problems.join(' '));
      return;
    }
    const goal = String(d.get('impressionGoal') ?? '').trim();
    const cap = String(d.get('frequencyCapPerDay') ?? '').trim();
    save.mutate({
      advertiserId: String(d.get('advertiserId')),
      name: String(d.get('name') ?? '').trim(),
      objective: String(d.get('objective') ?? '').trim() || null,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      pricingModel: d.get('pricingModel') as CampaignInput['pricingModel'],
      rateCents: rateCents!,
      budgetCents: budgetCents!,
      currency: 'USD',
      impressionGoal: goal ? Number(goal) : null,
      frequencyCapPerDay: cap ? Number(cap) : null,
      weight: Number(d.get('weight') ?? 1) || 1,
      placementKeys,
    });
  }

  const now = new Date();
  const inAMonth = new Date(now.getTime() + 30 * 86_400_000);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {errors ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          {errors}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Advertiser" htmlFor="cmp-adv" required>
          {({ id }) => (
            <select id={id} name="advertiserId" defaultValue={campaign?.advertiser.id ?? ''} className={SELECT}>
              <option value="" disabled>
                {advertisers.isPending ? 'Loading…' : 'Select'}
              </option>
              {(advertisers.data?.items ?? [])
                .filter((a) => a.status !== 'suspended')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.status === 'pending_review' ? ' (pending approval)' : ''}
                  </option>
                ))}
            </select>
          )}
        </FormField>
        <FormField label="Campaign name" htmlFor="cmp-name" required>
          {({ id }) => <Input id={id} name="name" defaultValue={campaign?.name} required minLength={2} />}
        </FormField>
      </div>
      <FormField label="Objective" htmlFor="cmp-obj">
        {({ id }) => <Textarea id={id} name="objective" rows={2} defaultValue={campaign?.objective ?? ''} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Starts" htmlFor="cmp-start" required>
          {({ id }) => <Input id={id} name="startsAt" type="datetime-local" defaultValue={toLocalInput(campaign?.startsAt ?? now.toISOString())} />}
        </FormField>
        <FormField label="Ends" htmlFor="cmp-end" required>
          {({ id }) => <Input id={id} name="endsAt" type="datetime-local" defaultValue={toLocalInput(campaign?.endsAt ?? inAMonth.toISOString())} />}
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Pricing" htmlFor="cmp-model">
          {({ id }) => (
            <select id={id} name="pricingModel" defaultValue={campaign?.pricingModel ?? 'cpm'} className={SELECT}>
              {Object.entries(PRICING_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField label="Rate (USD)" htmlFor="cmp-rate" required>
          {({ id }) => <Input id={id} name="rate" inputMode="decimal" defaultValue={campaign ? String(campaign.rateCents / 100) : ''} />}
        </FormField>
        <FormField label="Budget (USD)" htmlFor="cmp-budget" required>
          {({ id }) => <Input id={id} name="budget" inputMode="decimal" defaultValue={campaign ? String(campaign.budgetCents / 100) : ''} />}
        </FormField>
        <FormField label="Impression goal" htmlFor="cmp-goal" hint="Optional">
          {({ id }) => <Input id={id} name="impressionGoal" type="number" min={1} defaultValue={campaign?.impressionGoal ?? ''} />}
        </FormField>
        <FormField label="Frequency cap / day" htmlFor="cmp-cap" hint="Per visitor, optional">
          {({ id }) => <Input id={id} name="frequencyCapPerDay" type="number" min={1} max={100} defaultValue={campaign?.frequencyCapPerDay ?? ''} />}
        </FormField>
        <FormField label="Rotation weight" htmlFor="cmp-weight">
          {({ id }) => <Input id={id} name="weight" type="number" min={1} max={100} defaultValue={campaign?.weight ?? 1} />}
        </FormField>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Placements</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(placements.data ?? []).map((p) => (
            <label key={p.key} className="flex items-start gap-2.5 rounded-md border border-hairline p-2.5 text-sm has-[:checked]:border-primary/50 has-[:checked]:bg-primary-soft">
              <input
                type="checkbox"
                name="placementKeys"
                value={p.key}
                defaultChecked={campaign?.placementKeys.includes(p.key as PlacementKey)}
                disabled={!p.isActive || !PLACEMENT_KEYS.includes(p.key)}
                className="mt-0.5 size-4 accent-[var(--st-primary)]"
              />
              <span>
                <span className="block font-semibold">{p.name}</span>
                <span className="block text-xs text-muted">
                  {p.surface} · {formatMoney(p.rateCents, p.currency)} {PRICING_LABEL[p.pricingModel]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <DialogFooter>
        <Button type="submit" loading={save.isPending}>
          {campaign ? 'Save changes' : 'Create draft'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CampaignsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as CampaignStatus | null) ?? undefined;
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ['admin', 'ads', 'campaigns', status ?? 'all'], queryFn: () => api.admin.listCampaigns({ status, pageSize: 100 }) });

  return (
    <>
      <PageTitle
        kicker="Advertising"
        title="Campaigns"
        description="Draft → submit → editor review → live. Paused campaigns leave rotation immediately; any edit requires a fresh review."
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            New campaign
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        <Button size="sm" variant={!status ? 'secondary' : 'ghost'} onClick={() => setParams({})}>
          All
        </Button>
        {STATUSES.map((s) => (
          <Button key={s} size="sm" variant={status === s ? 'secondary' : 'ghost'} onClick={() => setParams({ status: s })}>
            {humanize(s)}
          </Button>
        ))}
      </div>
      {q.isError ? (
        <EmptyState icon={<Megaphone />} title="Could not load campaigns" description={describeApiError(q.error)} />
      ) : q.isPending ? (
        <Skeleton className="h-72" />
      ) : q.data.items.length === 0 ? (
        <EmptyState icon={<Megaphone />} title="No campaigns" description={status ? `No ${humanize(status)} campaigns.` : 'Create a campaign for an advertiser.'} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Flight</TableHead>
              <TableHead className="hidden lg:table-cell">Pricing</TableHead>
              <TableHead className="hidden lg:table-cell">Budget</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.items.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link to={`/advertising/campaigns/${c.id}`} className="font-semibold hover:underline">
                    {c.name}
                  </Link>
                  <p className="text-xs text-muted">
                    {c.advertiser.name} · {c.creatives.length} creative{c.creatives.length === 1 ? '' : 's'}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant={CAMPAIGN_STATUS_VARIANT[c.status]}>{humanize(c.status)}</Badge>
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">
                  {formatDate(c.startsAt)} – {formatDate(c.endsAt)}
                </TableCell>
                <TableCell className="hidden text-sm lg:table-cell">
                  {formatMoney(c.rateCents, c.currency)} {PRICING_LABEL[c.pricingModel]}
                </TableCell>
                <TableCell className="hidden font-mono lg:table-cell">{formatMoney(c.budgetCents, c.currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent size="lg" className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>Campaigns start as drafts. Add creatives, then submit for editor review.</DialogDescription>
          </DialogHeader>
          {creating ? <CampaignForm onDone={(c) => { setCreating(false); navigate(`/advertising/campaigns/${c.id}`); }} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
