import type { ApiClient } from '@stocktank/api-client';
import { vi } from 'vitest';

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
  admin: {
    content: {
      listShows: vi.fn(),
      saveShow: vi.fn(),
      listEpisodes: vi.fn(),
      saveEpisode: vi.fn(),
      listProjects: vi.fn(),
      saveProject: vi.fn(),
      listCompanies: vi.fn(),
      saveCompany: vi.fn(),
      listArticles: vi.fn(),
      saveArticle: vi.fn(),
      listLivestreams: vi.fn(),
      saveLivestream: vi.fn(),
      listChains: vi.fn(),
      listHosts: vi.fn(),
      saveHost: vi.fn(),
      listGuests: vi.fn(),
      saveGuest: vi.fn(),
      reindexSearch: vi.fn(),
    },
    analytics: {
      audience: vi.fn(),
      content: vi.fn(),
      shows: vi.fn(),
      projects: vi.fn(),
    },
    system: {
      auditLogs: vi.fn(),
      roles: vi.fn(),
      permissions: vi.fn(),
      apiKeys: vi.fn(),
      createApiKey: vi.fn(),
      revokeApiKey: vi.fn(),
    },
    radio: {
      status: vi.fn(),
      listStations: vi.fn(),
      station: vi.fn(),
      saveStation: vi.fn(),
      azuracastStations: vi.fn(),
    },
    podcasts: {
      status: vi.fn(),
      listShows: vi.fn(),
      saveShow: vi.fn(),
      listEpisodes: vi.fn(),
      setEpisodeType: vi.fn(),
      sendToCastopod: vi.fn(),
      castopodPodcasts: vi.fn(),
    },
    media: {
      status: vi.fn(),
      listAssets: vi.fn(),
      asset: vi.fn(),
      startUpload: vi.fn(),
      completeUpload: vi.fn(),
      retry: vi.fn(),
      detachEpisode: vi.fn(),
      listClips: vi.fn(),
      saveClip: vi.fn(),
      renderClip: vi.fn(),
    },
    listUsers: vi.fn(),
    updateUserRoles: vi.fn(),
    advertisingOverview: vi.fn(),
    listAdvertisers: vi.fn(),
    createAdvertiser: vi.fn(),
    updateAdvertiser: vi.fn(),
    setAdvertiserStatus: vi.fn(),
    listPlacements: vi.fn(),
    updatePlacement: vi.fn(),
    listCampaigns: vi.fn(),
    getCampaign: vi.fn(),
    createCampaign: vi.fn(),
    updateCampaign: vi.fn(),
    submitCampaign: vi.fn(),
    reviewCampaign: vi.fn(),
    pauseCampaign: vi.fn(),
    resumeCampaign: vi.fn(),
    campaignReport: vi.fn(),
    addCreative: vi.fn(),
    updateCreative: vi.fn(),
    reviewCreative: vi.fn(),
    reviewQueue: vi.fn(),
    listInquiries: vi.fn(),
    updateInquiry: vi.fn(),
    listSubscribers: vi.fn(),
    subscribersExportUrl: vi.fn(() => '/api/v1/admin/subscribers/export.csv'),
    listFeatureFlags: vi.fn(),
    setFeatureFlag: vi.fn(),
  },
  system: {
    ready: vi.fn(),
    version: vi.fn(),
  },
} as unknown as ApiClient & {
  auth: { [K in keyof ApiClient['auth']]: ReturnType<typeof vi.fn> };
  admin: { [K in keyof ApiClient['admin']]: ReturnType<typeof vi.fn> } & {
    content: { [K in keyof ApiClient['admin']['content']]: ReturnType<typeof vi.fn> };
    media: { [K in keyof ApiClient['admin']['media']]: ReturnType<typeof vi.fn> };
    podcasts: { [K in keyof ApiClient['admin']['podcasts']]: ReturnType<typeof vi.fn> };
    radio: { [K in keyof ApiClient['admin']['radio']]: ReturnType<typeof vi.fn> };
    system: { [K in keyof ApiClient['admin']['system']]: ReturnType<typeof vi.fn> };
    analytics: { [K in keyof ApiClient['admin']['analytics']]: ReturnType<typeof vi.fn> };
  };
  system: { [K in keyof ApiClient['system']]: ReturnType<typeof vi.fn> };
};
