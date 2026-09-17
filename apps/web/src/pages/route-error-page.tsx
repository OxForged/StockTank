import { Button } from '@stocktank/ui';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { NotFoundPage } from './not-found-page';

/** Root error boundary: 404s render the designed page; anything else gets a calm recovery screen. */
export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  return (
    <div className="container-site flex min-h-[60dvh] flex-col items-center justify-center gap-6 py-20 text-center">
      <p className="kicker text-danger">Something broke</p>
      <h1 className="font-display text-display-md font-extrabold text-fg">We hit a technical problem.</h1>
      <p className="max-w-md text-muted">Reloading usually fixes it. If it keeps happening, the team has been notified.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => window.location.reload()}>Reload</Button>
        <Button asChild variant="outline">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
