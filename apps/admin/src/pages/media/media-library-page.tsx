import { uploadToStorage } from '@stocktank/api-client';
import { mediaStatusSchema, type AdminMediaAsset, type MediaStatus } from '@stocktank/types';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
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
  toast,
  type BadgeProps,
} from '@stocktank/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Film, RotateCcw, UploadCloud } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { can, describeApiError, useMe } from '../../lib/auth';
import { formatDate, humanize } from '../../lib/format';

const SELECT = 'h-10 w-full rounded-md border border-hairline-strong bg-bg px-3 text-sm text-fg focus:border-primary focus:outline-none';

export const MEDIA_STATUS_VARIANT: Record<MediaStatus, NonNullable<BadgeProps['variant']>> = {
  pending_upload: 'neutral',
  uploaded: 'info',
  processing: 'warning',
  ready: 'primary',
  failed: 'danger',
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

export function formatSeconds(total: number | null): string {
  if (total === null) return '—';
  const s = Math.round(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

const inFlight = (s: MediaStatus) => s === 'uploaded' || s === 'processing';

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${value}%` }} />
    </div>
  );
}

type UploadPhase = { name: string; percent: number; stage: 'reserving' | 'uploading' | 'verifying' };

function UploadCard({ accepted, maxBytes, presetEpisodeId }: { accepted: string[]; maxBytes: number; presetEpisodeId?: string }) {
  const qc = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<UploadPhase | null>(null);
  const episodes = useQuery({ queryKey: ['admin', 'content', 'episodes', 'options'], queryFn: () => api.admin.content.listEpisodes({ pageSize: 100 }) });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const input = form.elements.namedItem('file');
    const file = input instanceof HTMLInputElement ? (input.files?.[0] ?? null) : null;
    const episodeId = String(data.get('episodeId') ?? '') || undefined;
    if (!file) {
      toast.error('Choose a file to upload');
      return;
    }
    if (!accepted.includes(file.type)) {
      toast.error('Unsupported format', { description: 'Upload MP4, MOV, MP3, WAV or M4A.' });
      return;
    }
    if (file.size > maxBytes) {
      toast.error('File too large', { description: `The limit is ${formatBytes(maxBytes)}.` });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setPhase({ name: file.name, percent: 0, stage: 'reserving' });
      const { asset, upload } = await api.admin.media.startUpload({ filename: file.name, mimeType: file.type as never, sizeBytes: file.size, episodeId });
      setPhase({ name: file.name, percent: 0, stage: 'uploading' });
      await uploadToStorage(file, upload, (percent) => setPhase({ name: file.name, percent, stage: 'uploading' }), controller.signal);
      setPhase({ name: file.name, percent: 100, stage: 'verifying' });
      await api.admin.media.completeUpload(asset.id);
      toast.success('Upload complete', { description: 'Processing has started. This page updates as renditions are produced.' });
      form.reset();
      void qc.invalidateQueries({ queryKey: ['admin', 'media'] });
    } catch (err) {
      toast.error('Upload failed', { description: describeApiError(err) });
    } finally {
      abortRef.current = null;
      setPhase(null);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Upload episode media</CardTitle>
        <CardDescription>
          Files go straight to object storage, then the media worker produces adaptive HLS (1080p/720p/480p), an audio-only stream, an MP3 and a poster. When linked, the
          episode switches to the new media only after processing succeeds.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} className="grid gap-4 px-6 pb-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <FormField label="File" htmlFor="media-file" hint={`MP4, MOV, MP3, WAV or M4A · up to ${formatBytes(maxBytes)}`}>
          {({ id }) => <Input id={id} name="file" type="file" accept={accepted.join(',')} disabled={Boolean(phase)} />}
        </FormField>
        <FormField label="Episode" htmlFor="media-episode" hint="Optional. Leave empty to upload to the library only.">
          {({ id }) => (
            <select id={id} name="episodeId" defaultValue={presetEpisodeId ?? ''} className={SELECT} disabled={Boolean(phase)}>
              <option value="">No episode</option>
              {(episodes.data?.items ?? []).map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.show.title} — {ep.title}
                </option>
              ))}
            </select>
          )}
        </FormField>
        {phase ? (
          <Button type="button" variant="ghost" onClick={() => abortRef.current?.abort()} disabled={phase.stage !== 'uploading'}>
            Cancel
          </Button>
        ) : (
          <Button type="submit">
            <UploadCloud className="size-4" aria-hidden="true" />
            Upload
          </Button>
        )}
        {phase ? (
          <div className="flex flex-col gap-1.5 md:col-span-3" aria-live="polite">
            <p className="text-sm">
              <span className="font-semibold">{phase.name}</span>{' '}
              <span className="text-muted">
                {phase.stage === 'reserving' ? 'Preparing upload…' : phase.stage === 'verifying' ? 'Verifying and queueing…' : `Uploading ${phase.percent}%`}
              </span>
            </p>
            <ProgressBar value={phase.percent} label="Upload progress" />
          </div>
        ) : null}
      </form>
    </Card>
  );
}

export function MediaLibraryPage() {
  const me = useMe();
  const canWrite = can(me.user, 'content.write');
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as MediaStatus | null) ?? undefined;
  const episodeId = params.get('episodeId') ?? undefined;

  const caps = useQuery({ queryKey: ['admin', 'media', 'status'], queryFn: () => api.admin.media.status() });
  const assets = useQuery({
    queryKey: ['admin', 'media', 'assets', status ?? 'all', episodeId ?? 'any'],
    queryFn: () => api.admin.media.listAssets({ status, episodeId, pageSize: 100 }),
    // Poll while anything is processing so staff see progress without reloading.
    refetchInterval: (query) => (query.state.data?.items.some((a) => inFlight(a.status)) ? 3000 : false),
  });
  const retry = useMutation({
    mutationFn: (id: string) => api.admin.media.retry(id),
    onSuccess: () => {
      toast.success('Queued for processing again');
      void qc.invalidateQueries({ queryKey: ['admin', 'media'] });
    },
    onError: (err) => toast.error('Could not retry', { description: describeApiError(err) }),
  });

  const configured = caps.data ? caps.data.storageConfigured && caps.data.queueConfigured : null;

  return (
    <>
      <PageTitle kicker="Content" title="Videos & audio" description="Uploads, processing status and playback renditions for episodes." />

      {configured === false ? (
        <Card className="mb-6 border-warning/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
              Media pipeline not configured
            </CardTitle>
            <CardDescription>
              {!caps.data?.storageConfigured ? 'Object storage (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, MEDIA_PUBLIC_BASE_URL) is not set. ' : ''}
              {!caps.data?.queueConfigured ? 'REDIS_URL is not set, so processing jobs cannot be queued. ' : ''}
              Uploads are disabled until the API is configured and the media worker is running.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {canWrite && configured && caps.data ? <UploadCard accepted={caps.data.acceptedMimeTypes} maxBytes={caps.data.maxUploadBytes} presetEpisodeId={episodeId} /> : null}

      <div className="mb-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
        <Button size="sm" variant={!status ? 'secondary' : 'ghost'} onClick={() => setParams(episodeId ? { episodeId } : {})}>
          All
        </Button>
        {mediaStatusSchema.options.map((s) => (
          <Button key={s} size="sm" variant={status === s ? 'secondary' : 'ghost'} onClick={() => setParams({ status: s, ...(episodeId ? { episodeId } : {}) })}>
            {humanize(s)}
          </Button>
        ))}
        {episodeId ? (
          <Button size="sm" variant="outline" onClick={() => setParams(status ? { status } : {})}>
            Clear episode filter
          </Button>
        ) : null}
      </div>

      {assets.isError ? (
        <EmptyState icon={<Film />} title="Could not load media" description={describeApiError(assets.error)} />
      ) : assets.isPending ? (
        <Skeleton className="h-72" />
      ) : assets.data.items.length === 0 ? (
        <EmptyState icon={<Film />} title="No media yet" description="Uploaded videos and audio appear here with their processing status." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Details</TableHead>
              <TableHead className="hidden lg:table-cell">Uploaded</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.data.items.map((a) => (
              <AssetRow key={a.id} asset={a} canWrite={canWrite} onRetry={() => retry.mutate(a.id)} retrying={retry.isPending && retry.variables === a.id} />
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

function AssetRow({ asset: a, canWrite, onRetry, retrying }: { asset: AdminMediaAsset; canWrite: boolean; onRetry: () => void; retrying: boolean }) {
  return (
    <TableRow>
      <TableCell className="max-w-[320px]">
        <p className="truncate font-semibold" title={a.originalName}>
          {a.originalName}
        </p>
        <p className="font-mono text-xs text-muted">
          {a.kind.toUpperCase()} · {formatBytes(a.sizeBytes)}
          {a.episodeId ? ' · playing on episode' : a.targetEpisodeId ? ' · will replace episode media' : ''}
        </p>
      </TableCell>
      <TableCell className="min-w-[150px]">
        <div className="flex flex-col gap-1.5">
          <Badge variant={MEDIA_STATUS_VARIANT[a.status]}>{humanize(a.status)}</Badge>
          {inFlight(a.status) ? <ProgressBar value={a.progress} label={`Processing ${a.originalName}`} /> : null}
          {a.status === 'failed' && a.error ? <p className="max-w-[260px] text-xs text-danger">{a.error}</p> : null}
        </div>
      </TableCell>
      <TableCell className="hidden font-mono text-xs text-muted md:table-cell">
        {formatSeconds(a.durationSeconds)}
        {a.height ? ` · ${a.width}×${a.height}` : ''}
        {a.attempts > 1 ? ` · attempt ${a.attempts}` : ''}
      </TableCell>
      <TableCell className="hidden text-sm text-muted lg:table-cell">{formatDate(a.createdAt, true)}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {a.playback?.hlsUrl || a.playback?.audioUrl ? (
            <Button asChild size="sm" variant="ghost">
              <a href={a.playback.hlsUrl ?? a.playback.audioUrl ?? '#'} target="_blank" rel="noopener noreferrer">
                {a.playback.hlsUrl ? 'HLS' : 'MP3'}
              </a>
            </Button>
          ) : null}
          {canWrite && a.status === 'failed' ? (
            <Button size="sm" variant="outline" onClick={onRetry} loading={retrying}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Retry
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
