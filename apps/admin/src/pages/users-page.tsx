import { roleKeySchema, type AdminUser, type RoleKey } from '@stocktank/types';
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
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@stocktank/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Pencil, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';

import { PageTitle } from '../components/page-title';
import { api } from '../lib/api';
import { can, describeApiError, useMe } from '../lib/auth';

const PAGE_SIZE = 25;
const ROLES: readonly RoleKey[] = roleKeySchema.options;

const ROLE_HELP: Record<RoleKey, string> = {
  super_admin: 'Full platform control, including roles',
  admin: 'Operates the platform; cannot manage roles',
  editor: 'Reviews, approves and publishes content and ads',
  sales: 'Manages advertisers, campaigns and leads; approvals need an editor',
  creator: 'Creates drafts; publishing requires an editor',
  viewer: 'Standard audience account',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/* -------------------------------------------------------------------------- */
/* Role editor                                                                 */
/* -------------------------------------------------------------------------- */

function RoleEditorDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: RoleKey[] }) => api.admin.updateUserRoles(id, roles),
    onSuccess: (_data, vars) => {
      toast.success('Roles updated', { description: `${user?.email ?? 'User'} is now ${vars.roles.join(', ')}.` });
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
    onError: (err) => toast.error('Could not update roles', { description: describeApiError(err) }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const roles = new FormData(e.currentTarget).getAll('roles').filter((r): r is RoleKey => ROLES.includes(r as RoleKey));
    if (roles.length === 0) {
      toast.error('Pick at least one role');
      return;
    }
    mutation.mutate({ id: user.id, roles });
  }

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent size="sm">
        {user ? (
          <form onSubmit={onSubmit} key={user.id}>
            <DialogHeader>
              <DialogTitle>Edit roles</DialogTitle>
              <DialogDescription>
                {user.displayName} · <span className="font-mono">{user.email}</span>
              </DialogDescription>
            </DialogHeader>
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Roles</legend>
              {ROLES.map((role) => (
                <label
                  key={role}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-hairline p-3 transition-colors hover:border-hairline-strong has-[:checked]:border-primary/50 has-[:checked]:bg-primary-soft"
                >
                  <input type="checkbox" name="roles" value={role} defaultChecked={user.roles.includes(role)} className="mt-0.5 size-4 accent-[var(--st-primary)]" />
                  <span>
                    <span className="block text-sm font-semibold">{role.replace('_', ' ')}</span>
                    <span className="block text-xs text-muted">{ROLE_HELP[role]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" loading={mutation.isPending}>
                Save roles
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export function UsersPage() {
  const { user: me } = useMe();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const canManage = can(me, 'users.manage');

  const query = useQuery({
    queryKey: ['admin', 'users', page],
    queryFn: () => api.admin.listUsers(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });

  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = query.data ? Math.min(total, (page - 1) * PAGE_SIZE + query.data.items.length) : 0;

  function goTo(p: number) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p <= 1) next.delete('page');
      else next.set('page', String(p));
      return next;
    });
  }

  return (
    <>
      <PageTitle
        kicker="System"
        title="Users"
        description="Every account on the platform. Roles control what each user can do in the control room."
        action={
          <p className="font-mono text-xs text-muted" aria-live="polite">
            {query.data ? `${first}–${last} of ${total}` : ''}
          </p>
        }
      />

      {query.isError ? (
        <EmptyState
          icon={<Users />}
          title="Could not load users"
          description={describeApiError(query.error)}
          action={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              Retry
            </Button>
          }
        />
      ) : query.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading users">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : query.data.items.length === 0 ? (
        <EmptyState icon={<Users />} title="No users yet" description="Accounts appear here as people register." />
      ) : (
        <Table aria-busy={query.isFetching || undefined}>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
              <TableHead className="hidden lg:table-cell">Created</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.items.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <p className="font-semibold">{u.displayName}</p>
                  <p className="font-mono text-xs text-muted">{u.email}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={u.status === 'active' ? 'primary' : 'danger'}>{u.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <Badge key={r} variant="neutral">
                        {r.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap font-mono text-xs text-muted md:table-cell">{formatDate(u.lastLoginAt)}</TableCell>
                <TableCell className="hidden whitespace-nowrap font-mono text-xs text-muted lg:table-cell">{formatDate(u.createdAt)}</TableCell>
                <TableCell className="text-right">
                  {canManage ? (
                    <Button variant="ghost" size="sm" leadingIcon={<Pencil aria-hidden="true" />} onClick={() => setEditing(u)} aria-label={`Edit roles for ${u.displayName}`}>
                      Roles
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {query.data && pageCount > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-2">
          <Button variant="secondary" size="sm" leadingIcon={<ChevronLeft aria-hidden="true" />} disabled={page <= 1} onClick={() => goTo(page - 1)}>
            Previous
          </Button>
          <p className="font-mono text-xs text-muted">
            Page {page} of {pageCount}
          </p>
          <Button variant="secondary" size="sm" trailingIcon={<ChevronRight aria-hidden="true" />} disabled={page >= pageCount} onClick={() => goTo(page + 1)}>
            Next
          </Button>
        </nav>
      ) : null}

      <RoleEditorDialog user={editing} onClose={() => setEditing(null)} />
    </>
  );
}
