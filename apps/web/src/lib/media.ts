import { useEffect, type RefObject } from 'react';

let active: HTMLMediaElement | null = null;

/** Only one thing plays at a time: starting the mini player pauses an inline video and vice versa. */
export function claimPlayback(el: HTMLMediaElement): void {
  if (active && active !== el && !active.paused) active.pause();
  active = el;
}

/**
 * Attaches `src` to a media element. HLS playlists use native playback where supported (Safari, iOS) and
 * hls.js elsewhere, loaded on demand so pages without media do not pay for it.
 */
export function useMediaSource(ref: RefObject<HTMLMediaElement | null>, src: string | null, onError?: () => void): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    let cancelled = false;
    let destroy: (() => void) | null = null;

    const isHls = /\.m3u8(\?|$)/.test(src);
    if (!isHls || el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = src;
    } else {
      void import('hls.js')
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) {
            el.src = src;
            return;
          }
          const hls = new Hls({ capLevelToPlayerSize: true });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) onError?.();
          });
          hls.loadSource(src);
          hls.attachMedia(el);
          destroy = () => hls.destroy();
        })
        .catch(() => onError?.());
    }

    return () => {
      cancelled = true;
      destroy?.();
      if (active === el) active = null;
      el.removeAttribute('src');
      try {
        el.load();
      } catch {
        // jsdom and some embedded browsers do not implement load(); detaching the src is enough.
      }
    };
  }, [ref, src, onError]);
}

export function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
