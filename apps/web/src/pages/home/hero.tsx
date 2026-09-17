import type { ShowSummary } from '@stocktank/types';
import { Button, cn } from '@stocktank/ui';
import { Play, Plus, Check } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useWatchlist } from '../../stores/watchlist';

const ROTATE_MS = 7000;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Concept A editorial hero: rotating featured shows with progress indicators. Pauses on hover and focus. */
export function FeaturedHero({ shows, liveShowSlug }: { shows: ShowSummary[]; liveShowSlug: string | null }) {
  const slides = shows.slice(0, 3);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const has = useWatchlist((s) => s.ids);
  const toggle = useWatchlist((s) => s.toggle);

  const restart = useCallback(() => {
    window.clearInterval(timer.current);
    if (slides.length < 2 || paused || prefersReducedMotion()) return;
    timer.current = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS);
  }, [slides.length, paused]);

  useEffect(() => {
    restart();
    return () => window.clearInterval(timer.current);
  }, [restart]);

  if (slides.length === 0) {
    return (
      <div className="flex flex-col justify-center gap-6">
        <span className="font-mono text-xs tracking-[0.14em] text-muted">ON-CHAIN STOCKS &amp; CRYPTO</span>
        <h2 className="font-display text-5xl font-black italic leading-[0.98] tracking-tight md:text-[66px]">
          Media for the
          <br />
          on-chain markets.
        </h2>
        <p className="text-lg text-muted">
          Shows, live desks, clips and explainers on tokenized stocks and crypto. The first shows publish soon.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/signup">Join free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/newsletter">Get the newsletter</Link>
          </Button>
        </div>
      </div>
    );
  }

  const current = slides[Math.min(index, slides.length - 1)]!;
  const isLive = liveShowSlug === current.slug;
  const following = has.includes(`show:${current.id}`);
  const headline = current.tagline ?? current.title;

  return (
    <div
      className="flex min-h-[420px] flex-col justify-between gap-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured shows"
    >
      <div key={current.id} className="flex flex-col gap-6" aria-live={paused ? 'polite' : 'off'}>
        <div className="flex animate-rise-in flex-wrap items-center gap-3">
          <span
            className={cn(
              'flex h-7 items-center gap-2 rounded-md px-3 font-mono text-xs font-bold tracking-[0.12em]',
              isLive ? 'bg-[#ff4d5e] text-white' : 'bg-primary-soft text-primary-hi',
            )}
          >
            {isLive ? <span className="size-2 animate-live-pulse rounded-full bg-white" /> : null}
            {isLive ? 'LIVE NOW' : 'ORIGINAL SERIES'}
          </span>
          <span className="font-mono text-xs tracking-[0.14em] text-muted">{current.title.toUpperCase()}</span>
          {current.isDemo ? <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-warning">DEMO</span> : null}
        </div>
        <h2
          className={cn(
            'animate-rise-in font-display font-black italic leading-[0.98] tracking-tight [animation-delay:100ms]',
            // The design uses short statements; longer taglines step down so the hero keeps its shape.
            headline.length > 60
              ? 'text-[34px] md:text-[42px] xl:text-[46px]'
              : headline.length > 36
                ? 'text-[40px] md:text-[50px] xl:text-[56px]'
                : 'text-[44px] md:text-[60px] xl:text-[66px]',
          )}
        >
          {headline}
        </h2>
        {current.description ? (
          <p className="animate-rise-in text-lg leading-relaxed text-muted [animation-delay:200ms]">{current.description}</p>
        ) : null}
        <div className="flex animate-rise-in flex-wrap gap-3 [animation-delay:300ms]">
          <Button asChild size="lg" className="h-[52px] gap-2.5 px-6">
            <Link to={isLive ? '/live' : `/shows/${current.slug}`}>
              <Play className="size-4 fill-current" aria-hidden="true" />
              {isLive ? 'Join the live desk' : 'Start watching'}
            </Link>
          </Button>
          <Button
            size="lg"
            variant={following ? 'secondary' : 'outline'}
            className={cn('h-[52px] gap-2', following && 'text-primary-hi')}
            aria-pressed={following}
            onClick={() => toggle(`show:${current.id}`)}
          >
            {following ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {following ? `Following ${current.title}` : `Follow ${current.title}`}
          </Button>
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: `repeat(${slides.length}, minmax(0, 1fr))` }}>
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setIndex(i);
                restart();
              }}
              aria-label={`Show feature ${i + 1}: ${s.title}`}
              aria-current={i === index ? 'true' : undefined}
              className={cn('flex flex-col gap-2.5 text-left', i === index ? 'text-fg' : 'text-muted hover:text-fg')}
            >
              <span className="relative block h-[3px] overflow-hidden rounded-full bg-hairline">
                {i === index ? (
                  <span
                    key={`${s.id}-${index}-${paused}`}
                    className={cn('absolute inset-0 origin-left bg-primary-hi', paused ? 'scale-x-100 opacity-60' : 'animate-hy-fill')}
                  />
                ) : null}
              </span>
              <span className="font-mono text-[11px] tracking-[0.1em]">
                {String(i + 1).padStart(2, '0')} · {s.title}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
