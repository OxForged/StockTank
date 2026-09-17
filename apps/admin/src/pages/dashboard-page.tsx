import { Avatar, Badge, Button, Card, CardDescription, CardHeader, CardTitle, Skeleton, cn, toast } from '@stocktank/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Activity, RefreshCw, Search, Server } from 'lucide-react';
import { Link } from 'react-router';

import { PageTitle } from '../components/page-title';
import { api } from '../lib/api';
import { can, describeApiError, useMe } from '../lib/auth';
import { visibleNav, isGroup } from '../lib/nav';

function StatusDot({ ok }: { ok: boolean | null }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2 rounded-full', ok === null ? 'bg-faint' : ok ? 'bg-primary-hi shadow-[0_0_10px_rgb(30_240_168/0.7)]' : 'bg-danger')}
    />
  );
}

function SystemStatusCard() {
  const ready = useQuery({ queryKey: ['system', 'ready'], queryFn: () => api.system.ready(), refetchInterval: 30_000 });
  const version = useQuery({ queryKey: ['system', 'version'], queryFn: () => api.system.version() });

  const overall = ready.isPending ? null : ready.isError ? false : ready.data.status === 'ready';

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Server className="size-4 text-primary-hi" aria-hidden="true" />
            API status
          </CardTitle>
          <CardDescription>Live readiness and version from the StockTank API.</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Refresh status"
          onClick={() => {
            void ready.refetch();
            void version.refetch();
          }}
        >
          <RefreshCw className={cn(ready.isFetching && 'animate-spin')} aria-hidden="true" />
        </Button>
      </CardHeader>

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-hairline bg-raised/50 p-3">
        <StatusDot ok={overall} />
        <span className="font-display text-base font-bold">
          {ready.isPending ? 'Checking…' : ready.isError ? 'Unreachable' : ready.data.status === 'ready' ? 'Ready' : 'Not ready'}
        </span>
        {ready.isError ? <span className="text-sm text-danger">{describeApiError(ready.error)}</span> : null}
        <span className="ml-auto font-mono text-xs text-muted">
          {version.isPending ? (
            <Skeleton className="inline-block h-3 w-32 align-middle" />
          ) : version.isError ? (
            'version unavailable'
          ) : (
            <>
              {version.data.name}@{version.data.version}
              {version.data.commit ? ` · ${version.data.commit.slice(0, 7)}` : ''} · node {version.data.node}
            </>
          )}
        </span>
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Readiness checks">
        {ready.isPending
          ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10" />)
          : ready.isError
            ? null
            : Object.entries(ready.data.checks).map(([name, check]) => (
                <li key={name} className="flex items-center gap-3 rounded-md border border-hairline px-3 py-2 text-sm">
                  <StatusDot ok={check.ok} />
                  <span className="font-mono text-xs uppercase tracking-wider">{name}</span>
                  <span className="ml-auto font-mono text-xs text-muted">
                    {check.ok ? (check.latencyMs !== undefined ? `${check.latencyMs} ms` : 'ok') : (check.error ?? 'failed')}
                  </span>
                </li>
              ))}
      </ul>
    </Card>
  );
}

function SessionCard() {
  const { user } = useMe();
  if (!user) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Signed in</CardTitle>
        <CardDescription>Your session and permissions.</CardDescription>
      </CardHeader>
      <div className="flex items-center gap-3">
        <Avatar name={user.displayName} src={user.avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.displayName}</p>
          <p className="truncate font-mono text-xs text-muted">{user.email}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1">
        {user.roles.map((r) => (
          <Badge key={r} variant="primary">
            {r.replace('_', ' ')}
          </Badge>
        ))}
      </div>
      <details className="mt-4 text-xs">
        <summary className="cursor-pointer text-muted hover:text-fg">
          {user.permissions.length} permission{user.permissions.length === 1 ? '' : 's'}
        </summary>
        <ul className="mt-2 flex flex-wrap gap-1">
          {user.permissions.map((p) => (
            <li key={p}>
              <Badge variant="mono">{p}</Badge>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function AreasCard() {
  const { user } = useMe();
  if (!user) return null;
  const groups = visibleNav(user).filter(isGroup);
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-primary-hi" aria-hidden="true" />
          Areas
        </CardTitle>
        <CardDescription>What is operational now and what is scheduled, per README §53.</CardDescription>
      </CardHeader>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => {
          const live = g.items.filter((i) => !i.milestone);
          const upcoming = g.items.filter((i) => i.milestone);
          const Icon = g.icon;
          return (
            <li key={g.label} className="rounded-md border border-hairline bg-raised/40 p-3">
              <p className="flex items-center gap-2 font-display text-sm font-bold">
                <Icon className="size-4 text-muted" aria-hidden="true" />
                {g.label}
              </p>
              <p className="mt-1 text-xs text-muted">
                {live.length ? (
                  <>
                    Operational:{' '}
                    {live.map((i, idx) => (
                      <span key={i.to}>
                        <Link to={i.to} className="text-primary-hi hover:underline">
                          {i.label}
                        </Link>
                        {idx < live.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                    .{' '}
                  </>
                ) : null}
                {upcoming.length ? `${upcoming.length} page${upcoming.length === 1 ? '' : 's'} scheduled (M${Math.min(...upcoming.map((i) => i.milestone ?? 99))}+).` : null}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useMe();
  return (
    <>
      <PageTitle kicker="Control room" title="Dashboard" description="System health, your session and the state of each admin area." />
      <div className="grid gap-4 lg:grid-cols-3">
        <SystemStatusCard />
        <SessionCard />
        <AreasCard />
        {can(user, 'settings.manage') ? <SearchIndexCard /> : null}
      </div>
    </>
  );
}

/** Rebuilds the public search index from published content (settings.manage). */
export function SearchIndexCard() {
  const reindex = useMutation({
    mutationFn: () => api.admin.content.reindexSearch(),
    onSuccess: (r) =>
      toast.success(`Search index rebuilt (${r.engine})`, {
        description: Object.entries(r.indexed)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' · '),
      }),
    onError: (err) => toast.error('Reindex failed', { description: describeApiError(err) }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="size-4 text-primary-hi" aria-hidden="true" />
          Search index
        </CardTitle>
        <CardDescription>Edits sync automatically. Rebuild after bulk imports or if search looks stale.</CardDescription>
      </CardHeader>
      <Button variant="secondary" size="sm" className="self-start" loading={reindex.isPending} onClick={() => reindex.mutate()}>
        Rebuild index
      </Button>
    </Card>
  );
}
