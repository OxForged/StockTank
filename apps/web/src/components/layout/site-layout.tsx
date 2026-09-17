import { Toaster } from '@stocktank/ui';
import { useEffect, type ReactNode } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';

import { captureAttribution } from '../../lib/attribution';
import { useWatchlistAccountSync } from '../../lib/library';
import { MiniPlayer } from '../player/mini-player';
import { BottomNav } from './bottom-nav';
import { Footer } from './footer';
import { MarketsTape } from './markets-tape';
import { RailNav } from './rail-nav';
import { TopBar } from './top-bar';

/**
 * Hybrid A + B shell: Concept B's left rail, top bar and MARKETS tape around Concept A's editorial pages.
 * Renders `children` when given (error boundary), otherwise the matched route.
 */
export function SiteLayout({ children }: { children?: ReactNode }) {
  useEffect(() => {
    captureAttribution();
  }, []);
  useWatchlistAccountSync();

  return (
    <div className="min-h-dvh bg-bg text-fg transition-colors">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <RailNav />
      <div className="flex min-h-dvh flex-col pb-[calc(var(--spacing-bottom-nav)+6rem)] lg:pb-28 lg:pl-rail">
        <TopBar />
        <MarketsTape />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children ?? <Outlet />}
        </main>
        <Footer />
      </div>
      <MiniPlayer />
      <BottomNav />
      <Toaster />
      <ScrollRestoration />
    </div>
  );
}
