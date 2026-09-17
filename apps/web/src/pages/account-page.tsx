import { Avatar, Badge, Button, Card, CardDescription, CardHeader, CardTitle, EmptyState } from '@stocktank/ui';
import { Library, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';

import { PageHeader } from '../components/page-header';
import { useLogout, useMe } from '../lib/auth';
import { useDocumentTitle } from '../lib/seo';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Protected: wrapped in <RequireAuth> by the router, so `user` is present. */
export function AccountPage() {
  useDocumentTitle('Account');
  const { user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <>
      <PageHeader
        kicker="Account"
        title={user.displayName}
        description={user.email}
        action={
          <Button
            variant="secondary"
            leadingIcon={<LogOut aria-hidden="true" />}
            loading={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/') })}
          >
            Sign out
          </Button>
        }
      />
      <div className="container-site grid gap-6 py-10 md:grid-cols-[minmax(0,20rem)_1fr] md:py-14">
        <Card>
          <div className="flex items-center gap-4">
            <Avatar name={user.displayName} src={user.avatarUrl} size="xl" />
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold">{user.displayName}</p>
              <p className="truncate text-sm text-muted">{user.email}</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Member since</dt>
              <dd className="font-medium">{formatDate(user.createdAt)}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-muted">Roles</dt>
              <dd className="flex flex-wrap justify-end gap-1">
                {user.roles.map((r) => (
                  <Badge key={r} variant={r === 'viewer' ? 'neutral' : 'primary'}>
                    {r.replace('_', ' ')}
                  </Badge>
                ))}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-muted">User ID</dt>
              <dd className="truncate font-mono text-xs text-muted" title={user.id}>
                {user.id}
              </dd>
            </div>
          </dl>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Library</CardTitle>
              <CardDescription>Followed shows, saved episodes and history.</CardDescription>
            </CardHeader>
            <EmptyState
              size="sm"
              icon={<Library />}
              kicker="Scheduled for Milestone 2 · Content"
              title="Nothing saved yet"
              description="Once shows are published you can follow them here and pick up where you left off on any device."
            />
          </Card>
          <Card variant="outline">
            <CardHeader>
              <CardTitle>Profile & security</CardTitle>
              <CardDescription>
                Editing your name, avatar and password, plus wallet linking, arrive in a later release. Contact support if you
                need a change before then.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </>
  );
}
