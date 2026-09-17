import type { PlacementKey, ServedAd } from '@stocktank/types';
import { cn } from '@stocktank/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

import { api } from '../../lib/api';

/** IAB viewability: at least 50% of the unit on screen for one continuous second. */
const VIEWABLE_RATIO = 0.5;
const VIEWABLE_MS = 1000;

function useViewableImpression(token: string | undefined) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !token) return;
    if (typeof IntersectionObserver === 'undefined') return;
    let timer: number | undefined;
    let recorded = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry || recorded) return;
        if (entry.intersectionRatio >= VIEWABLE_RATIO) {
          timer ??= window.setTimeout(() => {
            recorded = true;
            observer.disconnect();
            api.ads.recordImpression(token).catch(() => undefined);
          }, VIEWABLE_MS);
        } else if (timer !== undefined) {
          window.clearTimeout(timer);
          timer = undefined;
        }
      },
      { threshold: [0, VIEWABLE_RATIO, 1] },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [token]);
  return ref;
}

export type AdVariant = 'card' | 'sidebar' | 'leaderboard' | 'strip';

interface AdSlotProps {
  placement: PlacementKey;
  variant: AdVariant;
  className?: string;
}

/**
 * Renders the ad the API selects for a placement, or nothing. Every unit carries a visible disclosure
 * label (§48); links use rel="sponsored" and go through StockTank click tracking.
 */
export function AdSlot({ placement, variant, className }: AdSlotProps) {
  const { pathname } = useLocation();
  const { data } = useQuery({
    queryKey: ['ad', placement, pathname],
    queryFn: () => api.ads.serve(placement, pathname),
    staleTime: 60_000,
    retry: false,
  });
  const ad = data?.ad ?? null;
  const ref = useViewableImpression(ad?.impressionToken);
  if (!ad) return null;

  return (
    <aside
      ref={ref as React.RefObject<HTMLElement>}
      aria-label={`${ad.isHouse ? 'From StockTank' : ad.disclosureLabel}: ${ad.advertiserName}`}
      data-placement={placement}
      className={cn('animate-rise-in', className)}
    >
      <AdBody ad={ad} variant={variant} />
    </aside>
  );
}

function Disclosure({ ad }: { ad: ServedAd }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
      <span className="rounded-xs border border-hairline-strong px-1.5 py-0.5 text-fg">{ad.isHouse ? 'StockTank' : ad.disclosureLabel}</span>
      {ad.isHouse ? null : <span className="truncate normal-case tracking-normal">{ad.advertiserName}</span>}
    </span>
  );
}

function AdBody({ ad, variant }: { ad: ServedAd; variant: AdVariant }) {
  const linkProps = {
    href: ad.clickUrl,
    target: ad.isHouse ? undefined : '_blank',
    rel: ad.isHouse ? undefined : 'sponsored noopener noreferrer',
  };

  if (variant === 'strip') {
    return (
      <a
        {...linkProps}
        className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-hairline bg-surface px-5 py-3.5 transition-colors hover:border-hairline-strong"
      >
        <Disclosure ad={ad} />
        <span className="min-w-0 flex-1 font-display text-base font-bold">{ad.headline}</span>
        <span className="inline-flex items-center gap-1 text-sm font-bold text-primary-hi">
          {ad.ctaLabel}
          <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </a>
    );
  }

  if (variant === 'leaderboard') {
    return (
      <a
        {...linkProps}
        className="group relative flex min-h-[110px] flex-col justify-center gap-2 overflow-hidden rounded-2xl border border-hairline bg-surface px-6 py-5 transition-colors hover:border-hairline-strong md:flex-row md:items-center md:gap-8 md:px-8"
      >
        <div aria-hidden="true" className="bg-desk-grid pointer-events-none absolute inset-0 opacity-50" />
        {ad.imageUrl ? (
          <img src={ad.imageUrl} alt={ad.altText ?? ''} className="relative h-16 w-auto rounded-md object-contain" loading="lazy" />
        ) : null}
        <div className="relative flex min-w-0 flex-1 flex-col gap-1.5">
          <Disclosure ad={ad} />
          <span className="font-display text-xl font-extrabold md:text-2xl">{ad.headline}</span>
          {ad.body ? <span className="text-sm text-muted">{ad.body}</span> : null}
        </div>
        <span className="relative inline-flex h-11 shrink-0 items-center gap-1.5 self-start rounded-lg bg-gradient-primary px-5 text-sm font-bold text-on-primary md:self-center">
          {ad.ctaLabel}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </span>
      </a>
    );
  }

  const compact = variant === 'sidebar';
  return (
    <a
      {...linkProps}
      className={cn(
        'group flex h-full overflow-hidden rounded-2xl border border-hairline bg-surface transition-[transform,box-shadow] duration-300 ease-out-expo hover:-translate-y-1.5 hover:shadow-raised',
        compact ? 'flex-col' : 'flex-col sm:flex-row',
      )}
    >
      <div
        className={cn(
          'bg-desk-grid relative flex shrink-0 items-end bg-raised p-4',
          compact ? 'h-28 w-full' : 'min-h-[190px] w-full sm:w-[190px]',
        )}
      >
        {ad.imageUrl ? (
          <img src={ad.imageUrl} alt={ad.altText ?? ''} className="absolute inset-0 size-full object-cover" loading="lazy" />
        ) : (
          <span aria-hidden="true" className="font-display text-4xl font-black italic text-primary-hi">
            AD
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2.5 p-5">
        <Disclosure ad={ad} />
        <span className="font-display text-lg font-bold leading-snug">{ad.headline}</span>
        {ad.body ? <span className="text-sm text-muted">{ad.body}</span> : null}
        <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-primary-hi">
          {ad.ctaLabel}
          <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </a>
  );
}
