import { Router, type Request } from 'express';
import { z } from 'zod';
import { createAiProviders, priceFor } from '@stocktank/ai';
import { monthStart } from '@stocktank/ai-runtime';
import { Prisma, type PrismaClient } from '@stocktank/database';
import {
  AI_PERSONALITY_PUBLISH_STATUSES,
  aiBudgetInputSchema,
  aiPersonalityInputSchema,
  aiPromptInputSchema,
  aiUsageQuerySchema,
  type AiBudget,
  type AiPersonality,
  type AiPromptVersion,
  type AiStatus,
  type AiUsageReport,
} from '@stocktank/types';
import type { ApiEnv } from '../env.js';
import { writeAudit } from '../lib/audit.js';
import { errors } from '../lib/errors.js';
import { validate } from '../lib/validate.js';
import { getAuth, requirePermission } from '../middleware/auth.js';
import { resolveRange } from './admin-analytics.js';

export interface AdminAiDeps {
  env: ApiEnv;
  prisma: PrismaClient;
}

const idParams = z.object({ id: z.string().min(1).max(64) });
const DAY_MS = 86_400_000;

const personalitySelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  tone: true,
  expertise: true,
  disclosures: true,
  voiceId: true,
  avatarUrl: true,
  status: true,
  hostId: true,
  isDemo: true,
  personalityPrompt: true,
  promptVersion: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AiPersonalitySelect;
type PersonalityRow = Prisma.AiPersonalityGetPayload<{ select: typeof personalitySelect }>;

const promptVersionSelect = {
  id: true,
  version: true,
  content: true,
  note: true,
  createdById: true,
  createdAt: true,
} satisfies Prisma.AiPromptVersionSelect;
type PromptVersionRow = Prisma.AiPromptVersionGetPayload<{ select: typeof promptVersionSelect }>;

const toPersonality = (p: PersonalityRow): AiPersonality => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  description: p.description,
  tone: p.tone,
  expertise: p.expertise,
  disclosures: p.disclosures,
  voiceId: p.voiceId,
  avatarUrl: p.avatarUrl,
  status: p.status,
  hostId: p.hostId,
  isDemo: p.isDemo,
  personalityPrompt: p.personalityPrompt,
  promptVersion: p.promptVersion,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

const num = (v: bigint | number | null | undefined): number => Number(v ?? 0);
const utcDayStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const isUniqueViolation = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/** Prisma filter for the usage rows a budget covers. */
function scopeWhere(scope: 'global' | 'feature' | 'personality', scopeKey: string): Prisma.AiUsageWhereInput {
  if (scope === 'feature') return { feature: scopeKey };
  if (scope === 'personality') return { personalityId: scopeKey };
  return {};
}

/**
 * AI administration (§16–17, §49): personalities with versioned prompts, usage and cost reporting, budgets and
 * provider status. Prompts are server-side only and readable here solely by holders of `ai.review`.
 */
export function adminAiRouter({ env, prisma }: AdminAiDeps): Router {
  const router = Router();
  const review = requirePermission('ai.review');
  const manageBudgets = requirePermission('ai.review', 'settings.manage');

  const audit = (req: Request, action: string, targetType: string, targetId: string, metadata?: Prisma.InputJsonObject) =>
    writeAudit(prisma, req, { action: `ai.${action}` as const, actorId: getAuth(req).user.id, targetType, targetId, ...(metadata ? { metadata } : {}) });

  /** Editors may draft; only `content.publish` may publish, archive or reject a personality. */
  const assertMayChangeStatus = (req: Request, status: string) => {
    if (AI_PERSONALITY_PUBLISH_STATUSES.has(status) && !getAuth(req).permissions.includes('content.publish')) {
      throw errors.forbidden('Missing permission: content.publish');
    }
  };

  /** Estimated spend and unknown-cost call count for rows matching `where` since `since`. */
  const spendSince = async (where: Prisma.AiUsageWhereInput, since: Date) => {
    const [sum, unknown] = await Promise.all([
      prisma.aiUsage.aggregate({ where: { ...where, createdAt: { gte: since } }, _sum: { costMicros: true } }),
      prisma.aiUsage.count({ where: { ...where, createdAt: { gte: since }, costMicros: null } }),
    ]);
    return { spentMicros: num(sum._sum.costMicros), unknownCostCalls: unknown };
  };

  router.get('/status', review, (_req, res) => {
    const providers = createAiProviders(env);
    const setup: string[] = [];
    if (!providers.llm) setup.push('No text model: set ANTHROPIC_API_KEY or OPENAI_API_KEY (and optionally AI_LLM_PROVIDER, AI_LLM_MODEL, AI_FAST_MODEL).');
    if (!providers.embeddings) setup.push('No embeddings (knowledge search): set OPENAI_API_KEY; AI_EMBEDDING_MODEL chooses the model.');
    if (!providers.transcription) setup.push('No transcription: set OPENAI_API_KEY; AI_TRANSCRIPTION_MODEL chooses the model.');
    const unpriced = [providers.llm?.defaultModel, providers.fastLlm?.defaultModel, providers.embeddings?.model, providers.transcription?.model].filter(
      (m): m is string => typeof m === 'string' && priceFor(providers.pricing, m) === null,
    );
    if (unpriced.length > 0) setup.push(`No price configured for ${[...new Set(unpriced)].join(', ')}: calls are recorded with unknown cost until AI_MODEL_PRICING lists them.`);
    const response: AiStatus = {
      llm: providers.llm ? { provider: providers.llm.name, model: providers.llm.defaultModel } : null,
      fastLlm: providers.fastLlm ? { provider: providers.fastLlm.name, model: providers.fastLlm.defaultModel } : null,
      embeddings: providers.embeddings ? { provider: providers.embeddings.name, model: providers.embeddings.model, dimensions: providers.embeddings.dimensions } : null,
      transcription: providers.transcription ? { provider: providers.transcription.name, model: providers.transcription.model } : null,
      pricedModels: Object.keys(providers.pricing).sort(),
      setup,
    };
    res.json(response);
  });

  // ───── Personalities ─────

  router.get('/personalities', review, async (_req, res) => {
    const rows = await prisma.aiPersonality.findMany({ select: personalitySelect, orderBy: [{ name: 'asc' }], take: 200 });
    res.json({ items: rows.map(toPersonality) });
  });

  router.post('/personalities', review, async (req, res) => {
    const body = validate(aiPersonalityInputSchema, req.body, 'body');
    assertMayChangeStatus(req, body.status);
    const actorId = getAuth(req).user.id;
    let row: PersonalityRow;
    try {
      row = await prisma.aiPersonality.create({
        data: {
          name: body.name,
          slug: body.slug,
          description: body.description ?? null,
          tone: body.tone ?? null,
          expertise: body.expertise,
          disclosures: body.disclosures,
          voiceId: body.voiceId ?? null,
          avatarUrl: body.avatarUrl ?? null,
          status: body.status,
          personalityPrompt: body.personalityPrompt ?? '',
          promptVersion: body.personalityPrompt ? 1 : 0,
          ...(body.personalityPrompt ? { promptVersions: { create: { version: 1, content: body.personalityPrompt, note: 'Initial prompt', createdById: actorId } } } : {}),
        },
        select: personalitySelect,
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw errors.conflict('A personality with that slug already exists');
      throw err;
    }
    await audit(req, 'personality.create', 'ai_personality', row.id, { slug: row.slug, status: row.status, promptVersion: row.promptVersion });
    res.status(201).json(toPersonality(row));
  });

  router.put('/personalities/:id', review, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const body = validate(aiPersonalityInputSchema.omit({ personalityPrompt: true }), req.body, 'body');
    const existing = await prisma.aiPersonality.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw errors.notFound('Personality not found');
    if (body.status !== existing.status) assertMayChangeStatus(req, body.status);
    let row: PersonalityRow;
    try {
      row = await prisma.aiPersonality.update({
        where: { id },
        data: {
          name: body.name,
          slug: body.slug,
          description: body.description ?? null,
          tone: body.tone ?? null,
          expertise: body.expertise,
          disclosures: body.disclosures,
          voiceId: body.voiceId ?? null,
          avatarUrl: body.avatarUrl ?? null,
          status: body.status,
        },
        select: personalitySelect,
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw errors.conflict('A personality with that slug already exists');
      throw err;
    }
    await audit(req, 'personality.update', 'ai_personality', id, { slug: row.slug, status: row.status, previousStatus: existing.status });
    res.json(toPersonality(row));
  });

  /** Writes a new prompt version; earlier versions are kept so stored AI responses stay traceable (§17). */
  router.put('/personalities/:id/prompt', review, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const body = validate(aiPromptInputSchema, req.body, 'body');
    const actorId = getAuth(req).user.id;
    const existing = await prisma.aiPersonality.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw errors.notFound('Personality not found');
    const row = await prisma.$transaction(async (tx) => {
      const latest = await tx.aiPromptVersion.aggregate({ where: { personalityId: id }, _max: { version: true } });
      const version = (latest._max.version ?? 0) + 1;
      await tx.aiPromptVersion.create({ data: { personalityId: id, version, content: body.content, note: body.note ?? null, createdById: actorId } });
      return tx.aiPersonality.update({ where: { id }, data: { personalityPrompt: body.content, promptVersion: version }, select: personalitySelect });
    });
    await audit(req, 'prompt.update', 'ai_personality', id, { promptVersion: row.promptVersion, note: body.note ?? null, length: body.content.length });
    res.json(toPersonality(row));
  });

  router.get('/personalities/:id/prompts', review, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    if (!(await prisma.aiPersonality.findUnique({ where: { id }, select: { id: true } }))) throw errors.notFound('Personality not found');
    const rows: PromptVersionRow[] = await prisma.aiPromptVersion.findMany({ where: { personalityId: id }, select: promptVersionSelect, orderBy: { version: 'desc' }, take: 100 });
    const authorIds = [...new Set(rows.map((r) => r.createdById).filter((v): v is string => v !== null))];
    const authors = authorIds.length
      ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, profile: { select: { displayName: true } } } })
      : [];
    const nameOf = new Map(authors.map((a) => [a.id, a.profile?.displayName ?? null]));
    const items: AiPromptVersion[] = rows.map((r) => ({
      id: r.id,
      version: r.version,
      content: r.content,
      note: r.note,
      createdById: r.createdById,
      createdByName: r.createdById ? (nameOf.get(r.createdById) ?? null) : null,
      createdAt: r.createdAt.toISOString(),
    }));
    res.json({ items });
  });

  // ───── Usage and costs (§49) ─────

  router.get('/usage', review, async (req, res) => {
    const q = validate(aiUsageQuerySchema, req.query, 'query');
    const now = new Date();
    const r = resolveRange(q, now);
    const inRange: Prisma.AiUsageWhereInput = { createdAt: { gte: r.start, lt: r.end } };
    const bucket = { _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true, costMicros: true } } as const;

    const [totals, successes, unknownTotal, audio, daily, byFeature, byFeatureFail, byFeatureUnknown, byModel, byModelFail, byModelUnknown, byPersonality, byPersonalityFail, byPersonalityUnknown, today, month] =
      await Promise.all([
        prisma.aiUsage.aggregate({ where: inRange, ...bucket, _avg: { latencyMs: true } }),
        prisma.aiUsage.count({ where: { ...inRange, success: true } }),
        prisma.aiUsage.count({ where: { ...inRange, costMicros: null } }),
        prisma.aiUsage.aggregate({ where: inRange, _sum: { audioSeconds: true } }),
        prisma.$queryRaw<Array<{ date: string; calls: number; cost: bigint; unknown: number }>>`
          SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
                 count(*)::int AS calls,
                 coalesce(sum(cost_micros), 0)::bigint AS cost,
                 (count(*) FILTER (WHERE cost_micros IS NULL))::int AS unknown
          FROM ai_usage
          WHERE created_at >= ${r.start} AND created_at < ${r.end}
          GROUP BY 1
          ORDER BY 1`,
        prisma.aiUsage.groupBy({ by: ['feature'], where: inRange, ...bucket }),
        prisma.aiUsage.groupBy({ by: ['feature'], where: { ...inRange, success: false }, _count: { _all: true } }),
        prisma.aiUsage.groupBy({ by: ['feature'], where: { ...inRange, costMicros: null }, _count: { _all: true } }),
        prisma.aiUsage.groupBy({ by: ['provider', 'model'], where: inRange, ...bucket }),
        prisma.aiUsage.groupBy({ by: ['provider', 'model'], where: { ...inRange, success: false }, _count: { _all: true } }),
        prisma.aiUsage.groupBy({ by: ['provider', 'model'], where: { ...inRange, costMicros: null }, _count: { _all: true } }),
        prisma.aiUsage.groupBy({ by: ['personalityId'], where: inRange, ...bucket }),
        prisma.aiUsage.groupBy({ by: ['personalityId'], where: { ...inRange, success: false }, _count: { _all: true } }),
        prisma.aiUsage.groupBy({ by: ['personalityId'], where: { ...inRange, costMicros: null }, _count: { _all: true } }),
        spendSince({}, utcDayStart(now)),
        spendSince({}, monthStart(now)),
      ]);

    const personalityIds = byPersonality.map((g) => g.personalityId).filter((v): v is string => v !== null);
    const personalities = personalityIds.length ? await prisma.aiPersonality.findMany({ where: { id: { in: personalityIds } }, select: { id: true, name: true } }) : [];
    const personalityName = new Map(personalities.map((p) => [p.id, p.name]));

    const byDate = new Map(daily.map((d) => [d.date, d]));
    const days: AiUsageReport['daily'] = [];
    for (let t = r.start.getTime(); t < r.end.getTime(); t += DAY_MS) {
      const date = new Date(t).toISOString().slice(0, 10);
      const d = byDate.get(date);
      days.push({ date, calls: d?.calls ?? 0, costMicros: num(d?.cost), unknownCostCalls: d?.unknown ?? 0 });
    }

    type Grouped = { _count: { _all: number }; _sum: { inputTokens: number | null; outputTokens: number | null; costMicros: bigint | null } };
    const fill = (g: Grouped, failures: number, unknown: number): Omit<AiUsageReport['byFeature'][number], 'feature'> => ({
      calls: g._count._all,
      failures,
      inputTokens: num(g._sum.inputTokens),
      outputTokens: num(g._sum.outputTokens),
      costMicros: num(g._sum.costMicros),
      unknownCostCalls: unknown,
    });
    const byCost = <T extends { costMicros: number; calls: number }>(a: T, b: T) => b.costMicros - a.costMicros || b.calls - a.calls;

    const report: AiUsageReport = {
      range: { from: r.from, to: r.to },
      totals: {
        calls: totals._count._all,
        successes,
        failures: totals._count._all - successes,
        inputTokens: num(totals._sum.inputTokens),
        outputTokens: num(totals._sum.outputTokens),
        costMicros: num(totals._sum.costMicros),
        unknownCostCalls: unknownTotal,
        audioSeconds: Math.round(num(audio._sum.audioSeconds) * 10) / 10,
        avgLatencyMs: totals._avg.latencyMs === null ? null : Math.round(totals._avg.latencyMs),
      },
      daily: days,
      byFeature: byFeature
        .map((g) => ({
          feature: g.feature,
          ...fill(g, byFeatureFail.find((f) => f.feature === g.feature)?._count._all ?? 0, byFeatureUnknown.find((f) => f.feature === g.feature)?._count._all ?? 0),
        }))
        .sort(byCost),
      byModel: byModel
        .map((g) => ({
          provider: g.provider,
          model: g.model,
          ...fill(
            g,
            byModelFail.find((f) => f.provider === g.provider && f.model === g.model)?._count._all ?? 0,
            byModelUnknown.find((f) => f.provider === g.provider && f.model === g.model)?._count._all ?? 0,
          ),
        }))
        .sort(byCost),
      byPersonality: byPersonality
        .map((g) => ({
          personalityId: g.personalityId,
          name: g.personalityId === null ? 'No personality' : (personalityName.get(g.personalityId) ?? 'Deleted personality'),
          ...fill(
            g,
            byPersonalityFail.find((f) => f.personalityId === g.personalityId)?._count._all ?? 0,
            byPersonalityUnknown.find((f) => f.personalityId === g.personalityId)?._count._all ?? 0,
          ),
        }))
        .sort(byCost),
      spendTodayMicros: today.spentMicros,
      spendMonthMicros: month.spentMicros,
      unknownCostCallsToday: today.unknownCostCalls,
      unknownCostCallsMonth: month.unknownCostCalls,
    };
    res.json(report);
  });

  // ───── Budgets ─────

  const loadBudgets = async (): Promise<AiBudget[]> => {
    const rows = await prisma.aiBudget.findMany({ orderBy: [{ scope: 'asc' }, { scopeKey: 'asc' }] });
    const since = monthStart(new Date());
    const personalityIds = rows.filter((b) => b.scope === 'personality').map((b) => b.scopeKey);
    const personalities = personalityIds.length ? await prisma.aiPersonality.findMany({ where: { id: { in: personalityIds } }, select: { id: true, name: true } }) : [];
    const personalityName = new Map(personalities.map((p) => [p.id, p.name]));
    return Promise.all(
      rows.map(async (b) => {
        const spend = await spendSince(scopeWhere(b.scope, b.scopeKey), since);
        const limit = Number(b.monthlyLimitMicros);
        return {
          id: b.id,
          scope: b.scope,
          scopeKey: b.scopeKey,
          label: b.scope === 'global' ? 'All AI' : b.scope === 'feature' ? b.scopeKey : (personalityName.get(b.scopeKey) ?? 'Deleted personality'),
          monthlyLimitMicros: limit,
          hardLimit: b.hardLimit,
          spentMicros: spend.spentMicros,
          percentUsed: limit > 0 ? Math.round((spend.spentMicros / limit) * 1000) / 10 : 0,
          unknownCostCalls: spend.unknownCostCalls,
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
        };
      }),
    );
  };

  router.get('/budgets', review, async (_req, res) => {
    res.json({ items: await loadBudgets() });
  });

  router.put('/budgets', manageBudgets, async (req, res) => {
    const body = validate(aiBudgetInputSchema, req.body, 'body');
    if (body.scope === 'personality' && !(await prisma.aiPersonality.findUnique({ where: { id: body.scopeKey }, select: { id: true } }))) {
      throw errors.badRequest('Unknown personality');
    }
    const row = await prisma.aiBudget.upsert({
      where: { scope_scopeKey: { scope: body.scope, scopeKey: body.scopeKey } },
      update: { monthlyLimitMicros: BigInt(body.monthlyLimitMicros), hardLimit: body.hardLimit },
      create: { scope: body.scope, scopeKey: body.scopeKey, monthlyLimitMicros: BigInt(body.monthlyLimitMicros), hardLimit: body.hardLimit },
    });
    await audit(req, 'budget.upsert', 'ai_budget', row.id, { scope: body.scope, scopeKey: body.scopeKey, monthlyLimitMicros: body.monthlyLimitMicros, hardLimit: body.hardLimit });
    const budget = (await loadBudgets()).find((b) => b.id === row.id);
    if (!budget) throw errors.notFound('Budget not found');
    res.json(budget);
  });

  router.delete('/budgets/:id', manageBudgets, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const existing = await prisma.aiBudget.findUnique({ where: { id } });
    if (!existing) throw errors.notFound('Budget not found');
    await prisma.aiBudget.delete({ where: { id } });
    await audit(req, 'budget.delete', 'ai_budget', id, { scope: existing.scope, scopeKey: existing.scopeKey });
    res.status(204).end();
  });

  return router;
}
