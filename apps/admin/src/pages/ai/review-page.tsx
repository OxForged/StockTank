import { AI_DRAFT_KINDS, aiDraftStatusSchema, type AdminAiDraft, type AiDraftKind, type AiDraftStatus } from '@stocktank/types';
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
  Reveal,
  Skeleton,
  Textarea,
  toast,
} from '@stocktank/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ListChecks, Sparkles, XCircle } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { can, describeApiError, useMe } from '../../lib/auth';
import { formatDate, humanize } from '../../lib/format';

const SELECT = 'h-10 w-full rounded-md border border-hairline-strong bg-bg px-3 text-sm text-fg focus:border-primary focus:outline-none';
const STATUS_VARIANT: Record<AiDraftStatus, 'neutral' | 'warning' | 'primary' | 'danger' | 'outline'> = { draft: 'neutral', review: 'warning', approved: 'primary', rejected: 'danger', published: 'outline' };

export const clock = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

/** Renders any draft kind readably; reviewers edit the JSON in the dialog when they need precision. */
export function DraftPreview({ draft }: { draft: AdminAiDraft }) {
  const c = draft.content as Record<string, unknown>;
  const list = (items: unknown[], render: (x: Record<string, unknown>, i: number) => ReactNode) => (
    <ol className="flex flex-col gap-2">{items.map((x, i) => <li key={i}>{render(x as Record<string, unknown>, i)}</li>)}</ol>
  );
  switch (draft.kind) {
    case 'summary':
      return <p className="whitespace-pre-wrap text-sm">{String(c.summary)}</p>;
    case 'show_notes':
      return (
        <div className="flex flex-col gap-2 text-sm">
          <p className="whitespace-pre-wrap">{String(c.notes)}</p>
          <ul className="list-disc pl-5">{(c.keyPoints as string[]).map((k) => <li key={k}>{k}</li>)}</ul>
        </div>
      );
    case 'seo':
      return (
        <dl className="grid gap-1 text-sm">
          <dt className="text-xs text-muted">Title</dt>
          <dd className="font-semibold">{String(c.title)}</dd>
          <dt className="text-xs text-muted">Description</dt>
          <dd>{String(c.description)}</dd>
          <dt className="text-xs text-muted">Keywords</dt>
          <dd className="font-mono text-xs">{(c.keywords as string[]).join(', ')}</dd>
        </dl>
      );
    case 'chapters':
      return list(c.chapters as unknown[], (x) => <span className="text-sm"><span className="font-mono text-xs text-muted">{clock(Number(x.start))}</span> {String(x.title)}</span>);
    case 'quotes':
      return list(c.quotes as unknown[], (x) => (
        <blockquote className="rounded-md border-l-2 border-primary bg-raised/40 px-3 py-2 text-sm">
          “{String(x.quote)}” <span className="text-xs text-muted">— {String(x.speaker ?? 'unknown')} · {clock(Number(x.start))}–{clock(Number(x.end))} · {String(x.why)}</span>
        </blockquote>
      ));
    case 'clip_candidates':
      return list(c.candidates as unknown[], (x) => (
        <div className="rounded-md border border-hairline p-2 text-sm">
          <p className="font-semibold">
            {String(x.title)} <Badge variant="mono">{String(x.targetSeconds)}s</Badge> <Badge variant="neutral">{humanize(String(x.reason))}</Badge>{' '}
            <span className="font-mono text-xs text-muted">{clock(Number(x.start))}–{clock(Number(x.end))} · conf {Number(x.confidence).toFixed(2)}</span>
          </p>
          <p className="mt-1 text-xs text-muted">{String(x.transcript)}</p>
        </div>
      ));
    case 'social_posts':
      return list(c.posts as unknown[], (x) => (
        <div className="rounded-md border border-hairline p-2 text-sm">
          <Badge variant="mono">{String(x.platform)}</Badge>
          <p className="mt-1 whitespace-pre-wrap">{String(x.text)}</p>
          <p className="text-xs text-muted">{(x.hashtags as string[]).map((h) => `#${h}`).join(' ')}</p>
        </div>
      ));
    case 'newsletter':
      return (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-semibold">{String(c.subject)}</p>
          <p className="text-xs text-muted">{String(c.preheader)}</p>
          <p className="whitespace-pre-wrap">{String(c.body)}</p>
        </div>
      );
    case 'article':
      return (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-semibold">{String(c.title)}</p>
          <p className="text-muted">{String(c.summary)}</p>
          <p className="whitespace-pre-wrap">{String(c.body)}</p>
        </div>
      );
    case 'entities':
      return (
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          {(['companies', 'projects', 'people'] as const).map((k) => (
            <div key={k}>
              <p className="text-xs uppercase tracking-[0.1em] text-muted">{k}</p>
              <ul>{(c[k] as Array<Record<string, unknown>>).map((e, i) => <li key={i}>{String(e.name)}{e.matchedCompanyId || e.matchedProjectId ? <Badge variant="primary">linked</Badge> : null}<span className="block text-xs text-muted">“{String(e.evidence)}”</span></li>)}</ul>
            </div>
          ))}
        </div>
      );
    case 'topics':
      return (
        <p className="flex flex-wrap gap-1">
          {(c.topics as string[]).map((t) => <Badge key={t} variant="primary">{t}</Badge>)}
          {(c.tags as string[]).map((t) => <Badge key={t} variant="mono">{t}</Badge>)}
        </p>
      );
    default:
      return <pre className="text-xs">{JSON.stringify(c, null, 2)}</pre>;
  }
}

function ReviewDialog({ draft, flagLabels, onClose }: { draft: AdminAiDraft | null; flagLabels: Map<string, string>; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const review = useMutation({
    mutationFn: (input: Parameters<typeof api.admin.aiFactory.review>[1]) => api.admin.aiFactory.review(draft!.id, input),
    onSuccess: (d) => {
      toast.success(d.status === 'approved' ? 'Draft approved and applied' : 'Draft rejected');
      void qc.invalidateQueries({ queryKey: ['admin', 'ai'] });
      onClose();
    },
    onError: (err) => setError(describeApiError(err)),
  });

  function submit(decision: 'approve' | 'reject', form: HTMLFormElement) {
    setError(null);
    const d = new FormData(form);
    let content: unknown;
    if (editing) {
      try {
        content = JSON.parse(String(d.get('content') ?? ''));
      } catch {
        setError('Edited content must be valid JSON.');
        return;
      }
    }
    review.mutate({ decision, note: String(d.get('note') ?? '').trim() || null, acknowledgedFlags: d.getAll('flags').map(String), content });
  }

  return (
    <Dialog open={Boolean(draft)} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent size="lg" className="max-h-[92dvh] overflow-y-auto">
        {draft ? (
          <form key={draft.id} onSubmit={(e: FormEvent<HTMLFormElement>) => e.preventDefault()} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>
                {humanize(draft.kind)} · {draft.episodeTitle}
              </DialogTitle>
              <DialogDescription>
                {draft.showTitle} · {draft.provider}/{draft.model} · prompt {draft.promptVersion} · AI generates, you decide. Approval applies the content.
              </DialogDescription>
            </DialogHeader>
            {draft.moderationFlags.length > 0 ? (
              <fieldset className="rounded-lg border border-warning/40 bg-warning-soft p-3">
                <legend className="flex items-center gap-1 px-1 text-sm font-semibold text-warning">
                  <AlertTriangle className="size-4" aria-hidden="true" /> Moderation flags: acknowledge each before approving
                </legend>
                {draft.moderationFlags.map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="flags" value={f} className="size-4 accent-[var(--color-warning)]" />
                    {flagLabels.get(f) ?? f}
                  </label>
                ))}
              </fieldset>
            ) : null}
            {draft.citations.length > 0 ? (
              <details className="text-xs text-muted">
                <summary className="cursor-pointer">{draft.citations.length} transcript citation(s)</summary>
                <ul className="mt-1 flex flex-col gap-1">
                  {draft.citations.map((c, i) => (
                    <li key={i}>
                      <span className="font-mono">{clock(c.start)}–{clock(c.end)}</span> “{c.quote}”
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <div className="rounded-lg border border-hairline p-3">
              {editing ? (
                <FormField label="Edited content (JSON, validated on save)" htmlFor="draft-content">
                  {({ id }) => <Textarea id={id} name="content" rows={14} className="font-mono text-xs" defaultValue={JSON.stringify(draft.content, null, 2)} />}
                </FormField>
              ) : (
                <DraftPreview draft={draft} />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing((e) => !e)}>
                {editing ? 'Preview' : 'Edit before approving'}
              </Button>
            </div>
            <FormField label="Review note" htmlFor="draft-note">
              {({ id }) => <Textarea id={id} name="note" rows={2} maxLength={2000} />}
            </FormField>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button type="button" variant="danger" loading={review.isPending} onClick={(e) => submit('reject', e.currentTarget.form!)}>
                <XCircle className="size-4" aria-hidden="true" /> Reject
              </Button>
              <Button type="button" loading={review.isPending} onClick={(e) => submit('approve', e.currentTarget.form!)}>
                <CheckCircle2 className="size-4" aria-hidden="true" /> Approve
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function AiReviewPage() {
  const me = useMe();
  const canPublish = can(me.user, 'content.publish');
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as AiDraftStatus | null) ?? 'review';
  const kind = (params.get('kind') as AiDraftKind | null) ?? undefined;
  const [open, setOpen] = useState<AdminAiDraft | null>(null);
  const flags = useQuery({ queryKey: ['admin', 'ai', 'flags'], queryFn: () => api.admin.aiFactory.moderationFlags(), staleTime: Infinity });
  const drafts = useQuery({ queryKey: ['admin', 'ai', 'drafts', status, kind ?? 'all'], queryFn: () => api.admin.aiFactory.drafts({ status, kind, pageSize: 100 }), refetchInterval: 15_000 });
  const flagLabels = new Map((flags.data ?? []).map((f) => [f.key, f.label]));

  return (
    <>
      <PageTitle kicker="AI" title="Review queue" description="Everything the content factory produces waits here. AI drafts; editors approve, edit or reject. Financial claims are flagged and must be acknowledged." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Status" className="flex flex-wrap gap-1">
          {aiDraftStatusSchema.options.map((s) => (
            <Button key={s} size="sm" variant={status === s ? 'secondary' : 'ghost'} aria-pressed={status === s} onClick={() => setParams({ status: s, ...(kind ? { kind } : {}) })}>
              {humanize(s)}
            </Button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted">Kind</span>
          <select value={kind ?? ''} onChange={(e) => setParams({ status, ...(e.target.value ? { kind: e.target.value } : {}) })} className={`${SELECT} w-48`} aria-label="Draft kind">
            <option value="">All kinds</option>
            {AI_DRAFT_KINDS.map((k) => (
              <option key={k} value={k}>
                {humanize(k)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {drafts.isError ? (
        <EmptyState icon={<ListChecks />} title="Could not load the queue" description={describeApiError(drafts.error)} />
      ) : drafts.isPending ? (
        <Skeleton className="h-72" />
      ) : drafts.data.items.length === 0 ? (
        <EmptyState icon={<Sparkles />} title={status === 'review' ? 'Nothing waiting for review' : `No ${status} drafts`} description="Run the content factory from an episode’s AI panel to generate drafts." />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {drafts.data.items.map((d, i) => (
            <li key={d.id}>
              <Reveal index={i}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      {humanize(d.kind)}
                      <Badge variant={STATUS_VARIANT[d.status]}>{d.status}</Badge>
                      {d.moderationFlags.length > 0 ? (
                        <Badge variant="warning">
                          {d.moderationFlags.length} flag{d.moderationFlags.length === 1 ? '' : 's'}
                        </Badge>
                      ) : null}
                    </CardTitle>
                    <CardDescription>
                      {d.episodeTitle} · {d.showTitle} · {formatDate(d.createdAt, true)}
                      {d.reviewer ? ` · reviewed by ${d.reviewer.displayName}` : ''}
                    </CardDescription>
                  </CardHeader>
                  <div className="max-h-48 overflow-hidden px-6 text-sm [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
                    <DraftPreview draft={d} />
                  </div>
                  <div className="flex justify-end gap-2 p-4">
                    <Button size="sm" variant={d.status === 'review' && canPublish ? 'primary' : 'outline'} onClick={() => setOpen(d)}>
                      {d.status === 'review' && canPublish ? 'Review' : 'Open'}
                    </Button>
                  </div>
                </Card>
              </Reveal>
            </li>
          ))}
        </ul>
      )}
      <ReviewDialog draft={open} flagLabels={flagLabels} onClose={() => setOpen(null)} />
    </>
  );
}
