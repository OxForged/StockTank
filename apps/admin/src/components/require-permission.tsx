import type { PermissionKey } from '@stocktank/types';
import { Button, EmptyState } from '@stocktank/ui';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { can, useMe } from '../lib/auth';

/** Per-page gate. The app-level AdminGate guarantees a user; this checks one permission. */
export function RequirePermission({ permission, children }: { permission?: PermissionKey; children: ReactNode }) {
  const { user } = useMe();
  if (permission && !can(user, permission)) {
    return (
      <EmptyState
        variant="surface"
        size="lg"
        icon={<Lock />}
        kicker="Forbidden"
        title="You do not have access to this page"
        description={
          <>
            It requires the <span className="font-mono text-fg">{permission}</span> permission.
          </>
        }
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to="/">Back to dashboard</Link>
          </Button>
        }
      />
    );
  }
  return <>{children}</>;
}
