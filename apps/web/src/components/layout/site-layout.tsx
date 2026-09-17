import { Toaster } from '@stocktank/ui';
import type { ReactNode } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';

import { BottomNav } from './bottom-nav';
import { Footer } from './footer';
import { Masthead } from './masthead';

/** Site chrome. Renders `children` when given (error boundary), otherwise the matched route. */
export function SiteLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-bottom-nav lg:pb-0">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Masthead />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children ?? <Outlet />}
      </main>
      <Footer />
      <BottomNav />
      <Toaster />
      <ScrollRestoration />
    </div>
  );
}
