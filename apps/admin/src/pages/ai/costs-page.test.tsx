import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { mockApi } from '../../test/mock-api';
import { renderApp } from '../../test/render';
import { formatMicros } from './costs-page';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

const user = (permissions: string[]) => ({
  id: 'u_1',
  email: 'staff@example.com',
  displayName: 'Staff',
  avatarUrl: null,
  roles: ['admin'],
  permissions,
  createdAt: '2026-01-01T00:00:00.000Z',
});
const admin = user(['ai.review', 'settings.manage']);
const editor = user(['ai.review']);

const bucket = { calls: 3, failures: 1, inputTokens: 110, outputTokens: 50, costMicros: 4000, unknownCostCalls: 1 };
const report = {
  range: { from: '2026-08-19', to: '2026-09-17' },
  totals: { ...bucket, successes: 2, audioSeconds: 30, avgLatencyMs: 233 },
  daily: [
    { date: '2026-09-15', calls: 0, costMicros: 0, unknownCostCalls: 0 },
    { date: '2026-09-16', calls: 1, costMicros: 1500, unknownCostCalls: 0 },
    { date: '2026-09-17', calls: 2, costMicros: 2500, unknownCostCalls: 1 },
  ],
  byFeature: [
    { feature: 'transcription', calls: 1, failures: 0, inputTokens: 0, outputTokens: 0, costMicros: 2500, unknownCostCalls: 0 },
    { feature: 'content_factory', calls: 1, failures: 1, inputTokens: 10, outputTokens: 0, costMicros: 0, unknownCostCalls: 1 },
  ],
  byModel: [{ provider: 'openai', model: 'whisper-1', calls: 1, failures: 0, inputTokens: 0, outputTokens: 0, costMicros: 2500, unknownCostCalls: 0 }],
  byPersonality: [{ personalityId: 'p1', name: 'StockTank Anchor', calls: 1, failures: 0, inputTokens: 100, outputTokens: 50, costMicros: 1500, unknownCostCalls: 0 }],
  spendTodayMicros: 2500,
  spendMonthMicros: 4000,
  unknownCostCallsToday: 1,
  unknownCostCallsMonth: 1,
};
const budget = (over: object = {}) => ({
  id: 'b1',
  scope: 'global',
  scopeKey: '',
  label: 'All AI',
  monthlyLimitMicros: 10_000,
  hardLimit: true,
  spentMicros: 4000,
  percentUsed: 40,
  unknownCostCalls: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});
const status = {
  llm: null,
  fastLlm: null,
  embeddings: { provider: 'openai', model: 'text-embedding-3-small', dimensions: 1024 },
  transcription: { provider: 'openai', model: 'whisper-1' },
  pricedModels: ['claude-haiku-4-5', 'whisper-1'],
  setup: ['No text model: set ANTHROPIC_API_KEY or OPENAI_API_KEY (and optionally AI_LLM_PROVIDER, AI_LLM_MODEL, AI_FAST_MODEL).'],
};

describe('AI usage & costs', { timeout: 30_000 }, () => {
  it('formats micro-dollars without rounding small costs to zero', () => {
    expect(formatMicros(0)).toBe('$0.00');
    expect(formatMicros(1500)).toBe('$0.0015');
    expect(formatMicros(4_000_000)).toBe('$4.00');
    expect(formatMicros(12_345_678)).toBe('$12.35');
  });

  it('shows spend, unknown-cost warnings, breakdowns, budget progress and provider setup hints', async () => {
    mockApi.auth.me.mockResolvedValue({ user: editor });
    mockApi.admin.ai.usage.mockResolvedValue(report);
    mockApi.admin.ai.listBudgets.mockResolvedValue([budget(), budget({ id: 'b2', scope: 'feature', scopeKey: 'personality_chat', label: 'personality_chat', monthlyLimitMicros: 1000, spentMicros: 1500, percentUsed: 150, hardLimit: false, unknownCostCalls: 0 })]);
    mockApi.admin.ai.status.mockResolvedValue(status);

    renderApp('/ai/costs');
    expect(await screen.findByText('Spend today')).toBeInTheDocument();
    expect(screen.getByText(/1 calls this month have unknown cost/)).toBeInTheDocument();
    expect(await screen.findAllByText('$0.0040')).not.toHaveLength(0);
    expect(screen.getByText(/2 ok · 1 failed/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Estimated AI cost per day' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'AI calls per day' })).toBeInTheDocument();
    expect(screen.getByText('content factory')).toBeInTheDocument();
    expect(screen.getByText('(1 failed)')).toBeInTheDocument();
    expect(screen.getByText('StockTank Anchor')).toBeInTheDocument();

    expect(screen.getByRole('progressbar', { name: 'All AI budget used' })).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByRole('progressbar', { name: 'personality_chat budget used' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('over budget')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add budget' })).not.toBeInTheDocument();
    expect(screen.getByText(/Changing budgets needs settings.manage/)).toBeInTheDocument();

    expect(screen.getByText(/set ANTHROPIC_API_KEY or OPENAI_API_KEY/)).toBeInTheDocument();
    expect(screen.getAllByText('not configured')).toHaveLength(2);
    // Model table row and the provider status card both name the transcription model.
    expect(screen.getAllByText(/openai · whisper-1/)).toHaveLength(2);
    expect(screen.getByText(/1024 dims/)).toBeInTheDocument();
    expect(await screen.findAllByText(/\$0\.0025/)).not.toHaveLength(0);
  });

  it('lets settings.manage holders add a feature budget in dollars and delete one', async () => {
    mockApi.auth.me.mockResolvedValue({ user: admin });
    mockApi.admin.ai.usage.mockResolvedValue(report);
    mockApi.admin.ai.listBudgets.mockResolvedValue([budget()]);
    mockApi.admin.ai.status.mockResolvedValue(status);
    mockApi.admin.ai.saveBudget.mockResolvedValue(budget({ id: 'b3', scope: 'feature', scopeKey: 'transcription', label: 'transcription', monthlyLimitMicros: 25_000_000, hardLimit: false }));
    mockApi.admin.ai.deleteBudget.mockResolvedValue(undefined);

    renderApp('/ai/costs');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Add budget' }));
    const dialog = await screen.findByRole('dialog');
    await u.selectOptions(within(dialog).getByLabelText('Scope'), 'feature');
    await u.selectOptions(within(dialog).getByLabelText('Feature'), 'transcription');
    await u.type(within(dialog).getByLabelText(/Monthly limit/), '25');
    await u.click(within(dialog).getByLabelText(/Hard limit/));
    await u.click(within(dialog).getByRole('button', { name: 'Save budget' }));
    await waitFor(() => expect(mockApi.admin.ai.saveBudget).toHaveBeenCalledWith({ scope: 'feature', scopeKey: 'transcription', monthlyLimitMicros: 25_000_000, hardLimit: false }));

    await u.click(screen.getByRole('button', { name: 'Delete budget All AI' }));
    await waitFor(() => expect(mockApi.admin.ai.deleteBudget).toHaveBeenCalledWith('b1'));
  });
});
