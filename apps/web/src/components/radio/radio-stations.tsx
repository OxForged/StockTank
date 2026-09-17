import type { RadioStation } from '@stocktank/types';
import { Badge, Button, EmptyState, Skeleton } from '@stocktank/ui';
import { useQuery } from '@tanstack/react-query';
import { Headphones, Radio } from 'lucide-react';

import { api } from '../../lib/api';
import { usePlayer } from '../../stores/player';

/** Default mount first, then HLS. MP3/AAC mounts play everywhere without extra libraries. */
export function streamUrlFor(station: RadioStation): string | null {
  const np = station.nowPlaying;
  if (!np) return null;
  const mount = np.stream.mounts.find((m) => m.isDefault) ?? np.stream.mounts[0];
  return mount?.url ?? np.stream.hlsUrl;
}

export const RADIO_QUERY_KEY = ['radio', 'stations'] as const;

export function useRadioStations() {
  return useQuery({ queryKey: RADIO_QUERY_KEY, queryFn: () => api.content.radioStations(), refetchInterval: 15_000 });
}

function StationCard({ station }: { station: RadioStation }) {
  const open = usePlayer((s) => s.open);
  const np = station.nowPlaying;
  const url = streamUrlFor(station);
  const onAir = Boolean(np?.isOnline && url);
  const track = np?.current;

  return (
    <li className="flex gap-4 rounded-2xl border border-hairline bg-surface p-4">
      {track?.artUrl ? (
        <img src={track.artUrl} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="bg-desk-grid flex size-20 shrink-0 items-center justify-center rounded-xl bg-raised text-primary-hi">
          <Radio className="size-7" aria-hidden="true" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-display text-lg font-bold">{station.name}</span>
          {onAir ? <span className="font-mono text-[11px] tracking-[0.12em] text-[#ff4d5e]">● ON AIR</span> : <Badge variant="neutral">Off air</Badge>}
          {np?.live.isLive ? <Badge variant="primary">LIVE{np.live.streamerName ? ` · ${np.live.streamerName}` : ''}</Badge> : null}
          {station.isDemo ? <Badge variant="mono">DEMO</Badge> : null}
        </p>
        {np ? (
          <p className="truncate text-sm" aria-live="polite">
            {track ? (
              <>
                <span className="text-muted">Now: </span>
                <span className="font-semibold">{track.title}</span>
                {track.artist ? <span className="text-muted"> · {track.artist}</span> : null}
              </>
            ) : (
              <span className="text-muted">Nothing playing right now.</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted">This station is unavailable right now. Please check back shortly.</p>
        )}
        {station.stale ? <p className="text-xs text-muted">Showing the last update; the station feed is reconnecting.</p> : null}
        {np && np.recent.length > 0 ? (
          <p className="truncate text-xs text-muted">Earlier: {np.recent.slice(0, 3).map((t) => t.title).join(' · ')}</p>
        ) : null}
        <div className="mt-1 flex items-center gap-3">
          <Button
            size="sm"
            disabled={!onAir}
            onClick={() =>
              open({
                id: `radio:${station.id}`,
                kind: 'radio',
                title: station.name,
                showTitle: 'StockTank Radio',
                showSlug: '',
                episodeSlug: '',
                stationSlug: station.slug,
                isDemo: station.isDemo,
                media: { hlsUrl: null, audioUrl: url, posterUrl: track?.artUrl ?? null },
              })
            }
          >
            <Headphones className="size-4" aria-hidden="true" />
            Listen live
          </Button>
          {np ? <span className="font-mono text-xs text-muted">{np.listeners} listening</span> : null}
        </div>
      </div>
    </li>
  );
}

/** StockTank's own radio UI (§12). Listeners never leave for AzuraCast pages. */
export function RadioStations() {
  const q = useRadioStations();
  if (q.isPending) return <Skeleton className="h-28 rounded-2xl" />;
  if (q.isError) return <EmptyState icon={<Radio aria-hidden="true" />} title="Radio is unavailable" description="We could not load the stations. Please try again shortly." />;
  if (q.data.length === 0) return null;
  return (
    <section aria-labelledby="radio-h" className="flex flex-col gap-3">
      <h2 id="radio-h" className="font-display text-2xl font-extrabold">
        StockTank Radio
      </h2>
      <ul className="flex flex-col gap-3">
        {q.data.map((s) => (
          <StationCard key={s.id} station={s} />
        ))}
      </ul>
    </section>
  );
}
