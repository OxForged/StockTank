import type { Advertiser, AdvertiserInput } from '@stocktank/types';
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
import { Building, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { can, describeApiError, useMe } from '../../lib/auth';
import { ADVERTISER_STATUS_VARIANT, formatDate, humanize } from '../../lib/format';

function AdvertiserDialog({ open, advertiser, onClose }: { open: boolean; advertiser: Advertiser | null; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async (input: AdvertiserInput): Promise<void> => {
      if (advertiser) await api.admin.updateAdvertiser(advertiser.id, input);
      else await api.admin.createAdvertiser(input);
    },
    onSuccess: () => {
      toast.success(advertiser ? 'Advertiser updated' : 'Advertiser created', { description: advertiser ? undefined : 'It needs editor approval before campaigns can run.' });
      void qc.invalidateQueries({ queryKey: ['admin', 'ads', 'advertisers'] });
      onClose();
    },
    onError: (err) => toast.error('Could not save advertiser', { description: describeApiError(err) }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const text = (k: string) => {
      const v = String(d.get(k) ?? '').trim();
      return v ? v : null;
    };
    const website = text('website');
    save.mutate({
      name: String(d.get('name') ?? '').trim(),
      website: website && !/^https?:\/\//i.test(website) ? `https://${website}` : website,
      contactName: text('contactName'),
      contactEmail: text('contactEmail'),
      industry: text('industry'),
      complianceNotes: text('complianceNotes'),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent size="md">
        <form onSubmit={onSubmit} key={advertiser?.id ?? 'new'} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{advertiser ? 'Edit advertiser' : 'New advertiser'}</DialogTitle>
            <DialogDescription>Compliance notes are internal and never shown publicly.</DialogDescription>
          </DialogHeader>
          <FormField label="Name" htmlFor="adv-name" required>
            {({ id }) => <Input id={id} name="name" defaultValue={advertiser?.name} required minLength={2} />}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Website" htmlFor="adv-website">
              {({ id }) => <Input id={id} name="website" defaultValue={advertiser?.website ?? ''} placeholder="example.com" />}
            </FormField>
            <FormField label="Industry" htmlFor="adv-industry">
              {({ id }) => <Input id={id} name="industry" defaultValue={advertiser?.industry ?? ''} />}
            </FormField>
            <FormField label="Contact name" htmlFor="adv-contact">
              {({ id }) => <Input id={id} name="contactName" defaultValue={advertiser?.contactName ?? ''} />}
            </FormField>
            <FormField label="Contact email" htmlFor="adv-email">
              {({ id }) => <Input id={id} name="contactEmail" type="email" defaultValue={advertiser?.contactEmail ?? ''} />}
            </FormField>
          </div>
          <FormField label="Compliance notes" htmlFor="adv-notes" hint="KYC, category checks, restrictions agreed with the advertiser.">
            {({ id }) => <Textarea id={id} name="complianceNotes" rows={3} defaultValue={advertiser?.complianceNotes ?? ''} />}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdvertisersPage() {
  const { user } = useMe();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Advertiser | null>(null);
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ['admin', 'ads', 'advertisers'], queryFn: () => api.admin.listAdvertisers() });
  const canApprove = can(user, 'ads.approve');

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Advertiser['status'] }) => api.admin.setAdvertiserStatus(id, status),
    onSuccess: (_d, v) => {
      toast.success(`Advertiser ${humanize(v.status)}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'ads'] });
    },
    onError: (err) => toast.error('Could not change status', { description: describeApiError(err) }),
  });

  return (
    <>
      <PageTitle
        kicker="Advertising"
        title="Advertisers"
        description="Brands that can buy placements. An editor (ads.approve) must approve an advertiser before any of its campaigns can run."
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            New advertiser
          </Button>
        }
      />
      {q.isError ? (
        <EmptyState icon={<Building />} title="Could not load advertisers" description={describeApiError(q.error)} />
      ) : q.isPending ? (
        <Skeleton className="h-64" />
      ) : q.data.items.length === 0 ? (
        <EmptyState icon={<Building />} title="No advertisers yet" description="Create one from a qualified lead." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Advertiser</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Contact</TableHead>
              <TableHead className="hidden md:table-cell">Campaigns</TableHead>
              <TableHead className="hidden lg:table-cell">Created</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.items.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <p className="font-semibold">
                    {a.name} {a.isHouse ? <Badge variant="mono">house</Badge> : null}
                  </p>
                  <p className="text-xs text-muted">{a.industry ?? '—'}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={ADVERTISER_STATUS_VARIANT[a.status]}>{humanize(a.status)}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <p className="text-sm">{a.contactName ?? '—'}</p>
                  <p className="font-mono text-xs text-muted">{a.contactEmail ?? ''}</p>
                </TableCell>
                <TableCell className="hidden font-mono md:table-cell">{a.campaignCount}</TableCell>
                <TableCell className="hidden text-sm text-muted lg:table-cell">{formatDate(a.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
                      Edit
                    </Button>
                    {canApprove && a.status !== 'approved' ? (
                      <Button variant="secondary" size="sm" loading={setStatus.isPending} onClick={() => setStatus.mutate({ id: a.id, status: 'approved' })}>
                        Approve
                      </Button>
                    ) : null}
                    {canApprove && a.status === 'approved' && !a.isHouse ? (
                      <Button variant="danger" size="sm" onClick={() => setStatus.mutate({ id: a.id, status: 'suspended' })}>
                        Suspend
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <AdvertiserDialog open={creating || Boolean(editing)} advertiser={editing} onClose={() => { setCreating(false); setEditing(null); }} />
    </>
  );
}
