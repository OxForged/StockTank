import { API_KEY_SCOPES, PERMISSION_DESCRIPTIONS, type ApiKeySummary, type AuditLogEntry, type CreatedApiKey } from '@stocktank/types';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@stocktank/ui';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, ListChecks, ScrollText, Shield } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { describeApiError, useMe } from '../../lib/auth';
import { formatDate, humanize } from '../../lib/format';

// ───────── Audit log ─────────

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  const hasMeta = entry.metadata !== null && entry.metadata !== undefined && JSON.stringify(entry.metadata) !== '{}';
  return (
    <>
      <TableRow>
        <TableCell className="whitespace-nowrap font-mono text-xs text-muted">{formatDate(entry.createdAt, true)}</TableCell>
        <TableCell>
          <code className="font-mono text-xs">{entry.action}</code>
        </TableCell>
        <TableCell className="text-sm">{entry.actor ? entry.actor.email : <span className="text-muted">system / anonymous</span>}</TableCell>
        <TableCell className="hidden font-mono text-xs text-muted md:table-cell">
          {entry.targetType ? `${entry.targetType}:${entry.targetId ?? ''}` : '—'}
        </TableCell>
        <TableCell className="text-right">
          {hasMeta || entry.requestId ? (
            <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? 'Hide' : 'Details'}
            </Button>
          ) : null}
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow>
          <TableCell colSpan={5} className="bg-raised/40">
            <dl className="grid gap-2 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-muted">Request</dt>
                <dd className="font-mono">{entry.requestId ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted">IP</dt>
                <dd className="font-mono">{entry.ipAddress ?? '—'}</dd>
              </div>
              <div className="sm:col-span-3">
                <dt className="text-muted">Metadata</dt>
                <dd>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono">{JSON.stringify(entry.metadata, null, 2)}</pre>
                </dd>
              </div>
            </dl>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function AuditLogsPage() {
  const [params, setParams] = useSearchParams();
  const action = params.get('action') ?? '';
  const targetType = params.get('targetType') ?? '';
  const q = useInfiniteQuery({
    queryKey: ['admin', 'audit', action, targetType],
    queryFn: ({ pageParam }) => api.admin.system.auditLogs({ action: action || undefined, targetType: targetType || undefined, cursor: pageParam, pageSize: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  function onFilter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const next: Record<string, string> = {};
    const a = String(d.get('action') ?? '').trim();
    const t = String(d.get('targetType') ?? '').trim();
    if (a) next.action = a;
    if (t) next.targetType = t;
    setParams(next);
  }

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <PageTitle kicker="System" title="Audit log" description="Who changed what, and when. Entries never contain passwords, tokens or raw email addresses in metadata." />
      <form onSubmit={onFilter} className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" role="search">
        <FormField label="Action starts with" htmlFor="audit-action">
          {({ id }) => <Input id={id} name="action" defaultValue={action} placeholder="content.media" className="font-mono" />}
        </FormField>
        <FormField label="Target type" htmlFor="audit-target">
          {({ id }) => <Input id={id} name="targetType" defaultValue={targetType} placeholder="episode" className="font-mono" />}
        </FormField>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      {q.isError ? (
        <EmptyState icon={<ScrollText />} title="Could not load the audit log" description={describeApiError(q.error)} />
      ) : q.isPending ? (
        <Skeleton className="h-72" />
      ) : items.length === 0 ? (
        <EmptyState icon={<ScrollText />} title="No matching entries" description="Try a broader action prefix." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead className="hidden md:table-cell">Target</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Details</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <AuditRow key={e.id} entry={e} />
              ))}
            </TableBody>
          </Table>
          {q.hasNextPage ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => void q.fetchNextPage()} loading={q.isFetchingNextPage}>
                Load older entries
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

// ───────── Roles & permissions ─────────

const CODE_NOTE = 'Role definitions live in code (packages/database/src/rbac.ts) and are applied by the seed, so every change goes through review.';

export function RolesPage() {
  const q = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => api.admin.system.roles() });
  return (
    <>
      <PageTitle kicker="System" title="Roles" description={CODE_NOTE} />
      {q.isError ? (
        <EmptyState icon={<Shield />} title="Could not load roles" description={describeApiError(q.error)} />
      ) : q.isPending ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {q.data.map((r) => (
            <Card key={r.key}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>{r.name}</span>
                  <Badge variant="neutral">
                    {r.userCount} {r.userCount === 1 ? 'user' : 'users'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  <code className="font-mono text-xs">{r.key}</code> · {r.description}
                </CardDescription>
              </CardHeader>
              <div className="flex flex-wrap gap-1.5 px-6 pb-6">
                {r.permissions.length === 0 ? <span className="text-sm text-muted">No staff permissions</span> : r.permissions.map((p) => <Badge key={p} variant="mono" title={PERMISSION_DESCRIPTIONS[p]}>{p}</Badge>)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export function PermissionsPage() {
  const q = useQuery({ queryKey: ['admin', 'permissions'], queryFn: () => api.admin.system.permissions() });
  return (
    <>
      <PageTitle kicker="System" title="Permissions" description={CODE_NOTE} />
      {q.isError ? (
        <EmptyState icon={<ListChecks />} title="Could not load permissions" description={describeApiError(q.error)} />
      ) : q.isPending ? (
        <Skeleton className="h-72" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Permission</TableHead>
              <TableHead>Granted by</TableHead>
              <TableHead className="text-right">Users</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((p) => (
              <TableRow key={p.key}>
                <TableCell>
                  <code className="font-mono text-xs">{p.key}</code>
                  <p className="text-sm text-muted">{p.description}</p>
                </TableCell>
                <TableCell className="text-sm">{p.roles.map(humanize).join(', ') || '—'}</TableCell>
                <TableCell className="text-right font-mono">{p.userCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

// ───────── API keys ─────────

function keyState(k: ApiKeySummary): { label: string; variant: 'primary' | 'danger' | 'neutral' } {
  if (k.revokedAt) return { label: 'Revoked', variant: 'danger' };
  if (k.expiresAt && new Date(k.expiresAt) <= new Date()) return { label: 'Expired', variant: 'neutral' };
  return { label: 'Active', variant: 'primary' };
}

function CreateKeyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useMe();
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const grantable = API_KEY_SCOPES.filter((s) => user?.permissions.includes(s));
  const create = useMutation({
    mutationFn: (input: Parameters<typeof api.admin.system.createApiKey>[0]) => api.admin.system.createApiKey(input),
    onSuccess: (res) => {
      setCreated(res);
      void qc.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
    },
    onError: (err) => setError(describeApiError(err)),
  });

  function close() {
    setCreated(null);
    setError(null);
    onClose();
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const d = new FormData(e.currentTarget);
    const scopes = d.getAll('scopes').map(String) as (typeof API_KEY_SCOPES)[number][];
    if (scopes.length === 0) {
      setError('Choose at least one scope.');
      return;
    }
    const expiry = String(d.get('expiresInDays') ?? '90');
    create.mutate({ name: String(d.get('name') ?? '').trim(), scopes, expiresInDays: expiry === 'never' ? null : Number(expiry) });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? close() : undefined)}>
      <DialogContent size="lg">
        {created ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Copy your API key now</DialogTitle>
              <DialogDescription>This is the only time the key is shown. StockTank stores only a hash of it.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-raised px-3 py-2 font-mono text-xs" data-testid="api-key-secret">
                {created.secret}
              </code>
              <Button
                variant="outline"
                aria-label="Copy API key"
                onClick={() => {
                  void navigator.clipboard?.writeText(created.secret).then(() => toast.success('API key copied'));
                }}
              >
                <Copy className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="text-sm text-muted">
              Send it as <code className="font-mono">Authorization: Bearer …</code> on GET requests. Keys are read-only and follow your current permissions.
            </p>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>New API key</DialogTitle>
              <DialogDescription>For reporting and integrations. Keys can read, never write.</DialogDescription>
            </DialogHeader>
            <FormField label="Name" htmlFor="key-name" required hint="Who or what uses it">
              {({ id }) => <Input id={id} name="name" required minLength={2} maxLength={80} />}
            </FormField>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">Scopes</legend>
              {API_KEY_SCOPES.map((s) => {
                const allowed = grantable.includes(s);
                return (
                  <label key={s} className={`flex items-start gap-2 text-sm ${allowed ? '' : 'opacity-50'}`}>
                    <input type="checkbox" name="scopes" value={s} disabled={!allowed} className="mt-0.5 size-4 accent-[var(--color-primary)]" />
                    <span>
                      <code className="font-mono text-xs">{s}</code> <span className="text-muted">{PERMISSION_DESCRIPTIONS[s]}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <FormField label="Expires" htmlFor="key-expiry">
              {({ id }) => (
                <select id={id} name="expiresInDays" defaultValue="90" className="h-10 w-full rounded-md border border-hairline-strong bg-bg px-3 text-sm text-fg">
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                  <option value="never">Never</option>
                </select>
              )}
            </FormField>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={create.isPending}>
                Create key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ApiKeysPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ['admin', 'api-keys'], queryFn: () => api.admin.system.apiKeys() });
  const revoke = useMutation({
    mutationFn: (id: string) => api.admin.system.revokeApiKey(id),
    onSuccess: () => {
      toast.success('API key revoked');
      void qc.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
    },
    onError: (err) => toast.error('Could not revoke', { description: describeApiError(err) }),
  });

  return (
    <>
      <PageTitle
        kicker="System"
        title="API keys"
        description="Read-only keys for reporting and partner integrations. Creation and revocation are audited."
        action={
          <Button onClick={() => setCreating(true)}>
            <KeyRound className="size-4" aria-hidden="true" />
            New key
          </Button>
        }
      />
      {q.isError ? (
        <EmptyState icon={<KeyRound />} title="Could not load API keys" description={describeApiError(q.error)} />
      ) : q.isPending ? (
        <Skeleton className="h-60" />
      ) : q.data.length === 0 ? (
        <EmptyState icon={<KeyRound />} title="No API keys" description="Create a key when an integration needs read access." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead className="hidden lg:table-cell">Last used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((k) => {
              const state = keyState(k);
              return (
                <TableRow key={k.id}>
                  <TableCell>
                    <p className="font-semibold">{k.name}</p>
                    <p className="font-mono text-xs text-muted">
                      {k.prefix}_… · {k.owner.email}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <span className="flex flex-wrap gap-1">
                      {k.scopes.map((s) => (
                        <Badge key={s} variant="mono">
                          {s}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted lg:table-cell">{k.lastUsedAt ? formatDate(k.lastUsedAt, true) : 'Never'}</TableCell>
                  <TableCell>
                    <Badge variant={state.variant}>{state.label}</Badge>
                    {k.expiresAt && !k.revokedAt ? <p className="text-xs text-muted">until {formatDate(k.expiresAt)}</p> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    {!k.revokedAt ? (
                      <Button size="sm" variant="outline" onClick={() => revoke.mutate(k.id)} loading={revoke.isPending && revoke.variables === k.id}>
                        Revoke
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <CreateKeyDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
