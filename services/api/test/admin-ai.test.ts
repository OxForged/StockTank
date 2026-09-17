import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { aiBudgetListSchema, aiBudgetSchema, aiPersonalityListSchema, aiPersonalitySchema, aiPromptVersionListSchema, aiStatusSchema, aiUsageReportSchema } from '@stocktank/types';
import { hashPassword } from '../src/lib/crypto.js';
import { CSRF_HEADERS, PASSWORD, createTestContext, loginAs, resetDb, seedUser, type TestContext } from './helpers.js';

const AI = '/api/v1/admin/ai';
const DAY_MS = 86_400_000;
const REVIEWER_ROLE = 'test_ai_reviewer';

describe('AI administration: personalities, prompts, usage, budgets, status', () => {
  let ctx: TestContext;
  let editor: string;
  let admin: string;
  let creator: string;
  /** Holds `ai.review` only (no `content.publish`, no `settings.manage`). */
  let reviewer: string;

  const as = (cookie: string) => ({
    get: (url: string) => request(ctx.app).get(url).set('Cookie', cookie),
    post: (url: string, body: object = {}) => request(ctx.app).post(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body),
    put: (url: string, body: object) => request(ctx.app).put(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body),
    delete: (url: string) => request(ctx.app).delete(url).set('Cookie', cookie).set(CSRF_HEADERS),
  });

  const personalityInput = {
    name: 'Market Morning',
    slug: 'market-morning',
    description: 'Daily market-news personality.',
    tone: 'brisk, factual',
    expertise: ['market news', 'earnings'],
    disclosures: 'AI personality: scripts are AI-generated and reviewed by editors; the voice is synthetic. Informational only.',
    voiceId: null,
    avatarUrl: null,
    status: 'draft',
    personalityPrompt: 'You are Market Morning. Summarise the day from the provided sources only. Never give investment advice.',
  };

  async function resetAi() {
    await ctx.prisma.aiUsage.deleteMany({});
    await ctx.prisma.aiBudget.deleteMany({});
    await ctx.prisma.aiPersonality.deleteMany({});
  }

  beforeAll(async () => {
    ctx = await createTestContext({ redis: false, envOverrides: { ANTHROPIC_API_KEY: undefined, OPENAI_API_KEY: undefined, AI_LLM_PROVIDER: undefined } });
    const permission = await ctx.prisma.permission.findUniqueOrThrow({ where: { key: 'ai.review' }, select: { id: true } });
    await ctx.prisma.role.upsert({
      where: { key: REVIEWER_ROLE },
      update: {},
      create: { key: REVIEWER_ROLE, name: 'Test AI reviewer', permissions: { create: [{ permissionId: permission.id }] } },
    });
  });
  beforeEach(async () => {
    await resetAi();
    await resetDb(ctx.prisma);
    await seedUser(ctx.prisma, { email: 'editor@example.com', roles: ['editor'], displayName: 'Eddie Editor' });
    await seedUser(ctx.prisma, { email: 'admin@example.com', roles: ['admin'] });
    await seedUser(ctx.prisma, { email: 'creator@example.com', roles: ['creator'] });
    const role = await ctx.prisma.role.findUniqueOrThrow({ where: { key: REVIEWER_ROLE }, select: { id: true } });
    await ctx.prisma.user.create({
      data: { email: 'reviewer@example.com', passwordHash: await hashPassword(PASSWORD), status: 'active', profile: { create: { displayName: 'Rae Reviewer' } }, roles: { create: [{ roleId: role.id }] } },
    });
    editor = await loginAs(ctx.app, 'editor@example.com');
    admin = await loginAs(ctx.app, 'admin@example.com');
    creator = await loginAs(ctx.app, 'creator@example.com');
    reviewer = await loginAs(ctx.app, 'reviewer@example.com');
  });
  afterAll(async () => {
    await resetAi();
    await resetDb(ctx.prisma);
    await ctx.prisma.role.deleteMany({ where: { key: REVIEWER_ROLE } });
    await ctx.close();
  });

  describe('permissions', () => {
    it('requires a session and ai.review to read anything', async () => {
      expect((await request(ctx.app).get(`${AI}/personalities`)).status).toBe(401);
      for (const url of [`${AI}/personalities`, `${AI}/usage`, `${AI}/budgets`, `${AI}/status`]) {
        const res = await as(creator).get(url);
        expect(res.status, url).toBe(403);
        expect(res.body.error.message).toContain('ai.review');
      }
      expect((await as(reviewer).get(`${AI}/personalities`)).status).toBe(200);
    });

    it('lets ai.review holders draft but only content.publish holders publish, archive or reject', async () => {
      const created = await as(reviewer).post(`${AI}/personalities`, personalityInput);
      expect(created.status).toBe(201);
      const id = created.body.id as string;
      const { personalityPrompt: _p, ...update } = personalityInput;

      const denied = await as(reviewer).put(`${AI}/personalities/${id}`, { ...update, status: 'published' });
      expect(denied.status).toBe(403);
      expect(denied.body.error.message).toContain('content.publish');
      expect((await as(reviewer).post(`${AI}/personalities`, { ...personalityInput, slug: 'other', status: 'archived' })).status).toBe(403);

      expect((await as(reviewer).put(`${AI}/personalities/${id}`, { ...update, status: 'review' })).status).toBe(200);
      const published = await as(editor).put(`${AI}/personalities/${id}`, { ...update, status: 'published' });
      expect(published.status).toBe(200);
      expect(published.body.status).toBe('published');
      // Re-saving an already published personality without changing its status needs no publish right.
      expect((await as(reviewer).put(`${AI}/personalities/${id}`, { ...update, status: 'published', tone: 'calm' })).status).toBe(200);
    });

    it('needs settings.manage to change budgets, ai.review to read them', async () => {
      const budget = { scope: 'global', scopeKey: '', monthlyLimitMicros: 5_000_000, hardLimit: true };
      expect((await as(editor).put(`${AI}/budgets`, budget)).status).toBe(403);
      expect((await as(reviewer).put(`${AI}/budgets`, budget)).status).toBe(403);
      const saved = await as(admin).put(`${AI}/budgets`, budget);
      expect(saved.status).toBe(200);
      expect((await as(reviewer).get(`${AI}/budgets`)).body.items).toHaveLength(1);
      expect((await as(editor).delete(`${AI}/budgets/${saved.body.id}`)).status).toBe(403);
      expect((await as(admin).delete(`${AI}/budgets/${saved.body.id}`)).status).toBe(204);
    });
  });

  describe('personalities and prompt versions', () => {
    it('creates with an initial prompt as version 1, validates input and rejects duplicate slugs', async () => {
      const created = await as(editor).post(`${AI}/personalities`, personalityInput);
      expect(created.status).toBe(201);
      const body = aiPersonalitySchema.parse(created.body);
      expect(body).toMatchObject({ slug: 'market-morning', promptVersion: 1, personalityPrompt: personalityInput.personalityPrompt, expertise: ['market news', 'earnings'], isDemo: false });
      const list = aiPersonalityListSchema.parse((await as(editor).get(`${AI}/personalities`)).body);
      expect(list.items.map((p) => p.id)).toEqual([body.id]);

      expect((await as(editor).post(`${AI}/personalities`, personalityInput)).status).toBe(409);
      expect((await as(editor).post(`${AI}/personalities`, { ...personalityInput, slug: 'Bad Slug' })).status).toBe(400);
      expect((await as(editor).post(`${AI}/personalities`, { ...personalityInput, slug: 'x2', disclosures: 'short' })).status).toBe(400);

      const audit = await ctx.prisma.auditLog.findMany({ where: { action: 'ai.personality.create' } });
      expect(audit).toHaveLength(1);
      expect(audit[0]?.targetId).toBe(body.id);
    });

    it('starts at version 0 without a prompt, then numbers versions from 1 and keeps every version', async () => {
      const { personalityPrompt: _p, ...noPrompt } = personalityInput;
      const created = await as(editor).post(`${AI}/personalities`, noPrompt);
      expect(created.status).toBe(201);
      expect(created.body.promptVersion).toBe(0);
      expect(created.body.personalityPrompt).toBe('');
      const id = created.body.id as string;
      expect((await as(editor).get(`${AI}/personalities/${id}/prompts`)).body.items).toEqual([]);

      const v1 = await as(editor).put(`${AI}/personalities/${id}/prompt`, { content: 'Prompt one.', note: 'first draft' });
      expect(v1.status).toBe(200);
      expect(v1.body).toMatchObject({ promptVersion: 1, personalityPrompt: 'Prompt one.' });
      const v2 = await as(reviewer).put(`${AI}/personalities/${id}/prompt`, { content: 'Prompt two.' });
      expect(v2.body).toMatchObject({ promptVersion: 2, personalityPrompt: 'Prompt two.' });
      expect((await as(editor).put(`${AI}/personalities/${id}/prompt`, { content: '' })).status).toBe(400);
      expect((await as(editor).put(`${AI}/personalities/nope/prompt`, { content: 'x' })).status).toBe(404);

      const versions = aiPromptVersionListSchema.parse((await as(editor).get(`${AI}/personalities/${id}/prompts`)).body);
      expect(versions.items.map((v) => [v.version, v.content, v.note, v.createdByName])).toEqual([
        [2, 'Prompt two.', null, 'Rae Reviewer'],
        [1, 'Prompt one.', 'first draft', 'Eddie Editor'],
      ]);
      const stored = await ctx.prisma.aiPersonality.findUniqueOrThrow({ where: { id }, select: { personalityPrompt: true, promptVersion: true } });
      expect(stored).toEqual({ personalityPrompt: 'Prompt two.', promptVersion: 2 });
      const audits = await ctx.prisma.auditLog.findMany({ where: { action: 'ai.prompt.update' }, orderBy: { createdAt: 'asc' } });
      expect(audits.map((a) => (a.metadata as { promptVersion: number }).promptVersion)).toEqual([1, 2]);
    });

    it('updates fields without touching the prompt', async () => {
      const created = await as(editor).post(`${AI}/personalities`, personalityInput);
      const id = created.body.id as string;
      const res = await as(editor).put(`${AI}/personalities/${id}`, { ...personalityInput, name: 'Market Morning 2', slug: 'market-morning-2', expertise: [], personalityPrompt: 'ignored' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: 'Market Morning 2', slug: 'market-morning-2', expertise: [], promptVersion: 1, personalityPrompt: personalityInput.personalityPrompt });
      expect((await as(editor).put(`${AI}/personalities/missing`, personalityInput)).status).toBe(404);
    });
  });

  describe('usage and costs', () => {
    let personalityId: string;
    beforeEach(async () => {
      const p = await ctx.prisma.aiPersonality.create({ data: { slug: 'anchor', name: 'StockTank Anchor', disclosures: 'AI personality, disclosed.', personalityPrompt: 'p' } });
      personalityId = p.id;
      const now = new Date();
      const rows = [
        { feature: 'personality_chat', provider: 'anthropic', model: 'claude-haiku-4-5', personalityId, inputTokens: 100, outputTokens: 50, costMicros: 1500n, latencyMs: 200, success: true, createdAt: now },
        { feature: 'transcription', provider: 'openai', model: 'whisper-1', audioSeconds: 30, costMicros: 2500n, latencyMs: 400, success: true, createdAt: now },
        { feature: 'content_factory', provider: 'openai', model: 'gpt-4o', inputTokens: 10, costMicros: null, latencyMs: 100, success: false, error: 'boom', createdAt: now },
        { feature: 'personality_chat', provider: 'anthropic', model: 'claude-haiku-4-5', personalityId, inputTokens: 1000, outputTokens: 500, costMicros: 99_999n, latencyMs: 300, success: true, createdAt: new Date(now.getTime() - 40 * DAY_MS) },
      ];
      await ctx.prisma.aiUsage.createMany({ data: rows });
    });

    it('sums the last 30 days by default, separates unknown-cost calls, and reports spend today and this month', async () => {
      const res = await as(editor).get(`${AI}/usage`);
      expect(res.status).toBe(200);
      const report = aiUsageReportSchema.parse(res.body);
      expect(report.totals).toEqual({ calls: 3, successes: 2, failures: 1, inputTokens: 110, outputTokens: 50, costMicros: 4000, unknownCostCalls: 1, audioSeconds: 30, avgLatencyMs: 233 });
      expect(report.spendTodayMicros).toBe(4000);
      expect(report.spendMonthMicros).toBe(4000);
      expect(report.unknownCostCallsToday).toBe(1);
      expect(report.unknownCostCallsMonth).toBe(1);

      expect(report.daily).toHaveLength(30);
      expect(report.daily.at(-1)).toEqual({ date: new Date().toISOString().slice(0, 10), calls: 3, costMicros: 4000, unknownCostCalls: 1 });
      expect(report.daily.slice(0, -1).every((d) => d.calls === 0 && d.costMicros === 0)).toBe(true);

      expect(report.byFeature).toEqual([
        { feature: 'transcription', calls: 1, failures: 0, inputTokens: 0, outputTokens: 0, costMicros: 2500, unknownCostCalls: 0 },
        { feature: 'personality_chat', calls: 1, failures: 0, inputTokens: 100, outputTokens: 50, costMicros: 1500, unknownCostCalls: 0 },
        { feature: 'content_factory', calls: 1, failures: 1, inputTokens: 10, outputTokens: 0, costMicros: 0, unknownCostCalls: 1 },
      ]);
      expect(report.byModel.map((m) => [m.provider, m.model, m.costMicros, m.unknownCostCalls])).toEqual([
        ['openai', 'whisper-1', 2500, 0],
        ['anthropic', 'claude-haiku-4-5', 1500, 0],
        ['openai', 'gpt-4o', 0, 1],
      ]);
      expect(report.byPersonality.map((p) => [p.personalityId, p.name, p.calls, p.costMicros, p.unknownCostCalls])).toEqual([
        [null, 'No personality', 2, 2500, 1],
        [personalityId, 'StockTank Anchor', 1, 1500, 0],
      ]);
    });

    it('accepts an explicit range and rejects bad ranges', async () => {
      const from = new Date(Date.now() - 45 * DAY_MS).toISOString().slice(0, 10);
      const to = new Date().toISOString().slice(0, 10);
      const report = aiUsageReportSchema.parse((await as(editor).get(`${AI}/usage?from=${from}&to=${to}`)).body);
      expect(report.totals.calls).toBe(4);
      expect(report.totals.costMicros).toBe(103_999);
      expect(report.daily).toHaveLength(46);
      expect(report.byPersonality.find((p) => p.personalityId === personalityId)).toMatchObject({ calls: 2, inputTokens: 1100, costMicros: 101_499 });
      expect((await as(editor).get(`${AI}/usage?from=2026-09-10&to=2026-09-01`)).status).toBe(400);
      expect((await as(editor).get(`${AI}/usage?from=nope`)).status).toBe(400);
    });

    it('returns empty-but-complete numbers when nothing was recorded', async () => {
      await ctx.prisma.aiUsage.deleteMany({});
      const report = aiUsageReportSchema.parse((await as(editor).get(`${AI}/usage`)).body);
      expect(report.totals).toEqual({ calls: 0, successes: 0, failures: 0, inputTokens: 0, outputTokens: 0, costMicros: 0, unknownCostCalls: 0, audioSeconds: 0, avgLatencyMs: null });
      expect(report.byFeature).toEqual([]);
      expect(report.spendMonthMicros).toBe(0);
    });

    it('upserts budgets by scope and key and reports spend and percent used', async () => {
      const global = aiBudgetSchema.parse((await as(admin).put(`${AI}/budgets`, { scope: 'global', scopeKey: '', monthlyLimitMicros: 10_000, hardLimit: true })).body);
      expect(global).toMatchObject({ scope: 'global', scopeKey: '', label: 'All AI', monthlyLimitMicros: 10_000, spentMicros: 4000, percentUsed: 40, unknownCostCalls: 1, hardLimit: true });

      const feature = aiBudgetSchema.parse((await as(admin).put(`${AI}/budgets`, { scope: 'feature', scopeKey: 'personality_chat', monthlyLimitMicros: 3000, hardLimit: false })).body);
      expect(feature).toMatchObject({ label: 'personality_chat', spentMicros: 1500, percentUsed: 50, unknownCostCalls: 0, hardLimit: false });

      const personality = aiBudgetSchema.parse((await as(admin).put(`${AI}/budgets`, { scope: 'personality', scopeKey: personalityId, monthlyLimitMicros: 1_000, hardLimit: true })).body);
      expect(personality).toMatchObject({ label: 'StockTank Anchor', spentMicros: 1500, percentUsed: 150 });

      const again = aiBudgetSchema.parse((await as(admin).put(`${AI}/budgets`, { scope: 'global', scopeKey: '', monthlyLimitMicros: 20_000, hardLimit: true })).body);
      expect(again.id).toBe(global.id);
      expect(again.percentUsed).toBe(20);

      const list = aiBudgetListSchema.parse((await as(editor).get(`${AI}/budgets`)).body);
      expect(list.items).toHaveLength(3);
      expect(await ctx.prisma.aiBudget.count()).toBe(3);

      expect((await as(admin).put(`${AI}/budgets`, { scope: 'feature', scopeKey: 'not_a_feature', monthlyLimitMicros: 1 })).status).toBe(400);
      expect((await as(admin).put(`${AI}/budgets`, { scope: 'global', scopeKey: 'x', monthlyLimitMicros: 1 })).status).toBe(400);
      expect((await as(admin).put(`${AI}/budgets`, { scope: 'personality', scopeKey: 'missing', monthlyLimitMicros: 1 })).status).toBe(400);
      expect((await as(admin).put(`${AI}/budgets`, { scope: 'global', scopeKey: '', monthlyLimitMicros: 0 })).status).toBe(400);

      expect((await as(admin).delete(`${AI}/budgets/${feature.id}`)).status).toBe(204);
      expect((await as(admin).delete(`${AI}/budgets/${feature.id}`)).status).toBe(404);
      expect((await as(editor).get(`${AI}/budgets`)).body.items).toHaveLength(2);
      const actions = (await ctx.prisma.auditLog.findMany({ where: { action: { startsWith: 'ai.budget.' } } })).map((a) => a.action).sort();
      expect(actions).toEqual(['ai.budget.delete', 'ai.budget.upsert', 'ai.budget.upsert', 'ai.budget.upsert', 'ai.budget.upsert']);
    });
  });

  describe('provider status', () => {
    it('reports nothing configured and names the variables to set, without leaking keys', async () => {
      const res = await as(editor).get(`${AI}/status`);
      expect(res.status).toBe(200);
      const status = aiStatusSchema.parse(res.body);
      expect(status).toMatchObject({ llm: null, fastLlm: null, embeddings: null, transcription: null });
      expect(status.pricedModels).toContain('claude-haiku-4-5');
      expect(status.setup.join(' ')).toContain('ANTHROPIC_API_KEY');
      expect(status.setup.join(' ')).toContain('AI_TRANSCRIPTION_MODEL');
    });

    it('describes configured providers by name and model only', async () => {
      const secret = 'sk-ant-test-secret-value';
      const other = await createTestContext({ redis: false, envOverrides: { ANTHROPIC_API_KEY: secret, OPENAI_API_KEY: 'sk-openai-test', AI_LLM_PROVIDER: undefined, AI_LLM_MODEL: 'claude-sonnet-5' } });
      try {
        const cookie = await loginAs(other.app, 'editor@example.com');
        const res = await request(other.app).get(`${AI}/status`).set('Cookie', cookie);
        const status = aiStatusSchema.parse(res.body);
        expect(status.llm).toEqual({ provider: 'anthropic', model: 'claude-sonnet-5' });
        expect(status.fastLlm).toEqual({ provider: 'anthropic', model: 'claude-haiku-4-5' });
        expect(status.embeddings).toEqual({ provider: 'openai', model: 'text-embedding-3-small', dimensions: 1024 });
        expect(status.transcription).toEqual({ provider: 'openai', model: 'whisper-1' });
        expect(status.setup.join(' ')).toContain('claude-sonnet-5');
        expect(JSON.stringify(res.body)).not.toContain(secret);
        expect(JSON.stringify(res.body)).not.toContain('sk-openai-test');
      } finally {
        await other.close();
      }
    });
  });
});
