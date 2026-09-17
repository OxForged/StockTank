import { ApiClientError } from '@stocktank/api-client';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EPISODE_DETAIL_BASE, mockApi } from '../test/mock-api';
import { renderApp } from '../test/render';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

const show = { slug: 'the-tank', title: 'The Tank' };
const person = (over: object) => ({ id: 'h1', slug: 'jordan-vale', name: 'Jordan Vale', title: null, bio: null, avatarUrl: null, twitter: null, isAi: false, role: 'host', isDemo: false, ...over });

describe('Media graph pages', () => {
  beforeEach(() => {
    mockApi.auth.me.mockRejectedValue(new ApiClientError(401, 'UNAUTHENTICATED', 'Not signed in'));
    mockApi.ads.serve.mockResolvedValue({ ad: null });
  });

  it('renders an episode with people, discussed entities, and PodcastEpisode JSON-LD', async () => {
    mockApi.content.episode.mockResolvedValue({
      episode: { id: 'e1', slug: 'bear-market', title: 'Treasury protocols in a bear market', summary: 'Panel grills a founder.', coverUrl: null, durationSeconds: 3480, publishedAt: '2026-09-16T10:00:00.000Z', show, isDemo: false, description: 'Notes', number: 7 },
      hosts: [person({})],
      guests: [person({ id: 'g1', slug: 'rafael-costa', name: 'Rafael Costa', title: 'Founder', role: 'guest' })],
      projects: [{ id: 'p1', slug: 'harbor', name: 'Harbor Protocol', symbol: null, kind: 'protocol', description: null, chainName: null, logoUrl: null, verified: false, isDemo: false }],
      companies: [],
      media: null,
      clips: [],
      moreFromShow: [],
    });
    renderApp('/shows/the-tank/bear-market');
    expect(await screen.findByText(/playback becomes available once/i)).toBeInTheDocument();

    expect(await screen.findByRole('heading', { level: 1, name: 'Treasury protocols in a bear market' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /rafael costa/i })).toHaveAttribute('href', '/people/rafael-costa');
    expect(screen.getByRole('link', { name: /harbor protocol/i })).toHaveAttribute('href', '/projects/harbor');
    await waitFor(() => {
      const ld = JSON.parse(document.getElementById('page-jsonld')?.textContent ?? '{}') as Record<string, unknown>;
      expect(ld['@type']).toBe('PodcastEpisode');
      expect(ld.timeRequired).toBe('PT58M');
    });
    expect(document.title).toBe('Treasury protocols in a bear market · The Tank — StockTank');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(/\/shows\/the-tank\/bear-market$/);
  });

  it('plays processed episode media inline and in the mini player, including clip ranges', async () => {
    mockApi.content.episode.mockResolvedValue({
      ...EPISODE_DETAIL_BASE,
      media: { kind: 'video', hlsUrl: 'https://cdn.test/r/a/hls/master.m3u8', audioUrl: 'https://cdn.test/r/a/audio.mp3', posterUrl: 'https://cdn.test/r/a/poster.jpg', durationSeconds: 3480 },
      clips: [
        { id: 'c1', title: 'The pitch', startTime: 75, endTime: 105, episode: { slug: 'bear-market', title: 'Treasury' }, show, media: null, isDemo: false },
        { id: 'c2', title: 'Rendered', startTime: 5, endTime: 20, episode: { slug: 'bear-market', title: 'Treasury' }, show, isDemo: false, media: { horizontalUrl: null, verticalUrl: null, squareUrl: null, audioUrl: 'https://cdn.test/clips/c2/audio.mp3', thumbnailUrl: null } },
      ],
    });
    renderApp('/shows/the-tank/bear-market');
    const video = await screen.findByLabelText('Video: Treasury protocols in a bear market');
    expect(video).toHaveAttribute('poster', 'https://cdn.test/r/a/poster.jpg');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /listen in the player/i }));
    const player = screen.getByRole('region', { name: 'Player' });
    expect(player.querySelector('audio')?.getAttribute('src')).toBe('https://cdn.test/r/a/audio.mp3');
    expect(within(player).getByRole('button', { name: 'Play' })).toBeEnabled();

    expect(screen.getByText('1:15 – 1:45')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Play clip Rendered' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Player' }).querySelector('audio')?.getAttribute('src')).toBe('https://cdn.test/clips/c2/audio.mp3'));
  });

  it('advertises the show podcast feed for subscribing and discovery', async () => {
    mockApi.content.show.mockResolvedValue({
      show: { id: 's1', slug: 'the-tank', title: 'The Tank', tagline: 'Founders pitch.', description: null, coverUrl: null, episodeCount: 1, isDemo: false },
      podcast: { feedUrl: 'https://stocktank.test/podcasts/the-tank/feed.xml' },
      hosts: [],
      episodes: [],
    });
    renderApp('/shows/the-tank');
    expect(await screen.findByRole('link', { name: /podcast rss/i })).toHaveAttribute('href', 'https://stocktank.test/podcasts/the-tank/feed.xml');
    await waitFor(() => {
      const link = document.head.querySelector('link[rel="alternate"][type="application/rss+xml"]');
      expect(link?.getAttribute('href')).toBe('https://stocktank.test/podcasts/the-tank/feed.xml');
    });
  });

  it('discloses AI hosts on their profile', async () => {
    mockApi.content.person.mockResolvedValue({ person: { ...person({ name: 'Desk Anchor', isAi: true }), website: null }, episodes: [] });
    renderApp('/people/desk-anchor');
    expect(await screen.findByRole('note')).toHaveTextContent(/is an AI personality/i);
  });

  it('shows the not-found page for unpublished items', async () => {
    mockApi.content.project.mockRejectedValue(new ApiClientError(404, 'NOT_FOUND', 'Project not found'));
    renderApp('/projects/secret');
    expect(await screen.findByRole('heading', { level: 1, name: /not found|off air|lost/i })).toBeInTheDocument();
  });
});
