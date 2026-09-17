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

const editor = { id: 'u_1', email: 'editor@example.com', displayName: 'Editor', avatarUrl: null, roles: ['editor'], permissions: ['ai.review', 'content.publish', 'content.read_drafts'], createdAt: '2026-01-01T00:00:00.000Z' };

const draft = (over: object = {}) => ({
  id: 'd1',
  episodeId: 'e1',
  episodeTitle: 'What is a tokenized treasury?',
  showTitle: 'AI Desk',
  kind: 'summary',
  status: 'review',
  content: { summary: 'The hosts explain tokenized treasuries and you should buy them today.' },
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  promptVersion: '2026-09-17.1',
  citations: [{ start: 4, end: 12, quote: 'A tokenized treasury is a token' }],
  moderationFlags: ['investment_advice'],
  reviewer: null,
  reviewNote: null,
  reviewedAt: null,
  appliedAt: null,
  createdAt: '2026-09-17T10:00:00.000Z',
  ...over,
});

describe('AI review queue and jobs', { timeout: 30_000 }, () => {
  it('requires flags to be acknowledged, supports edits, and approves', async () => {
    mockApi.auth.me.mockResolvedValue({ user: editor });
    mockApi.admin.aiFactory.moderationFlags.mockResolvedValue([{ key: 'investment_advice', label: 'Reads as personal investment advice' }]);
    mockApi.admin.aiFactory.drafts.mockResolvedValue({ items: [draft()], page: 1, pageSize: 100, total: 1 });
    mockApi.admin.aiFactory.review.mockResolvedValue(draft({ status: 'approved', reviewer: { id: 'u_1', displayName: 'Editor' } }));

    renderApp('/ai/review');
    const user = userEvent.setup();
    expect(await screen.findByText(/1 flag$/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Reads as personal investment advice')).toBeInTheDocument();
    expect(within(dialog).getByText(/1 transcript citation/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('checkbox', { name: /investment advice/i }));
    await user.click(within(dialog).getByRole('button', { name: /edit before approving/i }));
    const editor$ = within(dialog).getByLabelText(/edited content/i);
    await user.clear(editor$);
    await user.type(editor$, '{{"summary": "The hosts explain what tokenized treasuries are and the risks to check."}');
    await user.type(within(dialog).getByLabelText('Review note'), 'Removed advice');
    await user.click(within(dialog).getByRole('button', { name: /approve/i }));
    await waitFor(() =>
      expect(mockApi.admin.aiFactory.review).toHaveBeenCalledWith('d1', {
        decision: 'approve',
        note: 'Removed advice',
        acknowledgedFlags: ['investment_advice'],
        content: { summary: 'The hosts explain what tokenized treasuries are and the risks to check.' },
      }),
    );
  });

  it('hides Review for staff without content.publish and shows other kinds readably', async () => {
    mockApi.auth.me.mockResolvedValue({ user: { ...editor, permissions: ['ai.review'] } });
    mockApi.admin.aiFactory.moderationFlags.mockResolvedValue([]);
    mockApi.admin.aiFactory.drafts.mockResolvedValue({
      items: [draft({ id: 'd2', kind: 'clip_candidates', moderationFlags: [], content: { candidates: [{ title: 'The squeeze', start: 65, end: 95, targetSeconds: 30, reason: 'strong_statement', transcript: 'verbatim words', confidence: 0.81 }] } })],
      page: 1,
      pageSize: 100,
      total: 1,
    });
    renderApp('/ai/review');
    expect(await screen.findByText('The squeeze')).toBeInTheDocument();
    expect(screen.getByText(/1:05–1:35/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review' })).not.toBeInTheDocument();
  });

  it('transcribes and runs the factory for a chosen episode', async () => {
    mockApi.auth.me.mockResolvedValue({ user: editor });
    mockApi.admin.aiFactory.jobs.mockResolvedValue([{ id: 'j1', type: 'transcribe', status: 'succeeded', episodeId: 'e1', episodeTitle: 'Episode One', kinds: [], error: null, startedAt: '2026-09-17T10:00:00.000Z', finishedAt: '2026-09-17T10:02:00.000Z', createdAt: '2026-09-17T09:59:00.000Z' }]);
    mockApi.admin.content.listEpisodes.mockResolvedValue({ items: [{ id: 'e1', slug: 'ep', title: 'Episode One', show: { slug: 's', title: 'The Tank' } }], page: 1, pageSize: 100, total: 1 });
    mockApi.admin.aiFactory.transcript.mockResolvedValue({ episodeId: 'e1', status: 'ready', provider: 'openai', model: 'whisper-1', language: 'english', text: 'Hello', segments: [{ start: 0, end: 2, text: 'Hello', speaker: null, confidence: 0.9 }], speakers: [], confidence: 0.9, durationSeconds: 2, error: null, updatedAt: '2026-09-17T10:02:00.000Z' });
    mockApi.admin.aiFactory.runFactory.mockResolvedValue({ id: 'j2', type: 'content_factory', status: 'queued', episodeId: 'e1', episodeTitle: 'Episode One', kinds: ['summary'], error: null, startedAt: null, finishedAt: null, createdAt: '2026-09-17T10:05:00.000Z' });

    renderApp('/ai/jobs');
    const user = userEvent.setup();
    expect(await screen.findByText('transcribe')).toBeInTheDocument(); // job type in table (humanized)
    await user.selectOptions(screen.getByLabelText('Episode'), 'e1');
    expect(await screen.findByText('ready')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Draft kinds'), ['summary']);
    await user.click(screen.getByRole('button', { name: /run content factory/i }));
    await waitFor(() => expect(mockApi.admin.aiFactory.runFactory).toHaveBeenCalledWith('e1', ['summary']));
  });
});
