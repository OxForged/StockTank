import { publishStatusSchema, type AdminRadioStation, type PublishStatus, type RadioStationInput } from '@stocktank/types';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  toast,
} from '@stocktank/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, Radio } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { describeApiError } from '../../lib/auth';
import { REVIEW_STATUS_VARIANT, formatDate, humanize } from '../../lib/format';

const SELECT = 'h-10 w-full rounded-md border border-hairline-strong bg-bg px-3 text-sm text-fg focus:border-primary focus:outline-none';

function SetupNotice() {
  const status = useQuery({ queryKey: ['admin', 'radio', 'status'], queryFn: () => api.admin.radio.status() });
  if (!status.data || (status.data.azuracastConfigured && status.data.apiKeyConfigured)) return null;
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
          AzuraCast setup
        </CardTitle>
        <CardDescription>
          {!status.data.azuracastConfigured
            ? 'Set AZURACAST_URL on the API to show now playing and live streams. Stations can be prepared now and go live once it is set.'
            : 'Set AZURACAST_API_KEY to see station health (backend/frontend status) and playlists. Now playing works without it.'}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function StationDialog({ editing, onClose }: { editing: { station: AdminRadioStation | null } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const station = editing?.station ?? null;
  const azura = useQuery({ queryKey: ['admin', 'radio', 'azuracast'], queryFn: () => api.admin.radio.azuracastStations(), enabled: Boolean(editing), retry: false });
  const save = useMutation({
    mutationFn: (input: RadioStationInput) => api.admin.radio.saveStation(input, station?.id),
    onSuccess: () => {
      toast.success(station ? 'Station saved' : 'Station created');
      void qc.invalidateQueries({ queryKey: ['admin', 'radio'] });
      onClose();
    },
    onError: (err) => setError(describeApiError(err)),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const d = new FormData(e.currentTarget);
    save.mutate({
      name: String(d.get('name') ?? '').trim(),
      slug: String(d.get('slug') ?? '').trim() || undefined,
      description: String(d.get('description') ?? '').trim() || null,
      azuracastShortcode: String(d.get('azuracastShortcode') ?? '').trim(),
      status: d.get('status') as PublishStatus,
      sortOrder: Number(d.get('sortOrder') ?? 0) || 0,
    });
  }

  const options = azura.data ?? [];
  return (
    <Dialog open={Boolean(editing)} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent size="lg" className="max-h-[90dvh] overflow-y-auto">
        {editing ? (
          <form onSubmit={onSubmit} key={station?.id ?? 'new'} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{station ? `Edit ${station.name}` : 'New station'}</DialogTitle>
              <DialogDescription>Listeners use StockTank’s player; the AzuraCast station supplies the stream and now playing.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Name" htmlFor="st-name" required>
                {({ id }) => <Input id={id} name="name" required minLength={2} maxLength={120} defaultValue={station?.name ?? ''} />}
              </FormField>
              <FormField label="Slug" htmlFor="st-slug" hint="Generated from the name when empty">
                {({ id }) => <Input id={id} name="slug" className="font-mono" defaultValue={station?.slug ?? ''} />}
              </FormField>
              <FormField label="AzuraCast station" htmlFor="st-shortcode" required hint={azura.isError ? describeApiError(azura.error) : undefined}>
                {({ id }) =>
                  options.length > 0 ? (
                    <select id={id} name="azuracastShortcode" required defaultValue={station?.azuracastShortcode ?? ''} className={SELECT}>
                      <option value="" disabled>
                        Choose a station
                      </option>
                      {options.map((o) => (
                        <option key={o.shortcode} value={o.shortcode}>
                          {o.name} ({o.shortcode})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input id={id} name="azuracastShortcode" required className="font-mono" placeholder="stocktank_radio" defaultValue={station?.azuracastShortcode ?? ''} />
                  )
                }
              </FormField>
              <FormField label="Status" htmlFor="st-status">
                {({ id }) => (
                  <select id={id} name="status" defaultValue={station?.status ?? 'draft'} className={SELECT}>
                    {publishStatusSchema.options.map((s) => (
                      <option key={s} value={s}>
                        {humanize(s)}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField label="Sort order" htmlFor="st-sort">
                {({ id }) => <Input id={id} name="sortOrder" type="number" min={0} defaultValue={station?.sortOrder ?? 0} />}
              </FormField>
            </div>
            <FormField label="Description" htmlFor="st-description">
              {({ id }) => <Textarea id={id} name="description" rows={3} maxLength={2000} defaultValue={station?.description ?? ''} />}
            </FormField>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={save.isPending}>
                {station ? 'Save' : 'Create station'}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function StationsPage() {
  const [editing, setEditing] = useState<{ station: AdminRadioStation | null } | null>(null);
  const stations = useQuery({ queryKey: ['admin', 'radio', 'stations'], queryFn: () => api.admin.radio.listStations() });

  return (
    <>
      <PageTitle
        kicker="Live"
        title="Radio stations"
        description="StockTank radio stations powered by AzuraCast. Published stations appear on /live with StockTank’s own player."
        action={
          <Button onClick={() => setEditing({ station: null })}>
            <Plus className="size-4" aria-hidden="true" />
            New station
          </Button>
        }
      />
      <SetupNotice />
      {stations.isError ? (
        <EmptyState icon={<Radio />} title="Could not load stations" description={describeApiError(stations.error)} />
      ) : stations.isPending ? (
        <Skeleton className="h-60" />
      ) : stations.data.length === 0 ? (
        <EmptyState icon={<Radio />} title="No stations yet" description="Add a station and link it to its AzuraCast shortcode." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Station</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>On air</TableHead>
              <TableHead className="hidden lg:table-cell">Updated</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stations.data.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <p className="font-semibold">
                    {s.name} {s.isDemo ? <Badge variant="mono">DEMO</Badge> : null}
                  </p>
                  <p className="font-mono text-xs text-muted">
                    /{s.slug} · {s.azuracastShortcode}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant={REVIEW_STATUS_VARIANT[s.status]}>{humanize(s.status)}</Badge>
                </TableCell>
                <TableCell>
                  {s.nowPlaying ? (
                    <span className="flex flex-col text-sm">
                      <span>{s.nowPlaying.isOnline ? <span className="text-[#ff4d5e]">● Online</span> : 'Offline'} · {s.nowPlaying.listeners} listening</span>
                      {s.nowPlaying.current ? <span className="truncate text-xs text-muted">{s.nowPlaying.current.title}</span> : null}
                    </span>
                  ) : (
                    <span className="text-xs text-danger">{s.error ?? 'Unavailable'}</span>
                  )}
                </TableCell>
                <TableCell className="hidden text-sm text-muted lg:table-cell">{formatDate(s.updatedAt, true)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ station: s })}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <StationDialog editing={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function StationHealth({ station }: { station: AdminRadioStation }) {
  const detail = useQuery({ queryKey: ['admin', 'radio', 'station', station.id], queryFn: () => api.admin.radio.station(station.id), refetchInterval: 15_000 });
  const d = detail.data;
  const np = d?.station.nowPlaying ?? station.nowPlaying;
  return (
    <Card>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-lg font-bold">{station.name}</p>
          <span className="flex flex-wrap gap-2">
            {np ? <Badge variant={np.isOnline ? 'primary' : 'neutral'}>{np.isOnline ? 'Online' : 'Offline'}</Badge> : <Badge variant="danger">Unavailable</Badge>}
            {d?.status ? (
              <>
                <Badge variant={d.status.backendRunning ? 'primary' : 'danger'}>AutoDJ {d.status.backendRunning ? 'running' : 'stopped'}</Badge>
                <Badge variant={d.status.frontendRunning ? 'primary' : 'danger'}>Stream {d.status.frontendRunning ? 'running' : 'stopped'}</Badge>
              </>
            ) : null}
          </span>
        </div>
        {np ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted">Now playing</dt>
              <dd className="font-semibold">{np.current ? `${np.current.title}${np.current.artist ? ` · ${np.current.artist}` : ''}` : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Up next</dt>
              <dd>{np.next?.title ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Listeners</dt>
              <dd className="font-mono">{np.listeners}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Live DJ</dt>
              <dd>{np.live.isLive ? (np.live.streamerName ?? 'Live') : 'AutoDJ'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Recent</dt>
              <dd className="truncate">{np.recent.length ? np.recent.map((t) => t.title).join(' · ') : '—'}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-danger">{station.error ?? 'Now playing is unavailable.'}</p>
        )}
        {d?.managementError ? <p className="text-xs text-muted">Station management: {d.managementError}</p> : null}
        {d && d.playlists.length > 0 ? (
          <p className="text-xs text-muted">
            Playlists: {d.playlists.map((p) => `${p.name}${p.isEnabled ? '' : ' (off)'}${p.songCount !== null ? ` · ${p.songCount}` : ''}`).join(' | ')}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

export function NowPlayingPage() {
  const stations = useQuery({ queryKey: ['admin', 'radio', 'stations'], queryFn: () => api.admin.radio.listStations(), refetchInterval: 15_000 });
  return (
    <>
      <PageTitle kicker="Live" title="Now playing" description="Station health, listeners and what is on air. Refreshes every 15 seconds." />
      <SetupNotice />
      {stations.isError ? (
        <EmptyState icon={<Radio />} title="Could not load stations" description={describeApiError(stations.error)} />
      ) : stations.isPending ? (
        <Skeleton className="h-60" />
      ) : stations.data.length === 0 ? (
        <EmptyState icon={<Radio />} title="No stations yet" description="Add a station under Live → Stations." />
      ) : (
        <div className="flex flex-col gap-4">
          {stations.data.map((s) => (
            <StationHealth key={s.id} station={s} />
          ))}
        </div>
      )}
    </>
  );
}
