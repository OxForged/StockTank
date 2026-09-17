import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { mockApi } from '../../test/mock-api';
import { renderApp } from '../../test/render';

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
  roles: ['editor'],
  permissions,
  createdAt: '2026-01-01T00:00:00.000Z',
});
const editor = user(['content.read_drafts', 'content.publish', 'ai.review']);
const reviewer = user(['ai.review']);

const personality = (over: object = {}) => ({
  id: 'p1',
  slug: 'stocktank-anchor',
  name: 'StockTank Anchor',
  description: 'A professional financial-media host.',
  tone: 'calm, clear',
  expertise: ['markets news', 'show hosting'],
  disclosures: 'AI personality: scripts are AI-generated and reviewed; the voice is synthetic. Informational only.',
  voiceId: 'windows:Microsoft David Desktop',
  avatarUrl: null,
  status: 'published',
  hostId: 'h1',
  isDemo: true,
  personalityPrompt: 'You are StockTank Anchor. Never give investment advice.',
  promptVersion: 2,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
  ...over,
});

describe('AI personalities', { timeout: 30_000 }, () => {
  it('lists personalities with disclosures and status, and saves a new prompt version with history shown', async () => {
    mockApi.auth.me.mockResolvedValue({ user: editor });
    mockApi.admin.ai.listPersonalities.mockResolvedValue([personality(), personality({ id: 'p2', slug: 'draft-bot', name: 'Draft Bot', status: 'draft', promptVersion: 0, personalityPrompt: '', isDemo: false, expertise: [] })]);
    mockApi.admin.ai.listPromptVersions.mockResolvedValue([
      { id: 'v2', version: 2, content: 'You are StockTank Anchor. Never give investment advice.', note: 'Added advice guardrail', createdById: 'u_1', createdByName: 'Eddie Editor', createdAt: '2026-09-10T00:00:00.000Z' },
      { id: 'v1', version: 1, content: 'You are StockTank Anchor.', note: null, createdById: null, createdByName: null, createdAt: '2026-09-01T00:00:00.000Z' },
    ]);
    mockApi.admin.ai.updatePrompt.mockResolvedValue(personality({ promptVersion: 3 }));

    renderApp('/ai/personalities');
    const u = userEvent.setup();
    expect(await screen.findByText('StockTank Anchor')).toBeInTheDocument();
    expect(screen.getByText('DEMO')).toBeInTheDocument();
    expect(screen.getAllByText(/the voice is synthetic/)).toHaveLength(2);
    expect(screen.getByText(/stocktank-anchor · prompt v2/)).toBeInTheDocument();
    expect(screen.getByText(/No prompt written yet/)).toBeInTheDocument();
    // The prompt text itself is never rendered on the list.
    expect(screen.queryByText(/Never give investment advice/)).not.toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Edit prompt for StockTank Anchor' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/^Prompt/)).toHaveValue('You are StockTank Anchor. Never give investment advice.');
    expect(await within(dialog).findByText('Added advice guardrail')).toBeInTheDocument();
    expect(within(dialog).getByText(/Eddie Editor/)).toBeInTheDocument();
    await u.click(within(dialog).getAllByRole('button', { name: 'View' })[1]!);
    expect(within(dialog).getByText('You are StockTank Anchor.')).toBeInTheDocument();

    await u.clear(within(dialog).getByLabelText(/^Prompt/));
    await u.type(within(dialog).getByLabelText(/^Prompt/), 'Version three prompt.');
    await u.type(within(dialog).getByLabelText('Change note'), 'tighter');
    await u.click(within(dialog).getByRole('button', { name: 'Save as version 3' }));
    await waitFor(() => expect(mockApi.admin.ai.updatePrompt).toHaveBeenCalledWith('p1', { content: 'Version three prompt.', note: 'tighter' }));
  });

  it('creates a personality with expertise, disclosures and an initial prompt, keeping publish statuses locked without content.publish', async () => {
    mockApi.auth.me.mockResolvedValue({ user: reviewer });
    mockApi.admin.ai.listPersonalities.mockResolvedValue([]);
    mockApi.admin.ai.savePersonality.mockResolvedValue(personality({ id: 'p9', slug: 'market-morning', name: 'Market Morning', status: 'draft', promptVersion: 1 }));

    renderApp('/ai/personalities');
    const u = userEvent.setup();
    expect(await screen.findByText('No AI personalities yet')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'New personality' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('option', { name: 'published' })).toBeDisabled();
    expect(within(dialog).getByRole('option', { name: 'review' })).toBeEnabled();

    await u.type(within(dialog).getByLabelText(/^Name/), 'Market Morning');
    await u.type(within(dialog).getByLabelText(/^Slug/), 'market-morning');
    await u.type(within(dialog).getByLabelText('Expertise'), 'market news, earnings');
    await u.type(within(dialog).getByLabelText(/^Disclosures/), 'AI personality, disclosed. Informational only.');
    await u.type(within(dialog).getByLabelText('Initial prompt'), 'You are Market Morning.');
    await u.selectOptions(within(dialog).getByLabelText('Status'), 'review');
    await u.click(within(dialog).getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(mockApi.admin.ai.savePersonality).toHaveBeenCalledWith(
        {
          name: 'Market Morning',
          slug: 'market-morning',
          description: null,
          tone: null,
          expertise: ['market news', 'earnings'],
          disclosures: 'AI personality, disclosed. Informational only.',
          voiceId: null,
          avatarUrl: null,
          status: 'review',
          personalityPrompt: 'You are Market Morning.',
        },
        undefined,
      ),
    );
  });
});
