import { ApiClientError } from '@stocktank/api-client';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockApi } from '../test/mock-api';
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
      clips: [],
      moreFromShow: [],
    });
    renderApp('/shows/the-tank/bear-market');

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
