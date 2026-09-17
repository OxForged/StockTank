import { Button, EmptyState, LogoMark, Skeleton, Wordmark } from '@stocktank/ui';
import { LogOut, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { hasAdminAccess, useLogout, useMe } from '../lib/auth';

const PUBLIC_SITE = import.meta.env.VITE_PUBLIC_SITE_URL ?? 'http://localhost:5190';

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-control-room" aria-busy="true" aria-label="Checking your session">
      <LogoMark size={56} />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

export function NoAccessScreen({ email }: { email: string }) {
  const logout = useLogout();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-control-room p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Wordmark mark size="md" />
        </div>
        <EmptyState
          variant="surface"
          size="lg"
          icon={<ShieldAlert />}
          kicker="No access"
          title="This account cannot use the control room"
          description={
            <>
              You are signed in as <span className="font-mono text-fg">{email}</span>, but that account has no admin
              permissions. Ask an administrator to grant you a role, or sign in with a different account.
            </>
          }
          action={
            <>
              <Button variant="secondary" leadingIcon={<LogOut aria-hidden="true" />} loading={logout.isPending} onClick={() => logout.mutate()}>
                Sign out
              </Button>
              <Button asChild variant="ghost">
                <a href={PUBLIC_SITE}>Go to StockTank</a>
              </Button>
            </>
          }
        />
      </div>
    </div>
  );
}

/**
 * Gate for the whole admin app:
 *  - no session      -> /login
 *  - session but no admin permission -> "no access" screen with logout
 *  - otherwise renders children
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { user, isLoading, isError, refetch } = useMe();
  const location = useLocation();

  if (isLoading) return <Splash />;

  if (isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-control-room p-4">
        <EmptyState
          variant="surface"
          size="lg"
          icon={<ShieldAlert />}
          title="The API is not responding"
          description="The control room could not verify your session. Check that the StockTank API is running, then retry."
          action={
            <Button variant="secondary" onClick={() => void refetch()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!hasAdminAccess(user)) return <NoAccessScreen email={user.email} />;
  return <>{children}</>;
}
