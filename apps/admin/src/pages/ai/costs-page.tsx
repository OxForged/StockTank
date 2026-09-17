import { AI_FEATURES, type AiBudget, type AiBudgetInput, type AiBudgetScope, type AiUsageQuery, type AiUsageReport } from '@stocktank/types';
import {
  AnimatedNumber,
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
  Reveal,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSeriesChart,
  cn,
  toast,
} from '@stocktank/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Coins, Plus, Trash2, XCircle } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { can, describeApiError, useMe } from '../../lib/auth';
import { formatNumber, humanize } from '../../lib/format';

const SELECT = 'h-10 w-full rounded-md border border-hairline-strong bg-bg px-3 text-sm text-fg focus:border-primary focus:outline-none';
const PRESETS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const;
const BUDGETS_KEY = ['admin', 'ai', 'budgets'] as const;

/** Estimated micro-dollars as USD. Small amounts keep four decimals so a cheap call never rounds to $0.00. */
export function formatMicros(micros: number): string {
  const usd = micros / 1_000_000;
  const digits = usd !== 0 && Math.abs(usd) < 0.01 ? 4 : 2;
  return `$${usd.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
const parseUsd = (raw: string): number | null => {
  const n = Number(raw.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1_000_000) : null;
};

function useRange(): { days: number; query: AiUsageQuery; setDays: (d: number) => void } {
  const [params, setParams] = useSearchParams();
  const days = Number(params.get('days')) || 30;
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const from = new Date(today.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  return { days, query: { from, to }, setDays: (d) => setParams({ days: String(d) }) };
}

function Stat({ label, micros, value, hint, index }: { label: string; micros?: number; value?: ReactNode; hint?: ReactNode; index: number }) {
  return (
    <Reveal index={index}>
      <Card className="flex flex-col gap-1 p-5">
        <span className="text-xs uppercase tracking-[0.1em] text-muted">{label}</span>
        <span className="font-display text-3xl font-extrabold tabular-nums">{micros !== undefined ? <AnimatedNumber value={micros} format={formatMicros} /> : value}</span>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </Card>
    </Reveal>
  );
}

function UnknownCost({ count, children }: { count: number; children?: ReactNode }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-warning" title="These calls used a model with no configured price, so their cost is unknown and not included in totals.">
      <AlertTriangle className="size-3" aria-hidden="true" />
      {count} unknown{children}
    </span>
  );
}

function BreakdownTable<T extends { calls: number; failures: number; inputTokens: number; outputTokens: number; costMicros: number; unknownCostCalls: number }>({
  title,
  description,
  rows,
  head,
  name,
}: {
  title: string;
  description: string;
  rows: T[];
  head: string;
  name: (row: T) => ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{head}</TableHead>
            <TableHead className="text-right">Calls</TableHead>
            <TableHead className="hidden text-right md:table-cell">Tokens in / out</TableHead>
            <TableHead className="text-right">Est. cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted">
                No AI calls in this range.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{name(r)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(r.calls)}
                  {r.failures > 0 ? <span className="ml-1 text-xs text-danger">({r.failures} failed)</span> : null}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-xs text-muted md:table-cell">
                  {formatNumber(r.inputTokens)} / {formatNumber(r.outputTokens)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMicros(r.costMicros)}
                  <UnknownCost count={r.unknownCostCalls} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function BudgetDialog({ open, onClose, personalities, existing }: { open: boolean; onClose: () => void; personalities: AiUsageReport['byPersonality']; existing: AiBudget | null }) {
  const qc = useQueryClient();
  const [scope, setScope] = useState<AiBudgetScope>(existing?.scope ?? 'global');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (input: AiBudgetInput) => api.admin.ai.saveBudget(input),
    onSuccess: (saved) => {
      toast.success('Budget saved', { description: `${saved.label}: ${formatMicros(saved.monthlyLimitMicros)} per month` });
      void qc.invalidateQueries({ queryKey: BUDGETS_KEY });
      onClose();
    },
    onError: (err) => setError(describeApiError(err)),
  });
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const d = new FormData(e.currentTarget);
    const micros = parseUsd(String(d.get('limit') ?? ''));
    if (micros === null) return setError('Enter a monthly limit above $0.');
    save.mutate({ scope, scopeKey: scope === 'global' ? '' : String(d.get('scopeKey') ?? ''), monthlyLimitMicros: micros, hardLimit: d.get('hardLimit') === 'on' });
  }
  const namedPersonalities = personalities.filter((p): p is typeof p & { personalityId: string } => p.personalityId !== null);
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{existing ? `Edit budget: ${existing.label}` : 'New AI budget'}</DialogTitle>
            <DialogDescription>Monthly limits on estimated spend (UTC calendar month). A hard limit blocks new calls in its scope once reached; a soft limit only warns here.</DialogDescription>
          </DialogHeader>
          <FormField label="Scope" htmlFor="budget-scope">
            {({ id }) => (
              <select id={id} value={scope} disabled={Boolean(existing)} onChange={(e) => setScope(e.target.value as AiBudgetScope)} className={SELECT}>
                <option value="global">All AI</option>
                <option value="feature">One feature</option>
                <option value="personality">One personality</option>
              </select>
            )}
          </FormField>
          {scope === 'feature' ? (
            <FormField label="Feature" htmlFor="budget-feature">
              {({ id }) => (
                <select id={id} name="scopeKey" defaultValue={existing?.scopeKey ?? AI_FEATURES[0]} disabled={Boolean(existing)} className={SELECT}>
                  {AI_FEATURES.map((f) => (
                    <option key={f} value={f}>
                      {humanize(f)}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          ) : null}
          {scope === 'personality' ? (
            <FormField label="Personality" htmlFor="budget-personality" hint={namedPersonalities.length === 0 && !existing ? 'Only personalities with recorded usage are listed' : undefined}>
              {({ id }) => (
                <select id={id} name="scopeKey" defaultValue={existing?.scopeKey ?? ''} disabled={Boolean(existing)} className={SELECT} required>
                  {existing ? <option value={existing.scopeKey}>{existing.label}</option> : <option value="">Choose…</option>}
                  {namedPersonalities.map((p) => (
                    <option key={p.personalityId} value={p.personalityId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          ) : null}
          <FormField label="Monthly limit (USD)" htmlFor="budget-limit" required>
            {({ id }) => <Input id={id} name="limit" inputMode="decimal" required defaultValue={existing ? String(existing.monthlyLimitMicros / 1_000_000) : ''} placeholder="50.00" className="font-mono" />}
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="hardLimit" defaultChecked={existing?.hardLimit ?? true} className="size-4 accent-[var(--color-primary)]" />
            Hard limit: block new calls once reached
          </label>
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
              Save budget
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BudgetBar({ budget }: { budget: AiBudget }) {
  const pct = Math.min(100, budget.percentUsed);
  const tone = budget.percentUsed >= 100 ? 'danger' : budget.percentUsed >= 75 ? 'warning' : 'primary';
  const Icon = tone === 'danger' ? XCircle : tone === 'warning' ? AlertTriangle : CheckCircle2;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          <Icon className={cn('size-4', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-primary')} aria-hidden="true" />
          {budget.label}
          <Badge variant="neutral">{humanize(budget.scope)}</Badge>
          <Badge variant={budget.hardLimit ? 'danger' : 'info'}>{budget.hardLimit ? 'hard' : 'soft'}</Badge>
        </span>
        <span className="font-mono text-xs text-muted">
          {formatMicros(budget.spentMicros)} of {formatMicros(budget.monthlyLimitMicros)} · {budget.percentUsed.toFixed(1)}%
          {budget.percentUsed >= 100 ? <span className="ml-1 font-semibold text-danger">{budget.hardLimit ? 'reached: calls blocked' : 'over budget'}</span> : null}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-raised" role="progressbar" aria-label={`${budget.label} budget used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className={cn('h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none', tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-primary')} style={{ width: `${pct}%` }} />
      </div>
      <UnknownCost count={budget.unknownCostCalls}>-cost calls this month are not counted</UnknownCost>
    </div>
  );
}

function ProviderRow({ label, info, extra }: { label: string; info: { provider: string; model: string } | null; extra?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="flex items-center gap-2">
        {info ? <CheckCircle2 className="size-4 text-primary" aria-hidden="true" /> : <XCircle className="size-4 text-muted" aria-hidden="true" />}
        {label}
      </span>
      {info ? (
        <span className="font-mono text-xs text-muted">
          {info.provider} · {info.model}
          {extra ? ` · ${extra}` : ''}
        </span>
      ) : (
        <Badge variant="neutral">not configured</Badge>
      )}
    </li>
  );
}

export function AiCostsPage() {
  const me = useMe();
  const canManage = can(me.user, 'settings.manage');
  const qc = useQueryClient();
  const { days, query, setDays } = useRange();
  const [budgetDialog, setBudgetDialog] = useState<{ open: boolean; existing: AiBudget | null }>({ open: false, existing: null });
  const usage = useQuery({ queryKey: ['admin', 'ai', 'usage', query], queryFn: () => api.admin.ai.usage(query) });
  const budgets = useQuery({ queryKey: BUDGETS_KEY, queryFn: () => api.admin.ai.listBudgets() });
  const status = useQuery({ queryKey: ['admin', 'ai', 'status'], queryFn: () => api.admin.ai.status() });
  const remove = useMutation({
    mutationFn: (id: string) => api.admin.ai.deleteBudget(id),
    onSuccess: () => {
      toast.success('Budget deleted');
      void qc.invalidateQueries({ queryKey: BUDGETS_KEY });
    },
    onError: (err) => toast.error('Could not delete budget', { description: describeApiError(err) }),
  });

  return (
    <>
      <PageTitle
        kicker="AI"
        title="Usage & costs"
        description="Every AI call is recorded with tokens, latency and an estimated cost (§49). Costs are estimates from configured list prices; calls whose model has no price are shown as unknown, never as zero."
      />
      <div className="mb-6 flex flex-wrap gap-1.5" role="group" aria-label="Date range">
        {PRESETS.map((p) => (
          <Button key={p.days} size="sm" variant={days === p.days ? 'secondary' : 'ghost'} aria-pressed={days === p.days} onClick={() => setDays(p.days)}>
            {p.label}
          </Button>
        ))}
      </div>

      {usage.isError ? (
        <EmptyState icon={<Coins />} title="Could not load AI usage" description={describeApiError(usage.error)} />
      ) : usage.isPending ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="flex flex-col gap-6">
          {usage.data.unknownCostCallsMonth > 0 ? (
            <Card className="border-warning/40">
              <div className="flex items-start gap-3 p-4 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                <p>
                  <span className="font-semibold">{formatNumber(usage.data.unknownCostCallsMonth)} calls this month have unknown cost</span> because their model has no configured price. They are excluded from every total and do
                  not count against budgets. Add the model to <code className="font-mono">AI_MODEL_PRICING</code> to price them.
                </p>
              </div>
            </Card>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat index={0} label="Spend today" micros={usage.data.spendTodayMicros} hint={usage.data.unknownCostCallsToday > 0 ? <UnknownCost count={usage.data.unknownCostCallsToday}>-cost calls</UnknownCost> : 'UTC day, estimated'} />
            <Stat index={1} label="Spend this month" micros={usage.data.spendMonthMicros} hint="Calendar month to date, estimated" />
            <Stat
              index={2}
              label="Calls in range"
              value={<AnimatedNumber value={usage.data.totals.calls} />}
              hint={`${formatNumber(usage.data.totals.successes)} ok · ${formatNumber(usage.data.totals.failures)} failed · ${formatMicros(usage.data.totals.costMicros)}`}
            />
            <Stat
              index={3}
              label="Avg latency"
              value={usage.data.totals.avgLatencyMs === null ? '—' : <AnimatedNumber value={usage.data.totals.avgLatencyMs} format={(n) => `${Math.round(n).toLocaleString()} ms`} />}
              hint={`${formatNumber(usage.data.totals.inputTokens)} tokens in · ${formatNumber(usage.data.totals.outputTokens)} out${usage.data.totals.audioSeconds > 0 ? ` · ${Math.round(usage.data.totals.audioSeconds / 60)} min audio` : ''}`}
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily estimated cost</CardTitle>
                <CardDescription>
                  {usage.data.range.from} → {usage.data.range.to}
                </CardDescription>
              </CardHeader>
              <div className="px-6 pb-6">
                <TimeSeriesChart kind="bars" label="Estimated AI cost per day" data={usage.data.daily.map((d) => ({ label: d.date, value: d.costMicros }))} formatValue={formatMicros} />
              </div>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Daily calls</CardTitle>
                <CardDescription>Successful and failed calls together</CardDescription>
              </CardHeader>
              <div className="px-6 pb-6">
                <TimeSeriesChart label="AI calls per day" data={usage.data.daily.map((d) => ({ label: d.date, value: d.calls }))} />
              </div>
            </Card>
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <BreakdownTable title="By feature" description="What the spend buys" rows={usage.data.byFeature} head="Feature" name={(r) => humanize(r.feature)} />
            <BreakdownTable
              title="By model"
              description="Provider and model"
              rows={usage.data.byModel}
              head="Model"
              name={(r) => (
                <span className="font-mono text-xs">
                  {r.provider} · {r.model}
                </span>
              )}
            />
            <BreakdownTable title="By personality" description="Calls made on behalf of an AI personality" rows={usage.data.byPersonality} head="Personality" name={(r) => r.name} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  Budgets
                  {canManage ? (
                    <Button size="sm" variant="outline" onClick={() => setBudgetDialog({ open: true, existing: null })}>
                      <Plus className="size-3.5" aria-hidden="true" />
                      Add budget
                    </Button>
                  ) : null}
                </CardTitle>
                <CardDescription>Monthly limits on estimated spend. {canManage ? '' : 'Changing budgets needs settings.manage.'}</CardDescription>
              </CardHeader>
              <div className="flex flex-col gap-5 px-6 pb-6">
                {budgets.isPending ? (
                  <Skeleton className="h-16" />
                ) : budgets.isError ? (
                  <p className="text-sm text-danger">{describeApiError(budgets.error)}</p>
                ) : budgets.data.length === 0 ? (
                  <p className="text-sm text-muted">No budgets yet. Without a hard limit, AI spend is unbounded.</p>
                ) : (
                  budgets.data.map((b, i) => (
                    <Reveal key={b.id} index={i} className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <BudgetBar budget={b} />
                      </div>
                      {canManage ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" aria-label={`Edit budget ${b.label}`} onClick={() => setBudgetDialog({ open: true, existing: b })}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" aria-label={`Delete budget ${b.label}`} loading={remove.isPending && remove.variables === b.id} onClick={() => remove.mutate(b.id)}>
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      ) : null}
                    </Reveal>
                  ))
                )}
              </div>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Providers</CardTitle>
                <CardDescription>Configured on the API server through environment variables. Keys are never shown.</CardDescription>
              </CardHeader>
              <div className="px-6 pb-6">
                {status.isPending ? (
                  <Skeleton className="h-24" />
                ) : status.isError ? (
                  <p className="text-sm text-danger">{describeApiError(status.error)}</p>
                ) : (
                  <>
                    <ul className="divide-y divide-hairline">
                      <ProviderRow label="Text model" info={status.data.llm} />
                      <ProviderRow label="Fast model" info={status.data.fastLlm} />
                      <ProviderRow label="Embeddings" info={status.data.embeddings} extra={status.data.embeddings ? `${status.data.embeddings.dimensions} dims` : undefined} />
                      <ProviderRow label="Transcription" info={status.data.transcription} />
                    </ul>
                    {status.data.setup.length > 0 ? (
                      <ul className="mt-3 flex flex-col gap-1 text-xs text-warning">
                        {status.data.setup.map((s) => (
                          <li key={s}>• {s}</li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="mt-3 text-xs text-muted">
                      Priced models: <span className="font-mono">{status.data.pricedModels.join(', ') || 'none'}</span>. Override or extend with <code className="font-mono">AI_MODEL_PRICING</code> (JSON).
                    </p>
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
      <BudgetDialog
        key={budgetDialog.existing?.id ?? (budgetDialog.open ? 'new' : 'none')}
        open={budgetDialog.open}
        onClose={() => setBudgetDialog({ open: false, existing: null })}
        personalities={usage.data?.byPersonality ?? []}
        existing={budgetDialog.existing}
      />
    </>
  );
}
