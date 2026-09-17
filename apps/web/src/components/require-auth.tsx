import { Button, EmptyState, Skeleton } from '@stocktank/ui';
import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { useMe } from '../lib/auth';

/** Redirects to /login when the session is missing. Renders a skeleton while `me` resolves. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading, isError, refetch } = useMe();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="container-site py-12" aria-busy="true" aria-label="Checking your session">
        <Skeleton className="mb-4 h-4 w-32" />
        <Skeleton className="mb-8 h-10 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container-site py-12">
        <EmptyState
          icon={<ShieldAlert />}
          title="We could not check your session"
          description="The StockTank API did not respond. Try again in a moment."
          action={
            <Button variant="secondary" onClick={() => void refetch()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
