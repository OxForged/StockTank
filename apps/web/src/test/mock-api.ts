import type { ApiClient } from '@stocktank/api-client';
import type { EpisodeDetailResponse, HomeResponse } from '@stocktank/types';
import { vi } from 'vitest';

type Mocked<T> = { [K in keyof T]: ReturnType<typeof vi.fn> };

/**
 * A fully mocked API client. Test files install it with:
 *   vi.mock('@stocktank/api-client', async (orig) => ({ ...(await orig()), createApiClient: () => mockApi }));
 */
export const mockApi = {
  auth: {
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    devLoginStatus: vi.fn(),
    devLogin: vi.fn(),
  },
  analytics: {
    send: vi.fn(() => Promise.resolve()),
  },
  markets: {
    stocks: vi.fn(),
    movers: vi.fn(),
    radar: vi.fn(),
    stock: vi.fn(),
    bars: vi.fn(),
  },
  content: {
    home: vi.fn(),
    shows: vi.fn(),
    show: vi.fn(),
    projects: vi.fn(),
    companies: vi.fn(),
    search: vi.fn(),
    suggest: vi.fn(),
    trending: vi.fn(),
    episode: vi.fn(),
    project: vi.fn(),
    company: vi.fn(),
    person: vi.fn(),
    articles: vi.fn(),
    article: vi.fn(),
    flags: vi.fn(),
    radioStations: vi.fn(),
    radioStation: vi.fn(),
  },
  ads: {
    mediaKit: vi.fn(),
    serve: vi.fn(),
    recordImpression: vi.fn(),
  },
  me: {
    library: vi.fn(),
    follow: vi.fn(),
    unfollow: vi.fn(),
    bookmark: vi.fn(),
    removeBookmark: vi.fn(),
  },
  marketing: {
    submitInquiry: vi.fn(),
    subscribe: vi.fn(),
    confirmSubscription: vi.fn(),
    unsubscribe: vi.fn(),
  },
  admin: {
    listUsers: vi.fn(),
    updateUserRoles: vi.fn(),
  },
  system: {
    ready: vi.fn(),
    version: vi.fn(),
  },
} as unknown as ApiClient & {
  auth: Mocked<ApiClient['auth']>;
  content: Mocked<ApiClient['content']>;
  ads: Mocked<ApiClient['ads']>;
  marketing: Mocked<ApiClient['marketing']>;
  me: Mocked<ApiClient['me']>;
  admin: Mocked<ApiClient['admin']>;
  system: Mocked<ApiClient['system']>;
};

export const EMPTY_HOME: HomeResponse = {
  featuredShows: [],
  latestEpisodes: [],
  clips: [],
  explainers: [],
  projects: [],
  companies: [],
  live: null,
  rundown: [],
  generatedAt: '2026-09-17T00:00:00.000Z',
};

export const DEMO_HOME: HomeResponse = {
  ...EMPTY_HOME,
  featuredShows: [
    { id: 's1', slug: 'the-tank', title: 'The Tank', tagline: 'Founders pitch.', description: 'A panel asks the hard questions.', coverUrl: null, episodeCount: 6, isDemo: true },
    { id: 's2', slug: 'market-open', title: 'Market Open', tagline: 'The morning desk.', description: 'Daily briefing.', coverUrl: null, episodeCount: 6, isDemo: true },
  ],
  latestEpisodes: [
    {
      id: 'e1',
      slug: 'ep-1',
      title: 'Can a treasury protocol survive a bear market?',
      summary: null,
      coverUrl: null,
      durationSeconds: 1800,
      publishedAt: '2026-09-16T10:00:00.000Z',
      show: { slug: 'the-tank', title: 'The Tank' },
      isDemo: true,
    },
  ],
  projects: [
    { id: 'p1', slug: 'harbor', name: 'Harbor Protocol', symbol: null, kind: 'protocol', description: null, chainName: 'Ethereum', logoUrl: null, verified: false, isDemo: true },
  ],
  companies: [
    { id: 'c1', slug: 'meridian', name: 'Meridian Robotics', ticker: null, exchange: null, sector: 'Industrials', country: 'US', description: null, logoUrl: null, isDemo: true },
  ],
  live: {
    id: 'l1',
    title: 'Market Open (DEMO broadcast)',
    description: null,
    status: 'live',
    scheduledStart: '2026-09-17T00:00:00.000Z',
    scheduledEnd: null,
    streamUrl: null,
    show: { slug: 'market-open', title: 'Market Open' },
    segments: [
      { position: 0, title: 'Pre-market: what moved overnight' },
      { position: 1, title: 'Tokenized equities explained' },
    ],
    isDemo: true,
  },
};

/** Minimal published episode detail; spread and override per test. */
export const EPISODE_DETAIL_BASE: EpisodeDetailResponse = {
  episode: {
    id: 'e1',
    slug: 'bear-market',
    title: 'Treasury protocols in a bear market',
    summary: 'Panel grills a founder.',
    coverUrl: null,
    durationSeconds: 3480,
    publishedAt: '2026-09-16T10:00:00.000Z',
    show: { slug: 'the-tank', title: 'The Tank' },
    isDemo: false,
    description: 'Notes',
    number: 7,
  },
  media: null,
  hosts: [],
  guests: [],
  projects: [],
  companies: [],
  clips: [],
  moreFromShow: [],
};
