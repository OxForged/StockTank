import type { AdminPlacement, PlacementUpdate } from '@stocktank/types';
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
import { Wallet } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { describeApiError } from '../../lib/auth';
import { PRICING_LABEL, formatMoney, parseMoneyToCents } from '../../lib/format';

const SELECT = 'h-10 rounded-md border border-hairline-strong bg-bg px-3 text-sm text-fg focus:border-primary focus:outline-none';

function RateDialog({ placement, onClose }: { placement: AdminPlacement | null; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (input: PlacementUpdate) => api.admin.updatePlacement(placement!.key, input),
    onSuccess: () => {
      toast.success('Rate card updated');
      void qc.invalidateQueries({ queryKey: ['admin', 'ads', 'placements'] });
      onClose();
    },
    onError: (err) => toast.error('Could not update placement', { description: describeApiError(err) }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    save.mutate({
      name: String(d.get('name')),
      description: String(d.get('description')),
      specs: String(d.get('specs')),
      pricingModel: d.get('pricingModel') as PlacementUpdate['pricingModel'],
      rateCents: parseMoneyToCents(String(d.get('rate') ?? '')),
      currency: String(d.get('currency') ?? 'USD'),
      rateVisibility: d.get('rateVisibility') as PlacementUpdate['rateVisibility'],
      maxActiveCampaigns: Number(d.get('maxActiveCampaigns')),
      isActive: d.get('isActive') === 'on',
    });
  }

  return (
    <Dialog open={Boolean(placement)} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent size="lg">
        {placement ? (
          <form onSubmit={onSubmit} key={placement.key} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{placement.name}</DialogTitle>
              <DialogDescription>
                <span className="font-mono">{placement.key}</span> · {placement.surface} · {placement.format.replace('_', ' ')}
              </DialogDescription>
            </DialogHeader>
            <FormField label="Name" htmlFor="pl-name" required>
              {({ id }) => <Input id={id} name="name" defaultValue={placement.name} required />}
            </FormField>
            <FormField label="Description (shown in the public media kit)" htmlFor="pl-desc" required>
              {({ id }) => <Textarea id={id} name="description" rows={2} defaultValue={placement.description} required />}
            </FormField>
            <FormField label="Creative specs" htmlFor="pl-specs">
              {({ id }) => <Textarea id={id} name="specs" rows={2} defaultValue={placement.specs} />}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Pricing model" htmlFor="pl-model">
                {({ id }) => (
                  <select id={id} name="pricingModel" defaultValue={placement.pricingModel} className={SELECT}>
                    {Object.entries(PRICING_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField label="Rate" htmlFor="pl-rate" hint="Leave blank for no rate.">
                {({ id }) => <Input id={id} name="rate" inputMode="decimal" defaultValue={placement.rateCents === null ? '' : String(placement.rateCents / 100)} />}
              </FormField>
              <FormField label="Currency" htmlFor="pl-currency">
                {({ id }) => <Input id={id} name="currency" maxLength={3} defaultValue={placement.currency} />}
              </FormField>
              <FormField label="Rate visibility" htmlFor="pl-vis" hint="Public rates appear on /advertise.">
                {({ id }) => (
                  <select id={id} name="rateVisibility" defaultValue={placement.rateVisibility} className={SELECT}>
                    <option value="on_request">On request</option>
                    <option value="public">Public</option>
                  </select>
                )}
              </FormField>
              <FormField label="Max concurrent campaigns" htmlFor="pl-max">
                {({ id }) => <Input id={id} name="maxActiveCampaigns" type="number" min={1} max={50} defaultValue={placement.maxActiveCampaigns} />}
              </FormField>
              <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
                <input type="checkbox" name="isActive" defaultChecked={placement.isActive} className="size-4 accent-[var(--st-primary)]" />
                Sellable (active)
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
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

export function PlacementsPage() {
  const [editing, setEditing] = useState<AdminPlacement | null>(null);
  const q = useQuery({ queryKey: ['admin', 'ads', 'placements'], queryFn: () => api.admin.listPlacements() });

  return (
    <>
      <PageTitle
        kicker="Advertising"
        title="Rate card"
        description="Sellable inventory. Nothing is priced until sales sets a rate; only rates marked public appear in the media kit."
      />
      {q.isError ? (
        <EmptyState icon={<Wallet />} title="Could not load placements" description={describeApiError(q.error)} />
      ) : q.isPending ? (
        <Skeleton className="h-80" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Placement</TableHead>
              <TableHead className="hidden md:table-cell">Surface</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead className="hidden lg:table-cell">Live campaigns</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((p) => (
              <TableRow key={p.key}>
                <TableCell>
                  <p className="font-semibold">{p.name}</p>
                  <p className="font-mono text-xs text-muted">{p.key}</p>
                </TableCell>
                <TableCell className="hidden capitalize md:table-cell">{p.surface}</TableCell>
                <TableCell>
                  <p className="font-mono">{formatMoney(p.rateCents, p.currency)}</p>
                  <p className="text-xs text-muted">
                    {PRICING_LABEL[p.pricingModel]} · {p.rateVisibility === 'public' ? 'public' : 'on request'}
                  </p>
                </TableCell>
                <TableCell className="hidden font-mono lg:table-cell">
                  {p.activeCampaignCount} / {p.maxActiveCampaigns}
                </TableCell>
                <TableCell>
                  <Badge variant={p.isActive ? 'primary' : 'neutral'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <RateDialog placement={editing} onClose={() => setEditing(null)} />
    </>
  );
}
