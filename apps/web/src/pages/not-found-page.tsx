import { Button, LogoMark } from '@stocktank/ui';
import { Link } from 'react-router';

import { useDocumentTitle } from '../lib/seo';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="container-site flex min-h-[60dvh] flex-col items-center justify-center gap-6 py-20 text-center">
      <LogoMark size={64} tone="mono" className="text-faint" />
      <p className="kicker text-primary-hi">Error 404</p>
      <h1 className="font-display text-display-md font-extrabold text-fg">This page is off air.</h1>
      <p className="max-w-md text-muted">The link may be out of date, or the page has not been published yet.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/shows">Browse shows</Link>
        </Button>
      </div>
    </div>
  );
}
