import { AI_PERSONALITY_PUBLISH_STATUSES, publishStatusSchema, type AiPersonality, type AiPersonalityInput, type PublishStatus } from '@stocktank/types';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  Reveal,
  Skeleton,
  Textarea,
  toast,
} from '@stocktank/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, History, Plus, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { can, describeApiError, useMe } from '../../lib/auth';
import { REVIEW_STATUS_VARIANT, formatDate, humanize } from '../../lib/format';

const SELECT = 'h-10 w-full rounded-md border border-hairline-strong bg-bg px-3 text-sm text-fg focus:border-primary focus:outline-none';
const PERSONALITIES_KEY = ['admin', 'ai', 'personalities'] as const;

function PersonalityDialog({ personality, open, onClose, canPublish }: { personality: AiPersonality | null; open: boolean; onClose: () => void; canPublish: boolean }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (input: AiPersonalityInput) => api.admin.ai.savePersonality(input, personality?.id),
    onSuccess: (saved) => {
      toast.success(personality ? 'Personality saved' : 'Personality created', { description: saved.promptVersion === 0 ? 'Write its prompt next.' : undefined });
      void qc.invalidateQueries({ queryKey: PERSONALITIES_KEY });
      onClose();
    },
    onError: (err) => setError(describeApiError(err)),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const d = new FormData(e.currentTarget);
    const text = (name: string) => String(d.get(name) ?? '').trim();
    const prompt = text('personalityPrompt');
    save.mutate({
      name: text('name'),
      slug: text('slug'),
      description: text('description') || null,
      tone: text('tone') || null,
      expertise: text('expertise')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      disclosures: text('disclosures'),
      voiceId: text('voiceId') || null,
      avatarUrl: text('avatarUrl') || null,
      status: text('status') as PublishStatus,
      ...(personality || !prompt ? {} : { personalityPrompt: prompt }),
    });
  }

  const statusLocked = (s: PublishStatus) => AI_PERSONALITY_PUBLISH_STATUSES.has(s) && !canPublish && personality?.status !== s;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent size="lg" className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{personality ? `Edit ${personality.name}` : 'New AI personality'}</DialogTitle>
            <DialogDescription>
              AI personalities are disclosed media hosts and explainers, never financial advisers. Disclosures are shown to the audience wherever the personality appears.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="ai-name" required>
              {({ id }) => <Input id={id} name="name" required maxLength={120} defaultValue={personality?.name ?? ''} />}
            </FormField>
            <FormField label="Slug" htmlFor="ai-slug" hint="Lowercase letters, numbers and hyphens" required>
              {({ id }) => <Input id={id} name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={personality?.slug ?? ''} className="font-mono" />}
            </FormField>
            <FormField label="Tone" htmlFor="ai-tone" hint="e.g. calm, clear, neutral">
              {({ id }) => <Input id={id} name="tone" maxLength={200} defaultValue={personality?.tone ?? ''} />}
            </FormField>
            <FormField label="Expertise" htmlFor="ai-expertise" hint="Comma separated">
              {({ id }) => <Input id={id} name="expertise" defaultValue={personality?.expertise.join(', ') ?? ''} />}
            </FormField>
            <FormField label="Voice id" htmlFor="ai-voice" hint="Only voices with documented consent">
              {({ id }) => <Input id={id} name="voiceId" maxLength={200} defaultValue={personality?.voiceId ?? ''} className="font-mono" />}
            </FormField>
            <FormField label="Avatar URL" htmlFor="ai-avatar">
              {({ id }) => <Input id={id} name="avatarUrl" type="url" defaultValue={personality?.avatarUrl ?? ''} />}
            </FormField>
            <FormField label="Status" htmlFor="ai-status" hint={canPublish ? undefined : 'Publishing, archiving and rejecting need content.publish'}>
              {({ id }) => (
                <select id={id} name="status" defaultValue={personality?.status ?? 'draft'} className={SELECT}>
                  {publishStatusSchema.options.map((s) => (
                    <option key={s} value={s} disabled={statusLocked(s)}>
                      {humanize(s)}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>
          <FormField label="Description" htmlFor="ai-description" hint="Shown on the public host profile">
            {({ id }) => <Textarea id={id} name="description" maxLength={2000} defaultValue={personality?.description ?? ''} />}
          </FormField>
          <FormField label="Disclosures" htmlFor="ai-disclosures" hint="Required. Tell the audience this is an AI personality and that content is informational only." required>
            {({ id }) => <Textarea id={id} name="disclosures" required minLength={10} maxLength={2000} defaultValue={personality?.disclosures ?? ''} />}
          </FormField>
          {!personality ? (
            <FormField label="Initial prompt" htmlFor="ai-prompt" hint="Optional; becomes version 1. Server-side only, never sent to the website.">
              {({ id }) => <Textarea id={id} name="personalityPrompt" maxLength={20_000} className="min-h-32 font-mono text-xs" />}
            </FormField>
          ) : null}
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
              {personality ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PromptDialog({ personality, onClose }: { personality: AiPersonality | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [openVersion, setOpenVersion] = useState<string | null>(null);
  const versions = useQuery({
    queryKey: [...PERSONALITIES_KEY, personality?.id, 'prompts'],
    queryFn: () => api.admin.ai.listPromptVersions(personality!.id),
    enabled: Boolean(personality),
  });
  const save = useMutation({
    mutationFn: (input: { content: string; note: string | null }) => api.admin.ai.updatePrompt(personality!.id, input),
    onSuccess: (saved) => {
      toast.success(`Prompt version ${saved.promptVersion} saved`, { description: 'Earlier versions are kept for traceability.' });
      void qc.invalidateQueries({ queryKey: PERSONALITIES_KEY });
      onClose();
    },
    onError: (err) => setError(describeApiError(err)),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const d = new FormData(e.currentTarget);
    save.mutate({ content: String(d.get('content') ?? '').trim(), note: String(d.get('note') ?? '').trim() || null });
  }

  return (
    <Dialog open={Boolean(personality)} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent size="lg" className="max-h-[90dvh] overflow-y-auto">
        {personality ? (
          <form onSubmit={onSubmit} key={personality.id} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{personality.name}: prompt</DialogTitle>
              <DialogDescription>
                Currently version {personality.promptVersion}. Saving writes version {personality.promptVersion + 1}; every version is kept so stored responses can be traced to the exact prompt. Prompts stay server-side.
              </DialogDescription>
            </DialogHeader>
            <FormField label="Prompt" htmlFor="ai-prompt-content" required>
              {({ id }) => <Textarea id={id} name="content" required maxLength={20_000} defaultValue={personality.personalityPrompt} className="min-h-48 font-mono text-xs" />}
            </FormField>
            <FormField label="Change note" htmlFor="ai-prompt-note" hint="What changed and why">
              {({ id }) => <Input id={id} name="note" maxLength={500} />}
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
                Save as version {personality.promptVersion + 1}
              </Button>
            </DialogFooter>
            <section aria-labelledby="ai-prompt-history" className="border-t border-hairline pt-4">
              <h3 id="ai-prompt-history" className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <History className="size-4" aria-hidden="true" />
                Version history
              </h3>
              {versions.isPending ? (
                <Skeleton className="h-16" />
              ) : versions.isError ? (
                <p className="text-sm text-danger">{describeApiError(versions.error)}</p>
              ) : versions.data.length === 0 ? (
                <p className="text-sm text-muted">No prompt yet.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {versions.data.map((v) => (
                    <li key={v.id} className="rounded-md border border-hairline p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={v.version === personality.promptVersion ? 'primary' : 'neutral'}>v{v.version}</Badge>
                        <span className="text-muted">
                          {formatDate(v.createdAt, true)}
                          {v.createdByName ? ` · ${v.createdByName}` : ''}
                        </span>
                        {v.note ? <span className="italic">{v.note}</span> : null}
                        <Button type="button" size="sm" variant="ghost" className="ml-auto" aria-expanded={openVersion === v.id} onClick={() => setOpenVersion(openVersion === v.id ? null : v.id)}>
                          {openVersion === v.id ? 'Hide' : 'View'}
                        </Button>
                      </div>
                      {openVersion === v.id ? <pre className="mt-2 whitespace-pre-wrap rounded bg-raised p-2 font-mono text-xs">{v.content}</pre> : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function AiPersonalitiesPage() {
  const me = useMe();
  const canPublish = can(me.user, 'content.publish');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AiPersonality | null>(null);
  const [prompting, setPrompting] = useState<AiPersonality | null>(null);
  const list = useQuery({ queryKey: PERSONALITIES_KEY, queryFn: () => api.admin.ai.listPersonalities() });
  const current = (p: AiPersonality | null) => (p ? (list.data?.find((x) => x.id === p.id) ?? p) : null);

  return (
    <>
      <PageTitle
        kicker="AI"
        title="Personalities"
        description="Disclosed AI hosts, researchers and explainers (§16). They are media personalities, never financial advisers. Prompts are versioned and stay server-side (§17)."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New personality
          </Button>
        }
      />
      {list.isError ? (
        <EmptyState icon={<Bot />} title="Could not load personalities" description={describeApiError(list.error)} />
      ) : list.isPending ? (
        <Skeleton className="h-72" />
      ) : list.data.length === 0 ? (
        <EmptyState icon={<Bot />} title="No AI personalities yet" description="Create one, then write its prompt. Publishing needs content.publish." />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {list.data.map((p, i) => (
            <Reveal key={p.id} index={i}>
              <li className="h-full list-none">
                <Card className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start gap-3">
                    <Avatar src={p.avatarUrl} name={p.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-display text-lg font-bold">
                        {p.name}
                        {p.isDemo ? <Badge variant="mono">DEMO</Badge> : null}
                        <Badge variant={REVIEW_STATUS_VARIANT[p.status]}>{humanize(p.status)}</Badge>
                      </p>
                      <p className="font-mono text-xs text-muted">
                        {p.slug} · prompt v{p.promptVersion}
                        {p.tone ? ` · ${p.tone}` : ''}
                      </p>
                    </div>
                  </div>
                  {p.description ? <p className="text-sm text-muted">{p.description}</p> : null}
                  {p.expertise.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5" aria-label={`Expertise of ${p.name}`}>
                      {p.expertise.map((e) => (
                        <li key={e}>
                          <Badge variant="outline">{e}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="flex items-start gap-2 rounded-md bg-raised p-3 text-xs">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <span>
                      <span className="font-semibold">Disclosure: </span>
                      {p.disclosures}
                    </span>
                  </p>
                  {p.promptVersion === 0 ? <p className="text-xs text-warning">No prompt written yet; this personality cannot respond.</p> : null}
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => setPrompting(p)} aria-label={`Edit prompt for ${p.name}`}>
                      Prompt
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
                      Edit
                    </Button>
                    {p.voiceId ? <span className="ml-auto self-center font-mono text-xs text-muted">voice: {p.voiceId}</span> : null}
                  </div>
                </Card>
              </li>
            </Reveal>
          ))}
        </ul>
      )}
      <PersonalityDialog
        key={editing?.id ?? (creating ? 'new' : 'none')}
        personality={editing}
        open={creating || Boolean(editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        canPublish={canPublish}
      />
      <PromptDialog personality={current(prompting)} onClose={() => setPrompting(null)} />
    </>
  );
}
