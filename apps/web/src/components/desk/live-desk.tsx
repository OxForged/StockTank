import type { LivestreamSummary } from '@stocktank/types';
import { LogoMark, cn } from '@stocktank/ui';
import { CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

const STAGE_BARS = [70, 110, 90, 140, 120, 160, 130, 180, 150, 190, 170, 200, 180, 210];

function formatStart(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * The live desk (Concept B broadcast panel). Shows the real broadcast state from the schedule. Until the live
 * stream infrastructure (Milestone 5) provides a stream URL, the stage is a branded placeholder with segments.
 */
export function LiveDesk({ live, next }: { live: LivestreamSummary | null; next: LivestreamSummary | null }) {
  const segments = live?.segments ?? [];
  // Selection is remembered per broadcast, so a new broadcast starts at its first segment.
  const [selection, setSelection] = useState<{ id: string | null; index: number }>({ id: null, index: 0 });
  const segment = selection.id === (live?.id ?? null) ? selection.index : 0;
  const setSegment = (index: number) => setSelection({ id: live?.id ?? null, index });
  const active = segments[segment];

  return (
    <section
      aria-label={live ? `On air: ${live.show?.title ?? live.title}` : 'Live desk: off air'}
      className="relative flex min-h-[420px] flex-col overflow-hidden rounded-[22px] border border-[#1b2a38] bg-[#09121b] text-[#f2f5f7] shadow-raised"
    >
      <div className="relative flex-1 overflow-hidden bg-[#050a10]">
        <div aria-hidden="true" className="bg-desk-grid absolute inset-0" />
        <LogoMark
          aria-hidden="true"
          size={360}
          className="absolute left-1/2 top-6 -ml-[180px] animate-hy-breathe text-[#f2f5f7]"
        />
        <div aria-hidden="true" className="absolute inset-x-8 bottom-0 flex h-48 items-end gap-3 opacity-20">
          {STAGE_BARS.map((h, i) => (
            <div
              key={i}
              className="flex-1 origin-bottom animate-hy-grow rounded-t bg-gradient-to-b from-[#1ef0a8] to-transparent"
              style={{ height: h, animationDelay: `${i * 0.06}s` }}
            />
          ))}
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-20 animate-hy-scan bg-gradient-to-b from-transparent via-[#1ef0a8]/10 to-transparent"
        />

        <div className="absolute left-5 top-5 flex flex-wrap gap-2.5">
          {live ? (
            <span className="flex h-7 items-center gap-2 rounded-md bg-[#ff4d5e] px-3 font-mono text-xs font-bold tracking-[0.12em] text-white">
              <span className="size-2 animate-live-pulse rounded-full bg-white" />
              ON AIR
            </span>
          ) : (
            <span className="flex h-7 items-center rounded-md border border-[#22394a] bg-[#050a10]/75 px-3 font-mono text-xs font-bold tracking-[0.12em] text-[#d5dee5]">
              OFF AIR
            </span>
          )}
          <span className="flex h-7 items-center rounded-md border border-[#22394a] bg-[#050a10]/75 px-3 font-mono text-xs tracking-[0.1em] text-[#d5dee5]">
            {live ? `${(live.show?.title ?? live.title).toUpperCase()} · LIVE DESK` : 'LIVE DESK'}
          </span>
          {live?.isDemo ? (
            <span className="flex h-7 items-center rounded-md border border-[#ffb547]/50 bg-[#050a10]/75 px-2.5 font-mono text-[10px] font-bold tracking-[0.12em] text-[#ffb547]">
              DEMO
            </span>
          ) : null}
        </div>

        {live && active ? (
          <div key={`${live.id}-${segment}`} className="absolute bottom-6 left-5 flex animate-hy-slide flex-col">
            <span className="self-start bg-[#1ef0a8] px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.12em] text-[#04110b]">
              SEGMENT {String(segment + 1).padStart(2, '0')}
            </span>
            <span className="max-w-[560px] bg-[#050a10]/90 px-4 py-3 font-display text-xl font-extrabold md:text-[28px]">{active.title}</span>
          </div>
        ) : null}

        {!live ? (
          <div className="absolute inset-x-5 bottom-6 flex animate-rise-in flex-col gap-2 rounded-xl border border-[#22394a] bg-[#050a10]/90 p-4">
            {next ? (
              <>
                <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-[#8a9aa8]">
                  <CalendarClock className="size-3.5" aria-hidden="true" />
                  NEXT BROADCAST · {formatStart(next.scheduledStart)}
                </span>
                <span className="font-display text-xl font-extrabold">{next.show?.title ?? next.title}</span>
              </>
            ) : (
              <span className="text-sm text-[#a9b7c3]">No broadcast is scheduled right now. The schedule appears here when one is.</span>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3.5 border-t border-[#1b2a38] bg-[#0b1520] px-4 py-3.5">
        {segments.length > 0 ? (
          <ol className="grid flex-1 gap-1.5" style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}>
            {segments.map((s, i) => (
              <li key={s.position}>
                <button
                  type="button"
                  onClick={() => setSegment(i)}
                  aria-current={i === segment ? 'step' : undefined}
                  aria-label={`Segment ${i + 1}: ${s.title}`}
                  title={s.title}
                  className={cn(
                    'flex h-11 w-full flex-col justify-center gap-1.5 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-[#1ef0a8]',
                    i === segment ? 'text-[#1ef0a8]' : 'text-[#8a9aa8] hover:text-[#f2f5f7]',
                  )}
                >
                  <span className="relative block h-[5px] overflow-hidden rounded-full bg-[#1b2a38]">
                    <span
                      className={cn(
                        'absolute inset-0 origin-left rounded-full bg-[#1ef0a8] transition-transform duration-500',
                        i < segment ? 'scale-x-100 opacity-50' : i === segment ? 'scale-x-100' : 'scale-x-0',
                      )}
                    />
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.1em]">{String(i + 1).padStart(2, '0')}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <span className="flex-1 font-mono text-[11px] tracking-[0.1em] text-[#8a9aa8]">SEGMENTS APPEAR WHEN A BROADCAST IS ON AIR</span>
        )}
        <div className="flex shrink-0 items-center gap-3">
          {live ? (
            <span aria-hidden="true" className="flex h-7 items-end gap-1">
              {[0, 0.15, 0.3, 0.45, 0.2, 0.35, 0.1].map((d) => (
                <span key={d} className="h-7 w-1 origin-bottom animate-hy-wave rounded-full bg-[#1ef0a8]" style={{ animationDelay: `${d}s` }} />
              ))}
            </span>
          ) : null}
          <Link to="/live" className="rounded-md px-2 py-1 font-mono text-[11px] font-bold tracking-[0.1em] text-[#1ef0a8] hover:underline">
            {live?.streamUrl ? 'WATCH LIVE →' : 'SCHEDULE →'}
          </Link>
        </div>
      </div>
    </section>
  );
}
