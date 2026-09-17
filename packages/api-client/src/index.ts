import { z } from 'zod';
import {
  adminPodcastEpisodeListSchema,
  adminPodcastEpisodeSchema,
  adminPodcastShowListSchema,
  adminPodcastShowSchema,
  castopodPodcastListSchema,
  podcastStatusResponseSchema,
  type AdminPodcastEpisode,
  type AdminPodcastShow,
  type CastopodPodcastOption,
  type PodcastEpisodeType,
  type PodcastStatusResponse,
  type ShowPodcastSettingsInput,
  adminClipListSchema,
  adminClipSchema,
  adminMediaAssetListSchema,
  adminMediaAssetSchema,
  createMediaUploadResponseSchema,
  mediaStatusResponseSchema,
  type AdminClip,
  type AdminClipList,
  type AdminMediaAsset,
  type AdminMediaAssetList,
  type ClipInput,
  type CreateMediaUploadInput,
  type CreateMediaUploadResponse,
  type MediaStatus,
  type MediaStatusResponse,
  type PublishStatus as ClipReviewStatus,
  adminPersonListSchema,
  adminPersonSchema,
  articleDetailResponseSchema,
  articleListResponseSchema,
  type ArticleListResponse,
  companyDetailResponseSchema,
  episodeDetailResponseSchema,
  personDetailResponseSchema,
  projectDetailResponseSchema,
  reindexResponseSchema,
  searchSuggestResponseSchema,
  trendingSearchesResponseSchema,
  type AdminPerson,
  type ArticleDetailResponse,
  type CompanyDetailResponse,
  type EpisodeDetailResponse,
  type PersonDetailResponse,
  type PersonInput,
  type ProjectDetailResponse,
  type ReindexResponse,
  type SearchSuggestResponse,
  type TrendingSearchesResponse,
  adminArticleListSchema,
  adminArticleSchema,
  adminCompanyListSchema,
  adminCompanySchema,
  adminEpisodeListSchema,
  adminEpisodeSchema,
  adminLivestreamListSchema,
  adminLivestreamSchema,
  adminProjectListSchema,
  adminProjectSchema,
  adminShowListSchema,
  adminShowSchema,
  chainOptionSchema,
  libraryResponseSchema,
  type AdminArticle,
  type AdminCompany,
  type AdminEpisode,
  type AdminList,
  type AdminLivestream,
  type AdminProject,
  type AdminShow,
  type ArticleInput,
  type ChainOption,
  type CompanyInput,
  type EpisodeInput,
  type FollowTarget,
  type LibraryResponse,
  type LivestreamInput,
  type ProjectInput,
  type PublishStatus,
  type ShowInput,
  adminPlacementSchema,
  adminUserListResponseSchema,
  advertiserListResponseSchema,
  advertisingOverviewSchema,
  apiErrorSchema,
  authResponseSchema,
  campaignListResponseSchema,
  campaignReportSchema,
  campaignSchema,
  companyListResponseSchema,
  creativeSchema,
  devLoginStatusSchema,
  featureFlagSchema,
  homeResponseSchema,
  inquiryListResponseSchema,
  inquiryReceivedResponseSchema,
  inquirySchema,
  mediaKitResponseSchema,
  newsletterSubscribeResponseSchema,
  newsletterTokenResponseSchema,
  projectListResponseSchema,
  publicFlagsResponseSchema,
  readyResponseSchema,
  reviewQueueResponseSchema,
  searchResponseSchema,
  serveAdResponseSchema,
  showDetailResponseSchema,
  showListResponseSchema,
  subscriberListResponseSchema,
  versionResponseSchema,
  type AdminPlacement,
  type AdminUserListResponse,
  type AdvertiserInput,
  type AdvertiserListResponse,
  type AdvertisingInquiryRequest,
  type AdvertisingOverview,
  type AuthResponse,
  type Campaign,
  type CampaignInput,
  type CampaignListResponse,
  type CampaignReport,
  type CampaignStatus,
  type CompanyListResponse,
  type Creative,
  type CreativeInput,
  type DevLoginStatus,
  type ErrorCode,
  type FeatureFlag,
  type HomeResponse,
  type Inquiry,
  type InquiryListResponse,
  type InquiryStatus,
  type InquiryUpdate,
  type LoginRequest,
  type MediaKitResponse,
  type NewsletterSubscribeRequest,
  type NewsletterTokenResponse,
  type PlacementKey,
  type PlacementUpdate,
  type ProjectListResponse,
  type PublicFlagsResponse,
  type ReadyResponse,
  type RegisterRequest,
  type ReviewDecision,
  type ReviewQueueResponse,
  type RoleKey,
  type SearchResponse,
  type ServeAdResponse,
  type ShowDetailResponse,
  type ShowListResponse,
  type SubscriberListResponse,
  type VersionResponse,
} from '@stocktank/types';

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK' | 'UPLOAD_FAILED' | 'ABORTED',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface ApiClientOptions {
  /** Base URL of the API origin, e.g. "" (same origin via dev proxy) or "https://api.stocktank.tv". */
  baseUrl?: string;
  fetch?: typeof fetch;
}

type Query = Record<string, string | number | undefined>;

function qs(query: Query): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : '';
}

const idResponseSchema = z.object({ id: z.string() });
const placementListSchema = z.object({ items: z.array(adminPlacementSchema) });
const featureFlagListSchema = z.object({ items: z.array(featureFlagSchema) });
const chainListSchema = z.object({ items: z.array(chainOptionSchema) });

export type ContentListQuery = { page?: number; pageSize?: number; status?: PublishStatus; q?: string };

/**
 * Typed StockTank API client. Uses cookie sessions (`credentials: 'include'`).
 * State-changing requests send `X-Requested-With`, which the API requires as a CSRF defence.
 */
export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? '').replace(/\/$/, '');
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);

  async function request<S extends z.ZodType>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    schema: S | null,
    body?: unknown,
    init: { keepalive?: boolean } = {},
  ): Promise<z.infer<S>> {
    let res: Response;
    try {
      res = await doFetch(`${baseUrl}${path}`, {
        method,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(method !== 'GET' ? { 'X-Requested-With': 'stocktank' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        ...(init.keepalive ? { keepalive: true } : {}),
      });
    } catch (err) {
      throw new ApiClientError(0, 'NETWORK', err instanceof Error ? err.message : 'Network error');
    }

    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }

    if (!res.ok) {
      const parsed = apiErrorSchema.safeParse(json);
      if (parsed.success) {
        const e = parsed.data.error;
        throw new ApiClientError(res.status, e.code, e.message, e.details);
      }
      throw new ApiClientError(res.status, 'INTERNAL', `Request failed with status ${res.status}`);
    }
    return (schema ? schema.parse(json) : undefined) as z.infer<S>;
  }

  const noContent = async (p: Promise<unknown>): Promise<void> => {
    await p;
  };
  const AD = '/api/v1/admin/advertising';
  const CMS = '/api/v1/admin/content';
  const MEDIA = '/api/v1/admin/media';
  const PODS = '/api/v1/admin/podcasts';

  return {
    auth: {
      register: (input: RegisterRequest): Promise<AuthResponse> =>
        request('POST', '/api/v1/auth/register', authResponseSchema, input),
      login: (input: LoginRequest): Promise<AuthResponse> =>
        request('POST', '/api/v1/auth/login', authResponseSchema, input),
      logout: (): Promise<void> => noContent(request('POST', '/api/v1/auth/logout', null)),
      me: (): Promise<AuthResponse> => request('GET', '/api/v1/auth/me', authResponseSchema),
      /** Local development only. */
      devLoginStatus: (): Promise<DevLoginStatus> => request('GET', '/api/v1/auth/dev-login', devLoginStatusSchema),
      /** Local development only: signs in as the seeded super admin. */
      devLogin: (): Promise<AuthResponse> => request('POST', '/api/v1/auth/dev-login', authResponseSchema),
    },
    content: {
      home: (): Promise<HomeResponse> => request('GET', '/api/v1/home', homeResponseSchema),
      shows: (page = 1, pageSize = 24): Promise<ShowListResponse> =>
        request('GET', `/api/v1/shows${qs({ page, pageSize })}`, showListResponseSchema),
      show: (slug: string): Promise<ShowDetailResponse> =>
        request('GET', `/api/v1/shows/${encodeURIComponent(slug)}`, showDetailResponseSchema),
      projects: (page = 1, pageSize = 24): Promise<ProjectListResponse> =>
        request('GET', `/api/v1/projects${qs({ page, pageSize })}`, projectListResponseSchema),
      companies: (page = 1, pageSize = 24): Promise<CompanyListResponse> =>
        request('GET', `/api/v1/companies${qs({ page, pageSize })}`, companyListResponseSchema),
      search: (q: string): Promise<SearchResponse> => request('GET', `/api/v1/search${qs({ q })}`, searchResponseSchema),
      suggest: (q: string): Promise<SearchSuggestResponse> => request('GET', `/api/v1/search/suggest${qs({ q })}`, searchSuggestResponseSchema),
      trending: (): Promise<TrendingSearchesResponse> => request('GET', '/api/v1/search/trending', trendingSearchesResponseSchema),
      episode: (showSlug: string, episodeSlug: string): Promise<EpisodeDetailResponse> =>
        request('GET', `/api/v1/shows/${encodeURIComponent(showSlug)}/episodes/${encodeURIComponent(episodeSlug)}`, episodeDetailResponseSchema),
      project: (slug: string): Promise<ProjectDetailResponse> =>
        request('GET', `/api/v1/projects/${encodeURIComponent(slug)}`, projectDetailResponseSchema),
      company: (slug: string): Promise<CompanyDetailResponse> =>
        request('GET', `/api/v1/companies/${encodeURIComponent(slug)}`, companyDetailResponseSchema),
      person: (slug: string): Promise<PersonDetailResponse> => request('GET', `/api/v1/people/${encodeURIComponent(slug)}`, personDetailResponseSchema),
      articles: (page = 1, pageSize = 24): Promise<ArticleListResponse> =>
        request('GET', `/api/v1/articles${qs({ page, pageSize })}`, articleListResponseSchema),
      article: (slug: string): Promise<ArticleDetailResponse> =>
        request('GET', `/api/v1/articles/${encodeURIComponent(slug)}`, articleDetailResponseSchema),
      flags: (): Promise<PublicFlagsResponse> => request('GET', '/api/v1/flags', publicFlagsResponseSchema),
    },
    ads: {
      mediaKit: (): Promise<MediaKitResponse> => request('GET', '/api/v1/advertising/media-kit', mediaKitResponseSchema),
      serve: (placement: PlacementKey, path?: string): Promise<ServeAdResponse> =>
        request('GET', `/api/v1/ads/serve${qs({ placement, path })}`, serveAdResponseSchema),
      /** `keepalive` lets the beacon finish if the page is being left. */
      recordImpression: (token: string): Promise<void> =>
        noContent(request('POST', '/api/v1/ads/impressions', null, { token }, { keepalive: true })),
    },
    me: {
      library: (): Promise<LibraryResponse> => request('GET', '/api/v1/me/library', libraryResponseSchema),
      follow: (target: FollowTarget, id: string): Promise<void> => noContent(request('POST', '/api/v1/me/follows', null, { target, id })),
      unfollow: (target: FollowTarget, id: string): Promise<void> => noContent(request('DELETE', '/api/v1/me/follows', null, { target, id })),
      bookmark: (episodeId: string, positionSeconds = 0): Promise<void> =>
        noContent(request('PUT', '/api/v1/me/bookmarks', null, { episodeId, positionSeconds })),
      removeBookmark: (episodeId: string): Promise<void> =>
        noContent(request('DELETE', `/api/v1/me/bookmarks/${encodeURIComponent(episodeId)}`, null)),
    },
    marketing: {
      submitInquiry: (input: AdvertisingInquiryRequest) =>
        request('POST', '/api/v1/advertising/inquiries', inquiryReceivedResponseSchema, input),
      subscribe: (input: NewsletterSubscribeRequest) =>
        request('POST', '/api/v1/newsletter/subscribe', newsletterSubscribeResponseSchema, input),
      confirmSubscription: (token: string): Promise<NewsletterTokenResponse> =>
        request('POST', '/api/v1/newsletter/confirm', newsletterTokenResponseSchema, { token }),
      unsubscribe: (token: string): Promise<NewsletterTokenResponse> =>
        request('POST', '/api/v1/newsletter/unsubscribe', newsletterTokenResponseSchema, { token }),
    },
    admin: {
      listUsers: (page = 1, pageSize = 25): Promise<AdminUserListResponse> =>
        request('GET', `/api/v1/admin/users${qs({ page, pageSize })}`, adminUserListResponseSchema),
      updateUserRoles: (userId: string, roles: RoleKey[]): Promise<void> =>
        noContent(request('PUT', `/api/v1/admin/users/${encodeURIComponent(userId)}/roles`, null, { roles })),

      content: {
        listShows: (q: ContentListQuery = {}): Promise<AdminList<AdminShow>> => request('GET', `${CMS}/shows${qs(q)}`, adminShowListSchema),
        saveShow: (input: ShowInput, id?: string): Promise<AdminShow> =>
          id ? request('PUT', `${CMS}/shows/${encodeURIComponent(id)}`, adminShowSchema, input) : request('POST', `${CMS}/shows`, adminShowSchema, input),
        listEpisodes: (q: ContentListQuery & { showId?: string } = {}): Promise<AdminList<AdminEpisode>> =>
          request('GET', `${CMS}/episodes${qs(q)}`, adminEpisodeListSchema),
        saveEpisode: (input: EpisodeInput, id?: string): Promise<AdminEpisode> =>
          id ? request('PUT', `${CMS}/episodes/${encodeURIComponent(id)}`, adminEpisodeSchema, input) : request('POST', `${CMS}/episodes`, adminEpisodeSchema, input),
        listProjects: (q: ContentListQuery = {}): Promise<AdminList<AdminProject>> => request('GET', `${CMS}/projects${qs(q)}`, adminProjectListSchema),
        saveProject: (input: ProjectInput, id?: string): Promise<AdminProject> =>
          id ? request('PUT', `${CMS}/projects/${encodeURIComponent(id)}`, adminProjectSchema, input) : request('POST', `${CMS}/projects`, adminProjectSchema, input),
        listCompanies: (q: ContentListQuery = {}): Promise<AdminList<AdminCompany>> => request('GET', `${CMS}/companies${qs(q)}`, adminCompanyListSchema),
        saveCompany: (input: CompanyInput, id?: string): Promise<AdminCompany> =>
          id ? request('PUT', `${CMS}/companies/${encodeURIComponent(id)}`, adminCompanySchema, input) : request('POST', `${CMS}/companies`, adminCompanySchema, input),
        listArticles: (q: ContentListQuery = {}): Promise<AdminList<AdminArticle>> => request('GET', `${CMS}/articles${qs(q)}`, adminArticleListSchema),
        saveArticle: (input: ArticleInput, id?: string): Promise<AdminArticle> =>
          id ? request('PUT', `${CMS}/articles/${encodeURIComponent(id)}`, adminArticleSchema, input) : request('POST', `${CMS}/articles`, adminArticleSchema, input),
        listLivestreams: (q: { page?: number; pageSize?: number } = {}): Promise<AdminList<AdminLivestream>> =>
          request('GET', `${CMS}/livestreams${qs(q)}`, adminLivestreamListSchema),
        saveLivestream: (input: LivestreamInput, id?: string): Promise<AdminLivestream> =>
          id
            ? request('PUT', `${CMS}/livestreams/${encodeURIComponent(id)}`, adminLivestreamSchema, input)
            : request('POST', `${CMS}/livestreams`, adminLivestreamSchema, input),
        listChains: async (): Promise<ChainOption[]> => (await request('GET', `${CMS}/chains`, chainListSchema)).items,
        listHosts: (q: { page?: number; pageSize?: number; q?: string } = {}): Promise<AdminList<AdminPerson>> =>
          request('GET', `${CMS}/hosts${qs(q)}`, adminPersonListSchema),
        saveHost: (input: PersonInput, id?: string): Promise<AdminPerson> =>
          id ? request('PUT', `${CMS}/hosts/${encodeURIComponent(id)}`, adminPersonSchema, input) : request('POST', `${CMS}/hosts`, adminPersonSchema, input),
        listGuests: (q: { page?: number; pageSize?: number; q?: string } = {}): Promise<AdminList<AdminPerson>> =>
          request('GET', `${CMS}/guests${qs(q)}`, adminPersonListSchema),
        saveGuest: (input: PersonInput, id?: string): Promise<AdminPerson> =>
          id ? request('PUT', `${CMS}/guests/${encodeURIComponent(id)}`, adminPersonSchema, input) : request('POST', `${CMS}/guests`, adminPersonSchema, input),
        reindexSearch: (): Promise<ReindexResponse> => request('POST', `${CMS}/search/reindex`, reindexResponseSchema),
      },
      podcasts: {
        status: (): Promise<PodcastStatusResponse> => request('GET', `${PODS}/status`, podcastStatusResponseSchema),
        listShows: async (): Promise<AdminPodcastShow[]> => (await request('GET', `${PODS}/shows`, adminPodcastShowListSchema)).items,
        saveShow: (id: string, input: ShowPodcastSettingsInput): Promise<AdminPodcastShow> =>
          request('PUT', `${PODS}/shows/${encodeURIComponent(id)}`, adminPodcastShowSchema, input),
        listEpisodes: async (showId: string): Promise<AdminPodcastEpisode[]> =>
          (await request('GET', `${PODS}/shows/${encodeURIComponent(showId)}/episodes`, adminPodcastEpisodeListSchema)).items,
        setEpisodeType: (id: string, episodeType: PodcastEpisodeType): Promise<AdminPodcastEpisode> =>
          request('PUT', `${PODS}/episodes/${encodeURIComponent(id)}/type`, adminPodcastEpisodeSchema, { episodeType }),
        sendToCastopod: (id: string): Promise<AdminPodcastEpisode> =>
          request('POST', `${PODS}/episodes/${encodeURIComponent(id)}/castopod`, adminPodcastEpisodeSchema),
        castopodPodcasts: async (): Promise<CastopodPodcastOption[]> => (await request('GET', `${PODS}/castopod/podcasts`, castopodPodcastListSchema)).items,
      },
      media: {
        status: (): Promise<MediaStatusResponse> => request('GET', `${MEDIA}/status`, mediaStatusResponseSchema),
        listAssets: (q: { status?: MediaStatus; episodeId?: string; page?: number; pageSize?: number } = {}): Promise<AdminMediaAssetList> =>
          request('GET', `${MEDIA}/assets${qs(q)}`, adminMediaAssetListSchema),
        asset: (id: string): Promise<AdminMediaAsset> => request('GET', `${MEDIA}/assets/${encodeURIComponent(id)}`, adminMediaAssetSchema),
        startUpload: (input: CreateMediaUploadInput): Promise<CreateMediaUploadResponse> =>
          request('POST', `${MEDIA}/uploads`, createMediaUploadResponseSchema, input),
        completeUpload: (id: string): Promise<AdminMediaAsset> =>
          request('POST', `${MEDIA}/assets/${encodeURIComponent(id)}/complete`, adminMediaAssetSchema),
        retry: (id: string): Promise<AdminMediaAsset> => request('POST', `${MEDIA}/assets/${encodeURIComponent(id)}/retry`, adminMediaAssetSchema),
        detachEpisode: (episodeId: string): Promise<void> =>
          noContent(request('POST', `${MEDIA}/episodes/${encodeURIComponent(episodeId)}/detach`, null)),
        listClips: (q: { reviewStatus?: ClipReviewStatus; episodeId?: string; q?: string; page?: number; pageSize?: number } = {}): Promise<AdminClipList> =>
          request('GET', `${MEDIA}/clips${qs(q)}`, adminClipListSchema),
        saveClip: (input: ClipInput, id?: string): Promise<AdminClip> =>
          id ? request('PUT', `${MEDIA}/clips/${encodeURIComponent(id)}`, adminClipSchema, input) : request('POST', `${MEDIA}/clips`, adminClipSchema, input),
        renderClip: (id: string): Promise<AdminClip> => request('POST', `${MEDIA}/clips/${encodeURIComponent(id)}/render`, adminClipSchema),
      },
      advertisingOverview: (): Promise<AdvertisingOverview> => request('GET', `${AD}/overview`, advertisingOverviewSchema),
      listAdvertisers: (): Promise<AdvertiserListResponse> => request('GET', `${AD}/advertisers`, advertiserListResponseSchema),
      createAdvertiser: (input: AdvertiserInput): Promise<{ id: string }> =>
        request('POST', `${AD}/advertisers`, idResponseSchema, input),
      updateAdvertiser: (id: string, input: Partial<AdvertiserInput>): Promise<void> =>
        noContent(request('PATCH', `${AD}/advertisers/${encodeURIComponent(id)}`, null, input)),
      setAdvertiserStatus: (id: string, status: 'pending_review' | 'approved' | 'suspended'): Promise<void> =>
        noContent(request('PUT', `${AD}/advertisers/${encodeURIComponent(id)}/status`, null, { status })),

      listPlacements: async (): Promise<AdminPlacement[]> => (await request('GET', `${AD}/placements`, placementListSchema)).items,
      updatePlacement: (key: PlacementKey, input: PlacementUpdate): Promise<void> =>
        noContent(request('PATCH', `${AD}/placements/${key}`, null, input)),

      listCampaigns: (
        query: { page?: number; pageSize?: number; status?: CampaignStatus; advertiserId?: string } = {},
      ): Promise<CampaignListResponse> => request('GET', `${AD}/campaigns${qs(query)}`, campaignListResponseSchema),
      getCampaign: (id: string): Promise<Campaign> => request('GET', `${AD}/campaigns/${encodeURIComponent(id)}`, campaignSchema),
      createCampaign: (input: CampaignInput): Promise<Campaign> => request('POST', `${AD}/campaigns`, campaignSchema, input),
      updateCampaign: (id: string, input: CampaignInput): Promise<Campaign> =>
        request('PUT', `${AD}/campaigns/${encodeURIComponent(id)}`, campaignSchema, input),
      submitCampaign: (id: string): Promise<Campaign> =>
        request('POST', `${AD}/campaigns/${encodeURIComponent(id)}/submit`, campaignSchema),
      reviewCampaign: (id: string, decision: ReviewDecision): Promise<Campaign> =>
        request('POST', `${AD}/campaigns/${encodeURIComponent(id)}/review`, campaignSchema, decision),
      pauseCampaign: (id: string): Promise<Campaign> =>
        request('POST', `${AD}/campaigns/${encodeURIComponent(id)}/pause`, campaignSchema),
      resumeCampaign: (id: string): Promise<Campaign> =>
        request('POST', `${AD}/campaigns/${encodeURIComponent(id)}/resume`, campaignSchema),
      campaignReport: (id: string): Promise<CampaignReport> =>
        request('GET', `${AD}/campaigns/${encodeURIComponent(id)}/report`, campaignReportSchema),

      addCreative: (campaignId: string, input: CreativeInput): Promise<Creative> =>
        request('POST', `${AD}/campaigns/${encodeURIComponent(campaignId)}/creatives`, creativeSchema, input),
      updateCreative: (id: string, input: CreativeInput): Promise<Creative> =>
        request('PUT', `${AD}/creatives/${encodeURIComponent(id)}`, creativeSchema, input),
      reviewCreative: (id: string, decision: ReviewDecision): Promise<Creative> =>
        request('POST', `${AD}/creatives/${encodeURIComponent(id)}/review`, creativeSchema, decision),
      reviewQueue: (): Promise<ReviewQueueResponse> => request('GET', `${AD}/review-queue`, reviewQueueResponseSchema),

      listInquiries: (query: { page?: number; pageSize?: number; status?: InquiryStatus } = {}): Promise<InquiryListResponse> =>
        request('GET', `/api/v1/admin/inquiries${qs(query)}`, inquiryListResponseSchema),
      updateInquiry: (id: string, input: InquiryUpdate): Promise<Inquiry> =>
        request('PATCH', `/api/v1/admin/inquiries/${encodeURIComponent(id)}`, inquirySchema, input),

      listSubscribers: (
        query: { page?: number; pageSize?: number; status?: 'pending' | 'confirmed' | 'unsubscribed' } = {},
      ): Promise<SubscriberListResponse> => request('GET', `/api/v1/admin/subscribers${qs(query)}`, subscriberListResponseSchema),
      /** URL for a browser download (cookie-authenticated). */
      subscribersExportUrl: (): string => `${baseUrl}/api/v1/admin/subscribers/export.csv`,

      listFeatureFlags: async (): Promise<FeatureFlag[]> =>
        (await request('GET', '/api/v1/admin/feature-flags', featureFlagListSchema)).items,
      setFeatureFlag: (key: string, enabled: boolean): Promise<void> =>
        noContent(request('PUT', `/api/v1/admin/feature-flags/${encodeURIComponent(key)}`, null, { enabled })),
    },
    system: {
      ready: (): Promise<ReadyResponse> => request('GET', '/ready', readyResponseSchema),
      version: (): Promise<VersionResponse> => request('GET', '/version', versionResponseSchema),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Browser-only: PUTs a file to the presigned URL from `admin.media.startUpload`, reporting progress (0–100).
 * Uses XMLHttpRequest because fetch has no upload progress events.
 */
export function uploadToStorage(
  file: Blob,
  upload: CreateMediaUploadResponse['upload'],
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(upload.method, upload.url);
    for (const [name, value] of Object.entries(upload.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiClientError(xhr.status, 'UPLOAD_FAILED', `Storage rejected the upload (${xhr.status})`)));
    xhr.onerror = () => reject(new ApiClientError(0, 'NETWORK', 'The upload was interrupted. Check your connection and try again.'));
    xhr.onabort = () => reject(new ApiClientError(0, 'ABORTED', 'Upload cancelled'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}
