import { MAX_CLIP_SECONDS, PUBLISH_ONLY_STATUSES, publishStatusSchema, type AdminClip, type ClipInput, type PublishStatus } from '@stocktank/types';
import {
  Badge,
  Button,
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
import { Clapperboard, Plus, Scissors, Smartphone } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { can, describeApiError, useMe } from '../../lib/auth';
import { REVIEW_STATUS_VARIANT, formatDate, humanize } from '../../lib/format';
import { MEDIA_STATUS_VARIANT, formatSeconds } from './media-library-page';

const SELECT = 'h-10 w-full rounded-md border border-hairline-strong bg-bg px-3 text-sm text-fg focus:border-primary focus:outline-none';

/** Accepts "90", "1:30", "01:02:03" or "75.5" and returns seconds, or null when invalid. */
export function parseTimecode(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v);
  const parts = v.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

/** Round-trips exactly through parseTimecode, so saving an untouched clip never changes its cut. */
export function timecodeInput(seconds: number): string {
  const whole = Math.floor(seconds);
  const frac = Math.round((seconds - whole) * 1000) / 1000;
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  const secs = `${String(s).padStart(2, '0')}${frac ? String(frac).slice(1) : ''}`;
  return `${m}:${secs}`;
}

type Editing = { clip: AdminClip | null } | null;

function ClipDialog({ editing, onClose, canPublish }: { editing: Editing; onClose: () => void; canPublish: boolean }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const episodes = useQuery({
    queryKey: ['admin', 'content', 'episodes', 'options'],
    queryFn: () => api.admin.content.listEpisodes({ pageSize: 100 }),
    enabled: Boolean(editing),
  });
  const clip = editing?.clip ?? null;
  const save = useMutation({
    mutationFn: (input: ClipInput) => api.admin.media.saveClip(input, clip?.id),
    onSuccess: (saved) => {
      toast.success(clip ? 'Clip saved' : 'Clip created', {
        description: saved.renderStatus === null && saved.sourceEpisode.hasMedia ? 'Render it to produce vertical, square and horizontal files.' : undefined,
      });
      void qc.invalidateQueries({ queryKey: ['admin', 'media', 'clips'] });
      onClose();
    },
    onError: (err) => setError(describeApiError(err)),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const d = new FormData(e.currentTarget);
    const startTime = parseTimecode(String(d.get('start') ?? ''));
    const endTime = parseTimecode(String(d.get('end') ?? ''));
    if (startTime === null || endTime === null) {
      setError('Enter start and end as seconds or m:ss (for example 1:30).');
      return;
    }
    if (endTime <= startTime) {
      setError('The end must be after the start.');
      return;
    }
    if (endTime - startTime > MAX_CLIP_SECONDS) {
      setError(`Clips can be at most ${MAX_CLIP_SECONDS / 60} minutes.`);
      return;
    }
    save.mutate({
      sourceEpisodeId: String(d.get('episodeId') ?? ''),
      title: String(d.get('title') ?? '').trim(),
      startTime,
      endTime,
      transcript: String(d.get('transcript') ?? '').trim() || null,
      reviewStatus: d.get('reviewStatus') as PublishStatus,
    });
  }

  return (
    <Dialog open={Boolean(editing)} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent size="lg" className="max-h-[90dvh] overflow-y-auto">
        {editing ? (
          <form onSubmit={onSubmit} key={clip?.id ?? 'new'} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{clip ? 'Edit clip' : 'New clip'}</DialogTitle>
              <DialogDescription>Clips always point back to their source timestamp. Changing the cut clears rendered files.</DialogDescription>
            </DialogHeader>
            <FormField label="Source episode" htmlFor="clip-episode" required>
              {({ id }) => (
                <select id={id} name="episodeId" required defaultValue={clip?.sourceEpisode.id ?? ''} className={SELECT}>
                  <option value="" disabled>
                    Choose an episode
                  </option>
                  {(episodes.data?.items ?? []).map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.show.title} — {ep.title}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="Title" htmlFor="clip-title" required>
              {({ id }) => <Input id={id} name="title" required maxLength={200} defaultValue={clip?.title ?? ''} />}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Start" htmlFor="clip-start" hint="m:ss or seconds" required>
                {({ id }) => <Input id={id} name="start" required inputMode="decimal" className="font-mono" defaultValue={clip ? timecodeInput(clip.startTime) : ''} />}
              </FormField>
              <FormField label="End" htmlFor="clip-end" hint="m:ss or seconds" required>
                {({ id }) => <Input id={id} name="end" required inputMode="decimal" className="font-mono" defaultValue={clip ? timecodeInput(clip.endTime) : ''} />}
              </FormField>
              <FormField label="Review status" htmlFor="clip-status" hint={canPublish ? undefined : 'Publishing requires an editor'}>
                {({ id }) => (
                  <select id={id} name="reviewStatus" defaultValue={clip?.reviewStatus ?? 'draft'} className={SELECT}>
                    {publishStatusSchema.options.map((s) => (
                      <option key={s} value={s} disabled={!canPublish && PUBLISH_ONLY_STATUSES.has(s)}>
                        {humanize(s)}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            </div>
            <FormField label="Transcript excerpt" htmlFor="clip-transcript" hint="Used for captions and search. Verify quotes before publishing.">
              {({ id }) => <Textarea id={id} name="transcript" rows={4} maxLength={10_000} defaultValue={clip?.transcript ?? ''} />}
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
                {clip ? 'Save' : 'Create clip'}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RenderedLinks({ clip }: { clip: AdminClip }) {
  if (!clip.media) return null;
  const links: Array<[string, string | null]> = [
    ['16:9', clip.media.horizontalUrl],
    ['9:16', clip.media.verticalUrl],
    ['1:1', clip.media.squareUrl],
    ['MP3', clip.media.audioUrl],
  ];
  return (
    <span className="flex flex-wrap gap-1.5">
      {links
        .filter((l): l is [string, string] => Boolean(l[1]))
        .map(([label, url]) => (
          <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="rounded border border-hairline-strong px-1.5 py-0.5 font-mono text-[11px] hover:border-primary">
            {label}
          </a>
        ))}
    </span>
  );
}

/**
 * Clips (§14) and Shorts: the Shorts view lists clips with rendered vertical 9:16 files, ready for social distribution.
 */
export function ClipsPage({ mode = 'clips' }: { mode?: 'clips' | 'shorts' }) {
  const me = useMe();
  const user = me.user;
  const canWrite = can(user, 'content.write');
  const canPublish = can(user, 'content.publish');
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const reviewStatus = (params.get('status') as PublishStatus | null) ?? undefined;
  const [editing, setEditing] = useState<Editing>(null);

  const clips = useQuery({
    queryKey: ['admin', 'media', 'clips', reviewStatus ?? 'all'],
    queryFn: () => api.admin.media.listClips({ reviewStatus, pageSize: 100 }),
    refetchInterval: (query) => (query.state.data?.items.some((c) => c.renderStatus === 'uploaded' || c.renderStatus === 'processing') ? 3000 : false),
  });
  const render = useMutation({
    mutationFn: (id: string) => api.admin.media.renderClip(id),
    onSuccess: () => {
      toast.success('Render queued', { description: 'Horizontal, vertical and square versions are being produced.' });
      void qc.invalidateQueries({ queryKey: ['admin', 'media', 'clips'] });
    },
    onError: (err) => toast.error('Could not render', { description: describeApiError(err) }),
  });

  const items = (clips.data?.items ?? []).filter((c) => mode === 'clips' || Boolean(c.media?.verticalUrl));
  const Icon = mode === 'shorts' ? Smartphone : Scissors;

  return (
    <>
      <PageTitle
        kicker="Content"
        title={mode === 'shorts' ? 'Shorts' : 'Clips'}
        description={
          mode === 'shorts'
            ? 'Rendered vertical 9:16 clips ready for short-form distribution. Only published clips may be distributed.'
            : 'Cut clips from episode media, render social formats and send them through review. Only published clips appear on the site.'
        }
        action={
          canWrite && mode === 'clips' ? (
            <Button onClick={() => setEditing({ clip: null })}>
              <Plus className="size-4" aria-hidden="true" />
              New clip
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by review status">
        <Button size="sm" variant={!reviewStatus ? 'secondary' : 'ghost'} onClick={() => setParams({})}>
          All
        </Button>
        {publishStatusSchema.options.map((s) => (
          <Button key={s} size="sm" variant={reviewStatus === s ? 'secondary' : 'ghost'} onClick={() => setParams({ status: s })}>
            {humanize(s)}
          </Button>
        ))}
      </div>

      {clips.isError ? (
        <EmptyState icon={<Icon />} title="Could not load clips" description={describeApiError(clips.error)} />
      ) : clips.isPending ? (
        <Skeleton className="h-72" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={mode === 'shorts' ? <Smartphone /> : <Clapperboard />}
          title={mode === 'shorts' ? 'No rendered shorts' : 'No clips yet'}
          description={mode === 'shorts' ? 'Render a clip to produce its vertical version.' : 'Create a clip from an episode with processed media.'}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clip</TableHead>
              <TableHead>Review</TableHead>
              <TableHead>Render</TableHead>
              <TableHead className="hidden lg:table-cell">Updated</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="max-w-[360px]">
                  <p className="truncate font-semibold">
                    {c.title} {c.isDemo ? <Badge variant="mono">DEMO</Badge> : null} {c.generationModel ? <Badge variant="info">AI</Badge> : null}
                  </p>
                  <p className="truncate font-mono text-xs text-muted">
                    {formatSeconds(c.startTime)}–{formatSeconds(c.endTime)} · {c.sourceEpisode.title}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant={REVIEW_STATUS_VARIANT[c.reviewStatus]}>{humanize(c.reviewStatus)}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {c.renderStatus ? <Badge variant={MEDIA_STATUS_VARIANT[c.renderStatus]}>{humanize(c.renderStatus)}</Badge> : <span className="text-xs text-muted">Not rendered</span>}
                    {c.renderStatus === 'failed' && c.renderError ? <p className="max-w-[220px] text-xs text-danger">{c.renderError}</p> : null}
                    <RenderedLinks clip={c} />
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm text-muted lg:table-cell">{formatDate(c.updatedAt, true)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {canWrite ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!c.sourceEpisode.hasMedia || c.renderStatus === 'uploaded' || c.renderStatus === 'processing'}
                        title={c.sourceEpisode.hasMedia ? undefined : 'Upload and process the episode media first'}
                        loading={render.isPending && render.variables === c.id}
                        onClick={() => render.mutate(c.id)}
                      >
                        {c.renderStatus === 'ready' ? 'Re-render' : 'Render'}
                      </Button>
                    ) : null}
                    {canWrite ? (
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ clip: c })}>
                        Edit
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <ClipDialog editing={editing} onClose={() => setEditing(null)} canPublish={canPublish} />
    </>
  );
}

export function ShortsPage() {
  return <ClipsPage mode="shorts" />;
}
