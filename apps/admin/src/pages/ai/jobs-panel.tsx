import { AI_DRAFT_KINDS, type AiDraftKind } from '@stocktank/types';
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, EmptyState, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, toast } from '@stocktank/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, FileAudio, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { describeApiError } from '../../lib/auth';
import { formatDate, humanize } from '../../lib/format';
import { clock } from './review-page';

const SELECT = 'h-10 w-full rounded-md border border-hairline-strong bg-bg px-3 text-sm text-fg focus:border-primary focus:outline-none';
const JOB_VARIANT = { queued: 'info', running: 'warning', succeeded: 'primary', failed: 'danger' } as const;

/** Per-episode AI controls: transcribe, run the factory, read the transcript. Used on the AI jobs page. */
export function EpisodeAiPanel({ episodeId, episodeTitle }: { episodeId: string; episodeTitle: string }) {
  const qc = useQueryClient();
  const [kinds, setKinds] = useState<AiDraftKind[]>([]);
  const transcript = useQuery({
    queryKey: ['admin', 'ai', 'transcript', episodeId],
    queryFn: () => api.admin.aiFactory.transcript(episodeId),
    retry: false,
    refetchInterval: (q) => (q.state.data?.status === 'queued' || q.state.data?.status === 'processing' ? 4000 : false),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin', 'ai'] });
  const transcribe = useMutation({
    mutationFn: () => api.admin.aiFactory.transcribe(episodeId),
    onSuccess: () => {
      toast.success('Transcription queued');
      refresh();
    },
    onError: (err) => toast.error('Could not queue transcription', { description: describeApiError(err) }),
  });
  const run = useMutation({
    mutationFn: () => api.admin.aiFactory.runFactory(episodeId, kinds.length ? kinds : undefined),
    onSuccess: () => {
      toast.success('Content factory queued', { description: 'Drafts appear in the review queue as they finish.' });
      refresh();
    },
    onError: (err) => toast.error('Could not start the factory', { description: describeApiError(err) }),
  });
  const t = transcript.data;
  const status = transcript.isError ? 'none' : (t?.status ?? 'loading');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary-hi" aria-hidden="true" /> {episodeTitle}
        </CardTitle>
        <CardDescription>Transcript → drafts → human review. Every step is metered against AI budgets.</CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">
            Transcript:{' '}
            {status === 'loading' ? (
              <Skeleton className="inline-block h-4 w-16 align-middle" />
            ) : status === 'none' ? (
              <Badge variant="neutral">none</Badge>
            ) : (
              <Badge variant={status === 'ready' ? 'primary' : status === 'failed' ? 'danger' : 'warning'}>{status}</Badge>
            )}
          </span>
          {t?.status === 'ready' ? (
            <span className="font-mono text-xs text-muted">
              {t.language ?? '?'} · {t.segments.length} segments · conf {t.confidence?.toFixed(2) ?? '—'} · {t.provider}/{t.model}
            </span>
          ) : null}
          {t?.status === 'failed' && t.error ? <span className="text-xs text-danger">{t.error}</span> : null}
          <Button size="sm" variant="outline" onClick={() => transcribe.mutate()} loading={transcribe.isPending} disabled={status === 'queued' || status === 'processing'}>
            <FileAudio className="size-4" aria-hidden="true" /> {status === 'ready' || status === 'failed' ? 'Re-transcribe' : 'Transcribe'}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted">Outputs (empty = everything)</span>
            <select multiple size={4} value={kinds} onChange={(e) => setKinds([...e.target.selectedOptions].map((o) => o.value as AiDraftKind))} className={`${SELECT} h-auto w-56`} aria-label="Draft kinds">
              {AI_DRAFT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {humanize(k)}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => run.mutate()} loading={run.isPending} disabled={t?.status !== 'ready'} title={t?.status !== 'ready' ? 'Needs a ready transcript' : undefined}>
            <Sparkles className="size-4" aria-hidden="true" /> Run content factory
          </Button>
        </div>
        {t?.status === 'ready' ? (
          <details className="rounded-lg border border-hairline p-3">
            <summary className="cursor-pointer text-sm font-semibold">Transcript</summary>
            <ol className="mt-2 flex max-h-80 flex-col gap-1 overflow-y-auto text-sm">
              {t.segments.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-mono text-xs text-muted">{clock(s.start)}</span>
                  {s.speaker ? <span className="shrink-0 text-xs font-semibold">{s.speaker}:</span> : null}
                  <span className={s.confidence !== null && s.confidence < 0.5 ? 'text-warning' : undefined}>{s.text}</span>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </div>
    </Card>
  );
}

export function AiJobsPage() {
  const jobs = useQuery({ queryKey: ['admin', 'ai', 'jobs'], queryFn: () => api.admin.aiFactory.jobs(), refetchInterval: (q) => (q.state.data?.some((j) => j.status === 'queued' || j.status === 'running') ? 4000 : 15_000) });
  const episodes = useQuery({ queryKey: ['admin', 'content', 'episodes', 'ai'], queryFn: () => api.admin.content.listEpisodes({ pageSize: 100 }) });
  const [episodeId, setEpisodeId] = useState('');
  const selected = episodes.data?.items.find((e) => e.id === episodeId);

  return (
    <>
      <PageTitle kicker="AI" title="AI jobs" description="Transcription and content-factory runs. Pick an episode to transcribe it or generate drafts for review." />
      <div className="mb-6 flex flex-col gap-4">
        <label className="flex max-w-xl flex-col gap-1 text-sm">
          <span className="text-xs text-muted">Episode</span>
          <select value={episodeId} onChange={(e) => setEpisodeId(e.target.value)} className={SELECT} aria-label="Episode">
            <option value="">Choose an episode…</option>
            {(episodes.data?.items ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.show.title} — {e.title}
              </option>
            ))}
          </select>
        </label>
        {selected ? <EpisodeAiPanel key={selected.id} episodeId={selected.id} episodeTitle={selected.title} /> : null}
      </div>
      {jobs.isError ? (
        <EmptyState icon={<Activity />} title="Could not load jobs" description={describeApiError(jobs.error)} />
      ) : jobs.isPending ? (
        <Skeleton className="h-48" />
      ) : jobs.data.length === 0 ? (
        <EmptyState icon={<Activity />} title="No AI jobs yet" description="Jobs appear here when you transcribe an episode or run the factory." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Outputs</TableHead>
              <TableHead className="hidden lg:table-cell">Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.data.map((j) => (
              <TableRow key={j.id}>
                <TableCell>
                  <p className="font-semibold">{humanize(j.type)}</p>
                  <p className="text-xs text-muted">{j.episodeTitle ?? j.episodeId ?? '—'}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={JOB_VARIANT[j.status]}>{j.status}</Badge>
                  {j.error ? <p className="max-w-[320px] text-xs text-danger">{j.error}</p> : null}
                </TableCell>
                <TableCell className="hidden font-mono text-xs text-muted md:table-cell">{j.kinds.length ? j.kinds.join(', ') : j.type === 'content_factory' ? 'all' : '—'}</TableCell>
                <TableCell className="hidden text-sm text-muted lg:table-cell">{formatDate(j.startedAt ?? j.createdAt, true)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
