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

const editor = {
  id: 'u_1',
  email: 'editor@example.com',
  displayName: 'Editor',
  avatarUrl: null,
  roles: ['editor'],
  permissions: ['content.read_drafts', 'distribution.publish'],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const show = (over: object = {}) => ({
  id: 's1',
  slug: 'the-tank',
  title: 'The Tank',
  status: 'published',
  isDemo: false,
  coverUrl: null,
  podcastEnabled: true,
  podcastAuthor: 'StockTank',
  podcastCategory: 'Business',
  podcastSubcategory: 'Investing',
  podcastExplicit: false,
  podcastLanguage: 'en',
  castopodPodcastId: 5,
  feedUrl: 'https://stocktank.test/podcasts/the-tank/feed.xml',
  publishedEpisodes: 2,
  feedEpisodes: 1,
  warnings: ['Add cover art (square JPG or PNG, 1400–3000 px). Apple Podcasts requires it.'],
  ...over,
});

const episode = (over: object = {}) => ({
  id: 'e1',
  title: 'Episode One',
  slug: 'ep-1',
  number: 1,
  status: 'published',
  publishedAt: '2026-09-01T12:00:00.000Z',
  episodeType: 'full',
  hasAudio: true,
  inFeed: true,
  castopodEpisodeId: null,
  podcastSyncStatus: null,
  podcastSyncError: null,
  podcastSyncedAt: null,
  ...over,
});

describe('Podcasts & RSS', { timeout: 30_000 }, () => {
  it('shows feeds and warnings, sends playable episodes to Castopod, and explains why others cannot go', async () => {
    mockApi.auth.me.mockResolvedValue({ user: editor });
    mockApi.admin.podcasts.status.mockResolvedValue({ castopodConfigured: true, queueConfigured: true, ownerEmailConfigured: true });
    mockApi.admin.podcasts.listShows.mockResolvedValue([show()]);
    mockApi.admin.podcasts.listEpisodes.mockResolvedValue([
      episode(),
      episode({ id: 'e2', title: 'No audio yet', slug: 'ep-2', number: 2, hasAudio: false, inFeed: false }),
      episode({ id: 'e3', title: 'Synced', slug: 'ep-3', number: 3, castopodEpisodeId: 41, podcastSyncStatus: 'synced' }),
    ]);
    mockApi.admin.podcasts.sendToCastopod.mockResolvedValue(episode({ podcastSyncStatus: 'queued' }));
    mockApi.admin.podcasts.setEpisodeType.mockResolvedValue(episode({ episodeType: 'bonus' }));

    renderApp('/distribution/rss');
    const user = userEvent.setup();
    expect(await screen.findByText('https://stocktank.test/podcasts/the-tank/feed.xml')).toBeInTheDocument();
    expect(screen.getByText(/Apple Podcasts requires it/)).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 published episodes in the feed/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Episodes' }));
    await screen.findByLabelText('Episode type for Episode One');
    const row = (title: string) => screen.getByLabelText(`Episode type for ${title}`).closest('tr')!;

    expect(within(row('No audio yet')).getByRole('button', { name: /send/i })).toBeDisabled();
    expect(within(row('Synced')).queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
    expect(within(row('Synced')).getByText('Castopod #41')).toBeInTheDocument();

    await user.click(within(row('Episode One')).getByRole('button', { name: /send/i }));
    await waitFor(() => expect(mockApi.admin.podcasts.sendToCastopod).toHaveBeenCalledWith('e1'));

    await user.selectOptions(within(row('Episode One')).getByLabelText('Episode type for Episode One'), 'bonus');
    await waitFor(() => expect(mockApi.admin.podcasts.setEpisodeType).toHaveBeenCalledWith('e1', 'bonus'));
  });

  it('saves settings with category, subcategory and a linked Castopod podcast', async () => {
    mockApi.auth.me.mockResolvedValue({ user: editor });
    mockApi.admin.podcasts.status.mockResolvedValue({ castopodConfigured: true, queueConfigured: true, ownerEmailConfigured: false });
    mockApi.admin.podcasts.listShows.mockResolvedValue([show({ podcastEnabled: false, feedUrl: null, castopodPodcastId: null, warnings: [], podcastCategory: null, podcastSubcategory: null })]);
    mockApi.admin.podcasts.castopodPodcasts.mockResolvedValue([{ id: 5, handle: 'thetank', title: 'The Tank', feedUrl: 'https://pods.test/@thetank/feed.xml' }]);
    mockApi.admin.podcasts.saveShow.mockResolvedValue(show());

    renderApp('/distribution/rss');
    const user = userEvent.setup();
    expect(await screen.findByText(/Set PODCAST_OWNER_EMAIL/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText(/publish a podcast feed/i));
    await user.selectOptions(within(dialog).getByLabelText('Category'), 'Business');
    await user.selectOptions(within(dialog).getByLabelText('Subcategory'), 'Investing');
    await within(dialog).findByRole('option', { name: 'The Tank (@thetank)' });
    await user.selectOptions(within(dialog).getByLabelText('Castopod podcast'), '5');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockApi.admin.podcasts.saveShow).toHaveBeenCalledWith('s1', {
        podcastEnabled: true,
        podcastAuthor: 'StockTank',
        podcastCategory: 'Business',
        podcastSubcategory: 'Investing',
        podcastExplicit: false,
        podcastLanguage: 'en',
        castopodPodcastId: 5,
      }),
    );
  });
});
