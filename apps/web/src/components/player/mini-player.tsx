import { Badge, Button } from '@stocktank/ui';
import { Play, X } from 'lucide-react';
import { Link } from 'react-router';

import { usePlayer } from '../../stores/player';

const monogram = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/**
 * Persistent mini player (Concept A). It holds the item the viewer chose. Real playback (HLS/audio) arrives
 * with the media pipeline; until an item has a media URL the player says so instead of animating fake progress.
 */
export function MiniPlayer() {
  const current = usePlayer((s) => s.current);
  const close = usePlayer((s) => s.close);
  if (!current) return null;

  const playable = current.mediaUrl !== null;

  return (
    <div
      role="region"
      aria-label="Player"
      className="fixed inset-x-3 bottom-[calc(var(--spacing-bottom-nav)+0.75rem)] z-40 animate-rise-in lg:bottom-5 lg:left-[calc(var(--spacing-rail)+2rem)] lg:right-8"
    >
      <div className="flex h-[84px] items-center gap-4 rounded-2xl border border-hairline-strong bg-surface/95 px-4 shadow-raised backdrop-blur-md md:gap-5 md:px-5">
        <div className="bg-desk-grid flex size-14 shrink-0 items-center justify-center rounded-xl bg-raised font-display text-lg font-black italic text-primary-hi">
          {monogram(current.showTitle)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 md:max-w-[420px]">
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-primary-hi">
            <Link to={`/shows/${current.showSlug}`} className="truncate hover:underline">
              {current.showTitle}
            </Link>
            {current.isDemo ? <Badge variant="mono">DEMO</Badge> : null}
          </span>
          <span className="truncate text-[15px] font-semibold">{current.title}</span>
        </div>
        <Button
          size="icon"
          className="size-12 shrink-0 rounded-full"
          disabled={!playable}
          aria-label={playable ? 'Play' : 'Playback not available yet'}
          title={playable ? 'Play' : 'Playback arrives with the media pipeline'}
        >
          <Play className="size-4 fill-current" aria-hidden="true" />
        </Button>
        <p className="hidden flex-1 text-xs text-muted lg:block">
          {playable ? null : 'Audio and video playback connect when episodes are uploaded through the media pipeline.'}
        </p>
        <Button variant="ghost" size="icon" aria-label="Close player" onClick={close}>
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
