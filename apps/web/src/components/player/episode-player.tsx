import type { EpisodeMedia } from '@stocktank/types';
import { useCallback, useRef, useState } from 'react';

import { claimPlayback, useMediaSource } from '../../lib/media';

/**
 * Inline episode player. Video uses adaptive HLS (hls.js where the browser lacks native HLS) with native controls
 * for keyboard and screen reader support. Audio-only episodes are played through the mini player instead.
 */
export function EpisodeVideoPlayer({ media, title }: { media: EpisodeMedia; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);
  useMediaSource(ref, media.hlsUrl, onError);

  if (!media.hlsUrl) return null;
  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-2xl border border-hairline bg-black shadow-raised">
        <video
          ref={ref}
          controls
          playsInline
          preload="metadata"
          poster={media.posterUrl ?? undefined}
          aria-label={`Video: ${title}`}
          className="aspect-video w-full bg-black"
          onPlay={(e) => claimPlayback(e.currentTarget)}
          onError={() => setFailed(true)}
        />
      </div>
      {failed ? (
        <figcaption role="alert" className="text-sm text-danger">
          The video could not be loaded. Try again shortly, or listen in the player below.
        </figcaption>
      ) : null}
    </figure>
  );
}
