import { Badge, Button } from '@stocktank/ui';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Pause, Play, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { createPlaybackTracker } from '../../lib/analytics';
import { api } from '../../lib/api';
import { claimPlayback, formatClock, useMediaSource } from '../../lib/media';
import { usePlayer, type PlayerItem, type PlayerMedia } from '../../stores/player';

const monogram = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

interface Resolved {
  media: PlayerMedia | null;
  startAt?: number;
  endAt?: number;
}

/** Finds playable media for an item opened from a list that did not carry media URLs. */
function useResolvedMedia(item: PlayerItem): { resolved: Resolved | null; loading: boolean } {
  const needsLookup = item.media === undefined && item.kind !== 'radio';
  const q = useQuery({
    queryKey: ['episode', item.showSlug, item.episodeSlug],
    queryFn: () => api.content.episode(item.showSlug, item.episodeSlug),
    enabled: needsLookup,
    staleTime: 60_000,
    retry: false,
  });
  if (!needsLookup) return { resolved: { media: item.media ?? null, startAt: item.startAt, endAt: item.endAt }, loading: false };
  if (q.isPending) return { resolved: null, loading: true };
  const data = q.data;
  if (!data) return { resolved: { media: null }, loading: false };
  if (item.kind === 'clip') {
    const clip = data.clips.find((c) => c.id === item.id);
    if (clip?.media?.audioUrl) return { resolved: { media: { hlsUrl: null, audioUrl: clip.media.audioUrl, posterUrl: clip.media.thumbnailUrl } }, loading: false };
    // Unrendered clip: play its exact range from the episode.
    if (clip && data.media) return { resolved: { media: data.media, startAt: clip.startTime, endAt: clip.endTime }, loading: false };
    return { resolved: { media: null }, loading: false };
  }
  return { resolved: { media: data.media }, loading: false };
}

/**
 * Persistent mini player (Concept A): listen mode that keeps playing while the viewer browses.
 * Video episodes play their audio here; the episode page has the full video player.
 */
export function MiniPlayer() {
  const current = usePlayer((s) => s.current);
  if (!current) return null;
  // Keyed so switching items resets playback state cleanly.
  return <MiniPlayerBar key={`${current.kind}:${current.id}`} item={current} />;
}

function MiniPlayerBar({ item }: { item: PlayerItem }) {
  const close = usePlayer((s) => s.close);
  const { resolved, loading } = useResolvedMedia(item);
  const isRadio = item.kind === 'radio';
  const station = useQuery({
    queryKey: ['radio', 'station', item.stationSlug],
    queryFn: () => api.content.radioStation(item.stationSlug!),
    enabled: isRadio && Boolean(item.stationSlug),
    refetchInterval: 15_000,
  });
  const nowTrack = isRadio ? station.data?.nowPlaying?.current : null;
  const audioRef = useRef<HTMLAudioElement>(null);
  // One tracker per item (the bar is keyed by item), created lazily on first use.
  const tracker = useRef<ReturnType<typeof createPlaybackTracker> | null>(null);
  const tracked = () =>
    (tracker.current ??= createPlaybackTracker({
      entityType: item.kind,
      entityId: item.kind === 'radio' ? item.id.replace(/^radio:/, '') : item.id,
      mediaKind: item.kind === 'radio' ? 'radio' : 'audio',
    }));
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  const src = resolved?.media ? (resolved.media.audioUrl ?? resolved.media.hlsUrl) : null;
  const onError = useCallback(() => setFailed(true), []);
  useMediaSource(audioRef, src, onError);

  const startAt = resolved?.startAt ?? 0;
  const endAt = resolved?.endAt;

  // The viewer pressed play to open this item, so start as soon as media is attached.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !src) return;
    const start = () => {
      if (startAt > 0) el.currentTime = startAt;
      claimPlayback(el);
      el.play().catch(() => setPlaying(false));
    };
    el.addEventListener('loadedmetadata', start, { once: true });
    return () => el.removeEventListener('loadedmetadata', start);
  }, [src, startAt]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      claimPlayback(el);
      // A live stream resumes at the live edge, not where it was paused.
      if (isRadio && src) el.src = src;
      el.play().catch(() => setFailed(true));
    } else {
      el.pause();
    }
  };

  const playable = Boolean(src) && !failed;
  const rangeStart = startAt;
  const rangeEnd = endAt ?? duration;
  const label = loading ? 'Loading media' : playable ? (playing ? 'Pause' : 'Play') : failed ? 'Playback failed' : 'Playback not available yet';

  return (
    <div
      role="region"
      aria-label="Player"
      className="fixed inset-x-3 bottom-[calc(var(--spacing-bottom-nav)+0.75rem)] z-40 animate-rise-in lg:bottom-5 lg:left-[calc(var(--spacing-rail)+2rem)] lg:right-8"
    >
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={(e) => {
          setPlaying(true);
          tracked().onPlay(e.currentTarget.currentTime);
        }}
        onPause={() => {
          setPlaying(false);
          tracked().onPause();
        }}
        onEnded={() => {
          setPlaying(false);
          tracked().onComplete();
        }}
        onError={() => setFailed(true)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setTime(t);
          tracked().onTimeUpdate(t);
          if (endAt !== undefined && t >= endAt) {
            e.currentTarget.pause();
            tracked().onComplete();
          }
        }}
      />
      <div className="flex h-[84px] items-center gap-4 rounded-2xl border border-hairline-strong bg-surface/95 px-4 shadow-raised backdrop-blur-md md:gap-5 md:px-5">
        {resolved?.media?.posterUrl ? (
          <img src={resolved.media.posterUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="bg-desk-grid flex size-14 shrink-0 items-center justify-center rounded-xl bg-raised font-display text-lg font-black italic text-primary-hi">
            {monogram(item.showTitle)}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1 md:max-w-[420px]">
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-primary-hi">
            {isRadio ? (
              <span className="truncate">{item.showTitle}</span>
            ) : (
              <Link to={`/shows/${item.showSlug}`} className="truncate hover:underline">
                {item.showTitle}
              </Link>
            )}
            {item.kind === 'clip' ? <Badge variant="mono">CLIP</Badge> : null}
            {isRadio ? <span className="text-[#ff4d5e]">● LIVE</span> : null}
            {item.isDemo ? <Badge variant="mono">DEMO</Badge> : null}
          </span>
          <Link to={isRadio ? '/live' : `/shows/${item.showSlug}/${item.episodeSlug}`} className="truncate text-[15px] font-semibold hover:underline">
            {item.title}
          </Link>
          {nowTrack ? (
            <span className="truncate text-xs text-muted" aria-live="polite">
              {nowTrack.title}
              {nowTrack.artist ? ` · ${nowTrack.artist}` : ''}
            </span>
          ) : null}
        </div>
        <Button size="icon" className="size-12 shrink-0 rounded-full" disabled={!playable} aria-label={label} title={label} onClick={toggle}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : playing ? (
            <Pause className="size-4 fill-current" aria-hidden="true" />
          ) : (
            <Play className="size-4 fill-current" aria-hidden="true" />
          )}
        </Button>
        {playable && isRadio ? (
          <p className="hidden flex-1 font-mono text-xs text-muted lg:block">
            {station.data?.nowPlaying ? `${station.data.nowPlaying.listeners} listening` : 'Live stream'}
          </p>
        ) : playable ? (
          <div className="hidden flex-1 items-center gap-3 lg:flex">
            <span className="w-12 text-right font-mono text-xs tabular-nums text-muted">{formatClock(Math.max(0, time - rangeStart))}</span>
            <input
              type="range"
              aria-label="Seek"
              min={rangeStart}
              max={rangeEnd || rangeStart + 1}
              step={1}
              value={Math.min(Math.max(time, rangeStart), rangeEnd || rangeStart + 1)}
              onChange={(e) => {
                if (audioRef.current) audioRef.current.currentTime = Number(e.target.value);
              }}
              className="h-1 flex-1 cursor-pointer accent-[var(--color-primary)]"
            />
            <span className="w-12 font-mono text-xs tabular-nums text-muted">{rangeEnd ? formatClock(rangeEnd - rangeStart) : '--:--'}</span>
          </div>
        ) : (
          <p className="hidden flex-1 text-xs text-muted lg:block">
            {loading ? 'Loading media…' : failed ? 'This media could not be loaded. Try again shortly.' : 'This episode has no uploaded media yet.'}
          </p>
        )}
        <Button variant="ghost" size="icon" aria-label="Close player" onClick={close}>
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
