import { Wordmark } from '@stocktank/ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { DISCLAIMER } from '../../lib/nav';

export function AuthLayout({ title, intro, children, footer }: { title: string; intro: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="container-site grid min-h-[70dvh] items-center gap-10 py-12 lg:grid-cols-[1fr_minmax(0,28rem)] lg:gap-16 lg:py-20">
      <div className="hidden flex-col gap-6 lg:flex">
        <Wordmark tagline size="xl" />
        <p className="max-w-md text-lg text-muted">
          One account across web, mobile and TV. Follow shows, save episodes and join the conversation.
        </p>
        <p className="max-w-md text-xs text-faint">{DISCLAIMER}</p>
      </div>
      <div className="w-full rounded-xl border border-hairline bg-surface p-6 shadow-card sm:p-8">
        <div className="mb-6 lg:hidden">
          <Link to="/" className="inline-flex" aria-label="StockTank home">
            <Wordmark mark size="sm" />
          </Link>
        </div>
        <h1 className="font-display text-display-sm font-extrabold text-fg">{title}</h1>
        <p className="mt-2 text-sm text-muted">{intro}</p>
        <div className="mt-6">{children}</div>
        <div className="mt-6 border-t border-hairline pt-4 text-sm text-muted">{footer}</div>
      </div>
    </div>
  );
}
