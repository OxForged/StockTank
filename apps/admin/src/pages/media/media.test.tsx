import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { mockApi } from '../../test/mock-api';
import { renderApp } from '../../test/render';
import { parseTimecode, timecodeInput } from './clips-page';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../../test/mock-api');
  return { ...mod, createApiClient: () => mockApi, uploadToStorage: vi.fn(() => Promise.resolve()) };
});

const staff = (permissions: string[]) => ({
  id: 'u_1',
  email: 'staff@example.com',
  displayName: 'Staff',
  avatarUrl: null,
  roles: ['editor'],
  permissions,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const caps = (over: object = {}) => ({
  storageConfigured: true,
  queueConfigured: true,
  maxUploadBytes: 50 * 1024 * 1024,
  acceptedMimeTypes: ['video/mp4', 'audio/mpeg'],
  ...over,
});

const asset = (over: object = {}) => ({
  id: 'ma1',
  kind: 'video',
  status: 'failed',
  originalName: 'episode-7.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 5_000_000,
  durationSeconds: null,
  width: null,
  height: null,
  progress: 0,
  attempts: 1,
  error: 'Declared as video but no video stream was found',
  targetEpisodeId: 'e1',
  episodeId: null,
  playback: null,
  createdAt: '2026-09-16T00:00:00.000Z',
  readyAt: null,
  ...over,
});

const episode = { id: 'e1', slug: 'ep', title: 'Episode 7', show: { slug: 'the-tank', title: 'The Tank' } };

const clip = (over: object = {}) => ({
  id: 'c1',
  title: 'The pitch',
  startTime: 75.5,
  endTime: 105,
  transcript: null,
  confidence: null,
  generationModel: null,
  reviewStatus: 'review',
  renderStatus: null,
  renderError: null,
  media: null,
  sourceEpisode: { id: 'e1', title: 'Episode 7', slug: 'ep', showSlug: 'the-tank', hasMedia: true },
  isDemo: false,
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
  ...over,
});

describe('timecodes', () => {
  it('parses and round-trips exactly', () => {
    expect(parseTimecode('90')).toBe(90);
    expect(parseTimecode('1:30')).toBe(90);
    expect(parseTimecode('1:02:03')).toBe(3723);
    expect(parseTimecode('1:15.5')).toBe(75.5);
    expect(parseTimecode('abc')).toBeNull();
    expect(parseTimecode('1:2:3:4')).toBeNull();
    for (const t of [0, 5.5, 75.25, 3600, 12.125]) expect(parseTimecode(timecodeInput(t))).toBe(t);
  });
});

describe('Media library', { timeout: 30_000 }, () => {
  it('warns plainly and hides uploads when the pipeline is not configured', async () => {
    mockApi.auth.me.mockResolvedValue({ user: staff(['content.read_drafts', 'content.write']) });
    mockApi.admin.media.status.mockResolvedValue(caps({ storageConfigured: false }));
    mockApi.admin.media.listAssets.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
    renderApp('/content/videos');
    expect(await screen.findByText('Media pipeline not configured')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^upload$/i })).not.toBeInTheDocument();
  });

  it('uploads through a presigned URL, completes, and retries failed assets', async () => {
    mockApi.auth.me.mockResolvedValue({ user: staff(['content.read_drafts', 'content.write']) });
    mockApi.admin.media.status.mockResolvedValue(caps());
    mockApi.admin.media.listAssets.mockResolvedValue({ items: [asset()], page: 1, pageSize: 100, total: 1 });
    mockApi.admin.content.listEpisodes.mockResolvedValue({ items: [episode], page: 1, pageSize: 100, total: 1 });
    mockApi.admin.media.startUpload.mockResolvedValue({
      asset: asset({ id: 'ma2', status: 'pending_upload', error: null }),
      upload: { method: 'PUT', url: 'http://storage.test/put', headers: { 'Content-Type': 'video/mp4' }, expiresAt: '2026-09-16T01:00:00.000Z' },
    });
    mockApi.admin.media.completeUpload.mockResolvedValue(asset({ id: 'ma2', status: 'uploaded', error: null }));
    mockApi.admin.media.retry.mockResolvedValue(asset({ status: 'uploaded', attempts: 2, error: null }));

    renderApp('/content/videos');
    const user = userEvent.setup();
    expect(await screen.findByText('Declared as video but no video stream was found')).toBeInTheDocument();

    await screen.findByRole('option', { name: 'The Tank — Episode 7' });
    await user.upload(screen.getByLabelText('File'), new File(['x'.repeat(2048)], 'ep7.mp4', { type: 'video/mp4' }));
    await user.selectOptions(screen.getByLabelText('Episode'), 'e1');
    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    await waitFor(() => expect(mockApi.admin.media.completeUpload).toHaveBeenCalledWith('ma2'));
    expect(mockApi.admin.media.startUpload).toHaveBeenCalledWith({ filename: 'ep7.mp4', mimeType: 'video/mp4', sizeBytes: 2048, episodeId: 'e1' });

    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(mockApi.admin.media.retry).toHaveBeenCalledWith('ma1'));
  });

  it('refuses unsupported files before contacting the API', async () => {
    mockApi.auth.me.mockResolvedValue({ user: staff(['content.read_drafts', 'content.write']) });
    mockApi.admin.media.status.mockResolvedValue(caps());
    mockApi.admin.media.listAssets.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
    mockApi.admin.content.listEpisodes.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
    renderApp('/content/videos');
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(await screen.findByLabelText('File'), new File(['x'], 'clip.webm', { type: 'video/webm' }));
    await user.click(screen.getByRole('button', { name: /^upload$/i }));
    expect(await screen.findByText('Unsupported format')).toBeInTheDocument();
    expect(mockApi.admin.media.startUpload).not.toHaveBeenCalled();
  });
});

describe('Clips', { timeout: 30_000 }, () => {
  it('queues renders and keeps publishing for editors only', async () => {
    mockApi.auth.me.mockResolvedValue({ user: staff(['content.read_drafts', 'content.write']) });
    mockApi.admin.media.listClips.mockResolvedValue({ items: [clip()], page: 1, pageSize: 100, total: 1 });
    mockApi.admin.content.listEpisodes.mockResolvedValue({ items: [episode], page: 1, pageSize: 100, total: 1 });
    mockApi.admin.media.renderClip.mockResolvedValue(clip({ renderStatus: 'uploaded' }));
    mockApi.admin.media.saveClip.mockResolvedValue(clip());

    renderApp('/content/clips');
    const user = userEvent.setup();
    const row = (await screen.findByText('The pitch')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Render' }));
    await waitFor(() => expect(mockApi.admin.media.renderClip).toHaveBeenCalledWith('c1'));

    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/^start/i)).toHaveValue('1:15.5');
    expect(within(dialog).getByRole('option', { name: 'published' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mockApi.admin.media.saveClip).toHaveBeenCalledWith(
        { sourceEpisodeId: 'e1', title: 'The pitch', startTime: 75.5, endTime: 105, transcript: null, reviewStatus: 'review' },
        'c1',
      ),
    );
  });

  it('lists only rendered verticals under Shorts', async () => {
    mockApi.auth.me.mockResolvedValue({ user: staff(['content.read_drafts']) });
    mockApi.admin.media.listClips.mockResolvedValue({
      items: [
        clip(),
        clip({ id: 'c2', title: 'Vertical ready', renderStatus: 'ready', media: { horizontalUrl: null, verticalUrl: 'https://cdn.test/v.mp4', squareUrl: null, audioUrl: null, thumbnailUrl: null } }),
      ],
      page: 1,
      pageSize: 100,
      total: 2,
    });
    renderApp('/content/shorts');
    expect(await screen.findByText('Vertical ready')).toBeInTheDocument();
    expect(screen.queryByText('The pitch')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '9:16' })).toHaveAttribute('href', 'https://cdn.test/v.mp4');
  });
});
