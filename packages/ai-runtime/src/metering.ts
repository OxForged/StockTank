import { AIOutputError, AIProviderError, estimateCostMicros, type ModelPricing, type Usage } from '@stocktank/ai';
import type { Prisma, PrismaClient } from '@stocktank/database';
import type { AiFeature } from '@stocktank/types';

export { AI_FEATURES, type AiFeature } from '@stocktank/types';

export class AiBudgetExceededError extends Error {
  constructor(
    readonly scope: 'global' | 'feature' | 'personality',
    readonly scopeKey: string,
    readonly limitMicros: bigint,
    readonly spentMicros: bigint,
  ) {
    super(`AI budget reached for ${scope}${scopeKey ? ` "${scopeKey}"` : ''}: spent $${(Number(spentMicros) / 1e6).toFixed(2)} of $${(Number(limitMicros) / 1e6).toFixed(2)} this month`);
    this.name = 'AiBudgetExceededError';
  }
}

export interface MeterContext {
  feature: AiFeature;
  personalityId?: string | null;
}

export interface MeteredCall<T> {
  result: T;
  provider: string;
  model: string;
  usage?: Usage;
  audioSeconds?: number;
}

export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Records every AI call (§49) and enforces monthly budgets before spending. Calls whose model has no configured
 * price are recorded with unknown cost; they still count against nothing, which the cost dashboard flags.
 */
export class AiMeter {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly pricing: ModelPricing,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async assertWithinBudget(ctx: MeterContext): Promise<void> {
    const scopes: Prisma.AiBudgetWhereInput[] = [{ scope: 'global', scopeKey: '' }, { scope: 'feature', scopeKey: ctx.feature }];
    if (ctx.personalityId) scopes.push({ scope: 'personality', scopeKey: ctx.personalityId });
    const budgets = await this.prisma.aiBudget.findMany({ where: { hardLimit: true, OR: scopes } });
    if (budgets.length === 0) return;
    const since = monthStart(this.now());
    for (const budget of budgets) {
      const where: Prisma.AiUsageWhereInput = {
        createdAt: { gte: since },
        ...(budget.scope === 'feature' ? { feature: budget.scopeKey } : budget.scope === 'personality' ? { personalityId: budget.scopeKey } : {}),
      };
      const agg = await this.prisma.aiUsage.aggregate({ where, _sum: { costMicros: true } });
      const spent = agg._sum.costMicros ?? 0n;
      if (spent >= budget.monthlyLimitMicros) throw new AiBudgetExceededError(budget.scope, budget.scopeKey, budget.monthlyLimitMicros, spent);
    }
  }

  /** Checks budgets, runs the call, and records usage for both success and failure. */
  async run<T>(ctx: MeterContext, call: () => Promise<MeteredCall<T>>, fallback: { provider: string; model: string }): Promise<T> {
    await this.assertWithinBudget(ctx);
    const started = Date.now();
    try {
      const out = await call();
      const costMicros = estimateCostMicros(this.pricing, out.model, { ...out.usage, audioSeconds: out.audioSeconds });
      await this.prisma.aiUsage.create({
        data: {
          feature: ctx.feature,
          provider: out.provider,
          model: out.model,
          personalityId: ctx.personalityId ?? null,
          inputTokens: out.usage?.inputTokens ?? 0,
          outputTokens: out.usage?.outputTokens ?? 0,
          audioSeconds: out.audioSeconds ?? null,
          costMicros: costMicros === null ? null : BigInt(costMicros),
          latencyMs: Date.now() - started,
          success: true,
        },
      });
      return out.result;
    } catch (err) {
      const message = err instanceof AIProviderError || err instanceof AIOutputError ? err.message : err instanceof Error ? err.message : 'AI call failed';
      await this.prisma.aiUsage
        .create({
          data: {
            feature: ctx.feature,
            provider: err instanceof AIProviderError || err instanceof AIOutputError ? err.provider : fallback.provider,
            model: fallback.model,
            personalityId: ctx.personalityId ?? null,
            costMicros: null,
            latencyMs: Date.now() - started,
            success: false,
            error: message.slice(0, 500),
          },
        })
        .catch(() => undefined);
      throw err;
    }
  }
}
