import { PODCAST_CATEGORIES, podcastEpisodeTypeSchema, type AdminPodcastEpisode, type AdminPodcastShow, type PodcastCategory, type PodcastEpisodeType } from '@stocktank/types';
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
  toast,
} from '@stocktank/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Copy, ExternalLink, Rss, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { can, describeApiError, useMe } from '../../lib/auth';
import { REVIEW_STATUS_VARIANT, formatDate, humanize } from '../../lib/format';

const SELECT = 'h-10 w-full rounded-md border border-hairline-strong bg-bg px-3 text-sm text-fg focus:border-primary focus:outline-none';
const CATEGORY_NAMES = Object.keys(PODCAST_CATEGORIES) as PodcastCategory[];

function SettingsDialog({ show, onClose, castopodConfigured }: { show: AdminPodcastShow | null; onClose: () => void; castopodConfigured: boolean }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>(show?.podcastCategory ?? '');
  const [error, setError] = useState<string | null>(null);
  const castopod = useQuery({ queryKey: ['admin', 'podcasts', 'castopod'], queryFn: () => api.admin.podcasts.castopodPodcasts(), enabled: Boolean(show) && castopodConfigured, retry: false });
  const save = useMutation({
    mutationFn: (input: Parameters<typeof api.admin.podcasts.saveShow>[1]) => api.admin.podcasts.saveShow(show!.id, input),
    onSuccess: (saved) => {
      toast.success('Podcast settings saved', { description: saved.feedUrl ? 'The feed is live.' : undefined });
      void qc.invalidateQueries({ queryKey: ['admin', 'podcasts'] });
      onClose();
    },
    onError: (err) => setError(describeApiError(err)),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const d = new FormData(e.currentTarget);
    const castopodId = String(d.get('castopodPodcastId') ?? '');
    save.mutate({
      podcastEnabled: d.get('podcastEnabled') === 'on',
      podcastAuthor: String(d.get('podcastAuthor') ?? '').trim() || null,
      podcastCategory: (String(d.get('podcastCategory') ?? '') || null) as PodcastCategory | null,
      podcastSubcategory: String(d.get('podcastSubcategory') ?? '') || null,
      podcastExplicit: d.get('podcastExplicit') === 'on',
      podcastLanguage: String(d.get('podcastLanguage') ?? 'en').trim() || 'en',
      castopodPodcastId: castopodId ? Number(castopodId) : null,
    });
  }

  const subcategories: readonly string[] = category ? PODCAST_CATEGORIES[category as PodcastCategory] : [];

  return (
    <Dialog open={Boolean(show)} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent size="lg" className="max-h-[90dvh] overflow-y-auto">
        {show ? (
          <form onSubmit={onSubmit} key={show.id} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{show.title}: podcast settings</DialogTitle>
              <DialogDescription>StockTank serves the feed. Linking Castopod is optional and lets you push episodes to a Castopod-hosted podcast.</DialogDescription>
            </DialogHeader>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="podcastEnabled" defaultChecked={show.podcastEnabled} className="size-4 accent-[var(--color-primary)]" />
              Publish a podcast feed for this show
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Category" htmlFor="pod-category" hint="Required to enable the feed">
                {({ id }) => (
                  <select id={id} name="podcastCategory" value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT}>
                    <option value="">Choose…</option>
                    {CATEGORY_NAMES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField label="Subcategory" htmlFor="pod-subcategory">
                {({ id }) => (
                  <select id={id} name="podcastSubcategory" key={category} defaultValue={category === show.podcastCategory ? (show.podcastSubcategory ?? '') : ''} className={SELECT} disabled={subcategories.length === 0}>
                    <option value="">None</option>
                    {subcategories.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField label="Author" htmlFor="pod-author" hint="Shown in podcast apps">
                {({ id }) => <Input id={id} name="podcastAuthor" maxLength={120} defaultValue={show.podcastAuthor ?? ''} />}
              </FormField>
              <FormField label="Language" htmlFor="pod-language" hint="e.g. en or en-US">
                {({ id }) => <Input id={id} name="podcastLanguage" defaultValue={show.podcastLanguage} className="font-mono" />}
              </FormField>
              <FormField
                label="Castopod podcast"
                htmlFor="pod-castopod"
                hint={castopodConfigured ? (castopod.isError ? describeApiError(castopod.error) : 'Create the podcast in Castopod first') : 'Castopod is not configured on the API'}
              >
                {({ id }) => (
                  <select id={id} name="castopodPodcastId" defaultValue={show.castopodPodcastId ?? ''} className={SELECT} disabled={!castopodConfigured}>
                    <option value="">Not linked</option>
                    {show.castopodPodcastId !== null && !castopod.data?.some((p) => p.id === show.castopodPodcastId) ? (
                      <option value={show.castopodPodcastId}>Podcast #{show.castopodPodcastId}</option>
                    ) : null}
                    {(castopod.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} (@{p.handle})
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" name="podcastExplicit" defaultChecked={show.podcastExplicit} className="size-4 accent-[var(--color-primary)]" />
                Explicit content
              </label>
            </div>
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
                Save
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const SYNC_VARIANT = { queued: 'info', syncing: 'warning', synced: 'primary', failed: 'danger' } as const;

function EpisodesTable({ show, canPublish, castopodConfigured }: { show: AdminPodcastShow; canPublish: boolean; castopodConfigured: boolean }) {
  const qc = useQueryClient();
  const episodes = useQuery({
    queryKey: ['admin', 'podcasts', 'episodes', show.id],
    queryFn: () => api.admin.podcasts.listEpisodes(show.id),
    refetchInterval: (q) => (q.state.data?.some((e) => e.podcastSyncStatus === 'queued' || e.podcastSyncStatus === 'syncing') ? 3000 : false),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin', 'podcasts'] });
  const setType = useMutation({
    mutationFn: ({ id, type }: { id: string; type: PodcastEpisodeType }) => api.admin.podcasts.setEpisodeType(id, type),
    onSuccess: refresh,
    onError: (err) => toast.error('Could not update episode type', { description: describeApiError(err) }),
  });
  const send = useMutation({
    mutationFn: (id: string) => api.admin.podcasts.sendToCastopod(id),
    onSuccess: () => {
      toast.success('Queued for Castopod', { description: 'The MP3 is uploaded and published by the media worker.' });
      refresh();
    },
    onError: (err) => toast.error('Could not send to Castopod', { description: describeApiError(err) }),
  });

  if (episodes.isPending) return <Skeleton className="h-32" />;
  if (episodes.isError) return <p className="text-sm text-danger">{describeApiError(episodes.error)}</p>;
  if (episodes.data.length === 0) return <p className="text-sm text-muted">No episodes yet.</p>;

  const castopodDisabledReason = (e: AdminPodcastEpisode): string | null => {
    if (!castopodConfigured) return 'Castopod is not configured';
    if (show.castopodPodcastId === null) return 'Link a Castopod podcast in settings';
    if (e.castopodEpisodeId !== null) return 'Already on Castopod';
    if (!e.inFeed) return 'Needs to be published with processed audio';
    if (e.podcastSyncStatus === 'queued' || e.podcastSyncStatus === 'syncing') return 'Sync in progress';
    return null;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Episode</TableHead>
          <TableHead>Feed</TableHead>
          <TableHead className="hidden md:table-cell">Type</TableHead>
          <TableHead>Castopod</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {episodes.data.map((e) => {
          const reason = castopodDisabledReason(e);
          return (
            <TableRow key={e.id}>
              <TableCell className="max-w-[320px]">
                <p className="truncate font-semibold">
                  {e.number !== null ? `#${e.number} ` : ''}
                  {e.title}
                </p>
                <p className="font-mono text-xs text-muted">
                  <Badge variant={REVIEW_STATUS_VARIANT[e.status]}>{humanize(e.status)}</Badge> {e.publishedAt ? formatDate(e.publishedAt) : ''}
                </p>
              </TableCell>
              <TableCell>
                {e.inFeed ? <Badge variant="primary">In feed</Badge> : <Badge variant="neutral">{e.hasAudio ? 'Not published' : 'No audio'}</Badge>}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <label className="sr-only" htmlFor={`type-${e.id}`}>
                  Episode type for {e.title}
                </label>
                <select
                  id={`type-${e.id}`}
                  value={e.episodeType}
                  disabled={!canPublish || setType.isPending}
                  onChange={(ev) => setType.mutate({ id: e.id, type: ev.target.value as PodcastEpisodeType })}
                  className={`${SELECT} h-8 w-28`}
                >
                  {podcastEpisodeTypeSchema.options.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  {e.podcastSyncStatus ? <Badge variant={SYNC_VARIANT[e.podcastSyncStatus]}>{e.podcastSyncStatus}</Badge> : null}
                  {e.podcastSyncError ? <p className="max-w-[260px] text-xs text-danger">{e.podcastSyncError}</p> : null}
                  {canPublish && e.castopodEpisodeId === null ? (
                    <Button size="sm" variant="outline" disabled={Boolean(reason)} title={reason ?? undefined} loading={send.isPending && send.variables === e.id} onClick={() => send.mutate(e.id)}>
                      <Send className="size-3.5" aria-hidden="true" />
                      {e.podcastSyncStatus === 'failed' ? 'Retry' : 'Send'}
                    </Button>
                  ) : null}
                  {e.castopodEpisodeId !== null ? <span className="font-mono text-xs text-muted">Castopod #{e.castopodEpisodeId}</span> : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function PodcastsPage() {
  const me = useMe();
  const canPublish = can(me.user, 'distribution.publish');
  const [editing, setEditing] = useState<AdminPodcastShow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const status = useQuery({ queryKey: ['admin', 'podcasts', 'status'], queryFn: () => api.admin.podcasts.status() });
  const shows = useQuery({ queryKey: ['admin', 'podcasts', 'shows'], queryFn: () => api.admin.podcasts.listShows() });
  const castopodConfigured = status.data?.castopodConfigured ?? false;

  return (
    <>
      <PageTitle
        kicker="Distribution"
        title="Podcasts & RSS"
        description="StockTank publishes an Apple Podcasts and Podcasting 2.0 feed per show. Episodes appear once they are published and their audio has been processed. Castopod sync is optional."
      />
      {status.data && (!status.data.ownerEmailConfigured || !castopodConfigured) ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
              Setup
            </CardTitle>
            <CardDescription>
              {!status.data.ownerEmailConfigured ? 'Set PODCAST_OWNER_EMAIL so Apple and Spotify can verify feed ownership. ' : ''}
              {!castopodConfigured ? 'Castopod is not configured (CASTOPOD_URL, CASTOPOD_API_USERNAME, CASTOPOD_API_PASSWORD, CASTOPOD_USER_ID); feeds still work without it.' : ''}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {shows.isError ? (
        <EmptyState icon={<Rss />} title="Could not load shows" description={describeApiError(shows.error)} />
      ) : shows.isPending ? (
        <Skeleton className="h-72" />
      ) : shows.data.length === 0 ? (
        <EmptyState icon={<Rss />} title="No shows yet" description="Create a show under Network → Shows first." />
      ) : (
        <ul className="flex flex-col gap-4">
          {shows.data.map((s) => (
            <li key={s.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p className="flex flex-wrap items-center gap-2 font-display text-lg font-bold">
                      {s.title}
                      {s.isDemo ? <Badge variant="mono">DEMO</Badge> : null}
                      <Badge variant={REVIEW_STATUS_VARIANT[s.status]}>{humanize(s.status)}</Badge>
                      {s.podcastEnabled ? <Badge variant="primary">Feed on</Badge> : <Badge variant="neutral">Feed off</Badge>}
                    </p>
                    <p className="text-sm text-muted">
                      {s.feedEpisodes} of {s.publishedEpisodes} published episodes in the feed
                      {s.podcastCategory ? ` · ${s.podcastCategory}${s.podcastSubcategory ? ` › ${s.podcastSubcategory}` : ''}` : ''}
                      {s.castopodPodcastId !== null ? ` · Castopod #${s.castopodPodcastId}` : ''}
                    </p>
                    {s.feedUrl ? (
                      <p className="flex flex-wrap items-center gap-2">
                        <code className="rounded bg-raised px-2 py-1 font-mono text-xs">{s.feedUrl}</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Copy feed URL for ${s.title}`}
                          onClick={() => {
                            void navigator.clipboard?.writeText(s.feedUrl!).then(() => toast.success('Feed URL copied'));
                          }}
                        >
                          <Copy className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <a href={s.feedUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open feed for ${s.title}`}>
                            <ExternalLink className="size-3.5" aria-hidden="true" />
                          </a>
                        </Button>
                      </p>
                    ) : null}
                    {s.warnings.length > 0 ? (
                      <ul className="flex flex-col gap-0.5 text-xs text-warning">
                        {s.warnings.map((w) => (
                          <li key={w}>• {w}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === s.id ? null : s.id)} aria-expanded={expanded === s.id}>
                      Episodes
                    </Button>
                    {canPublish ? (
                      <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                        Settings
                      </Button>
                    ) : null}
                  </div>
                </div>
                {expanded === s.id ? (
                  <div className="border-t border-hairline p-5">
                    <EpisodesTable show={s} canPublish={canPublish} castopodConfigured={castopodConfigured} />
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <SettingsDialog key={editing?.id ?? 'none'} show={editing} onClose={() => setEditing(null)} castopodConfigured={castopodConfigured} />
    </>
  );
}
