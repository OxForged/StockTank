import type { OpenAPIRegistry, ResponseConfig } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  adminCampaignListQuerySchema,
  adminPlacementSchema,
  advertiserInputSchema,
  advertiserListResponseSchema,
  advertiserStatusUpdateSchema,
  advertisingInquiryRequestSchema,
  advertisingOverviewSchema,
  campaignInputSchema,
  campaignListResponseSchema,
  campaignReportSchema,
  campaignSchema,
  companyListResponseSchema,
  creativeInputSchema,
  creativeSchema,
  devLoginStatusSchema,
  authResponseSchema,
  featureFlagSchema,
  featureFlagUpdateSchema,
  homeResponseSchema,
  inquiryListQuerySchema,
  inquiryListResponseSchema,
  inquiryReceivedResponseSchema,
  inquirySchema,
  inquiryUpdateSchema,
  listQuerySchema,
  mediaKitResponseSchema,
  newsletterSubscribeRequestSchema,
  newsletterSubscribeResponseSchema,
  newsletterTokenRequestSchema,
  newsletterTokenResponseSchema,
  placementKeySchema,
  placementUpdateSchema,
  projectListResponseSchema,
  publicFlagsResponseSchema,
  recordImpressionRequestSchema,
  reviewDecisionSchema,
  reviewQueueResponseSchema,
  searchQuerySchema,
  searchResponseSchema,
  serveAdQuerySchema,
  serveAdResponseSchema,
  showDetailResponseSchema,
  showListResponseSchema,
  subscriberListQuerySchema,
  subscriberListResponseSchema,
  adminPersonListSchema,
  adminPersonSchema,
  articleDetailResponseSchema,
  articleListResponseSchema,
  companyDetailResponseSchema,
  episodeDetailResponseSchema,
  personDetailResponseSchema,
  personInputSchema,
  projectDetailResponseSchema,
  reindexResponseSchema,
  searchSuggestResponseSchema,
  trendingSearchesResponseSchema,
  adminArticleListSchema,
  adminArticleSchema,
  adminCompanyListSchema,
  adminCompanySchema,
  adminContentListQuerySchema,
  adminEpisodeListSchema,
  adminEpisodeSchema,
  adminLivestreamListSchema,
  adminLivestreamSchema,
  adminProjectListSchema,
  adminProjectSchema,
  adminShowListSchema,
  adminShowSchema,
  articleInputSchema,
  bookmarkRequestSchema,
  chainOptionSchema,
  companyInputSchema,
  episodeInputSchema,
  followRequestSchema,
  libraryResponseSchema,
  livestreamInputSchema,
  projectInputSchema,
  showInputSchema,
} from '@stocktank/types';
import { component } from './document.js';

type Json = <T extends z.ZodType>(schema: T) => { 'application/json': { schema: T } };
type ErrorResponse = ResponseConfig;

export interface GrowthPathHelpers {
  json: Json;
  errorResponse: (description: string) => ErrorResponse;
  csrfHeaders: z.ZodObject;
  cookieAuth: Array<Record<string, string[]>>;
  commonErrors: Record<number, ErrorResponse>;
  authErrors: Record<number, ErrorResponse>;
  validationError: Record<number, ErrorResponse>;
}

const idParams = z.object({ id: z.string() });
const slugParams = z.object({ slug: z.string() });
const keyParams = z.object({ key: placementKeySchema });
const flagKeyParams = z.object({ key: z.string() });
const tokenParams = z.object({ token: z.string() });

/** Registers the content, advertising, marketing and growth-admin endpoints (§41). */
export function registerGrowthPaths(registry: OpenAPIRegistry, h: GrowthPathHelpers): void {
  const { json, errorResponse, csrfHeaders, cookieAuth, commonErrors, authErrors, validationError } = h;
  const notFound = (what: string) => ({ 404: errorResponse(`${what} not found (NOT_FOUND)`) });
  const conflict = (why: string) => ({ 409: errorResponse(`${why} (CONFLICT)`) });

  const Home = component('HomeResponse', homeResponseSchema, {
    description: 'Aggregated homepage payload. Only published content; demo rows carry isDemo=true.',
  });
  const ShowList = component('ShowListResponse', showListResponseSchema, {});
  const ShowDetail = component('ShowDetailResponse', showDetailResponseSchema, {});
  const ProjectList = component('ProjectListResponse', projectListResponseSchema, {});
  const CompanyList = component('CompanyListResponse', companyListResponseSchema, {});
  const Search = component('SearchResponse', searchResponseSchema, {});
  const Flags = component('PublicFlagsResponse', publicFlagsResponseSchema, { example: { flags: { advertising: false, wallet: false } } });
  const MediaKit = component('MediaKitResponse', mediaKitResponseSchema, {});
  const ServeAd = component('ServeAdResponse', serveAdResponseSchema, {});
  const InquiryRequest = component('AdvertisingInquiryRequest', advertisingInquiryRequestSchema, {
    example: {
      company: 'Acme Custody',
      contactName: 'Pat Doe',
      email: 'pat@acme.example',
      budgetRange: 'from_5k_to_25k',
      placementKeys: ['newsletter_primary'],
      message: 'We would like to sponsor the RWA Report next quarter.',
      consent: true,
    },
  });
  const SubscribeRequest = component('NewsletterSubscribeRequest', newsletterSubscribeRequestSchema, {
    example: { email: 'reader@example.com', consent: true, source: 'homepage' },
  });
  const Campaign = component('Campaign', campaignSchema, {});
  const Creative = component('Creative', creativeSchema, {});
  const ReviewDecision = component('ReviewDecision', reviewDecisionSchema, {
    example: { decision: 'approve', acknowledgedFlags: ['return_percentage_claim'], notes: 'Rate is the issuer’s published figure; disclaimer added.' },
  });

  const publicGet = (path: string, summary: string, description: string, schema: z.ZodType, request?: object, extra: object = {}) =>
    registry.registerPath({
      method: 'get',
      path,
      tags: ['Content'],
      summary,
      description,
      ...(request ? { request } : {}),
      responses: { 200: { description: summary, content: json(schema) }, ...validationError, ...extra, ...commonErrors },
    });

  // ───── Content ─────
  publicGet('/api/v1/home', 'Homepage', 'Featured shows, latest episodes, published clips, explainers, projects, companies, the live broadcast and today’s rundown. Cached 30s.', Home);
  publicGet('/api/v1/shows', 'List shows', 'Published shows, alphabetical.', ShowList, { query: listQuerySchema });
  publicGet('/api/v1/shows/{slug}', 'Show detail', 'A published show and its published episodes.', ShowDetail, { params: slugParams }, notFound('Show'));
  publicGet('/api/v1/projects', 'List projects', 'Published project profiles. Informational only.', ProjectList, { query: listQuerySchema });
  publicGet('/api/v1/companies', 'List companies', 'Published company profiles. Informational only.', CompanyList, { query: listQuerySchema });
  publicGet('/api/v1/search', 'Search', 'Grouped search across shows, episodes, projects and companies (Postgres until Meilisearch).', Search, { query: searchQuerySchema });
  publicGet('/api/v1/search/suggest', 'Search suggestions', 'Up to 8 typed suggestions with site paths for autocomplete.', searchSuggestResponseSchema, { query: searchQuerySchema });
  publicGet('/api/v1/search/trending', 'Trending searches', 'Popular anonymous queries from the last 7 days (only queries that returned results).', trendingSearchesResponseSchema);
  publicGet('/api/v1/shows/{slug}/episodes/{episodeSlug}', 'Episode detail', 'Episode with hosts, guests, projects, companies, approved clips and more from the show.', episodeDetailResponseSchema, { params: z.object({ slug: z.string(), episodeSlug: z.string() }) }, notFound('Episode'));
  publicGet('/api/v1/projects/{slug}', 'Project detail', 'Project profile and episodes that discussed it.', projectDetailResponseSchema, { params: slugParams }, notFound('Project'));
  publicGet('/api/v1/companies/{slug}', 'Company detail', 'Company profile and episodes that discussed it.', companyDetailResponseSchema, { params: slugParams }, notFound('Company'));
  publicGet('/api/v1/people/{slug}', 'Person detail', 'Host or guest profile and their episodes. AI hosts are flagged.', personDetailResponseSchema, { params: slugParams }, notFound('Person'));
  publicGet('/api/v1/articles', 'List articles', 'Published articles, newest first.', component('ArticleListResponse', articleListResponseSchema, {}), { query: listQuerySchema });
  publicGet('/api/v1/articles/{slug}', 'Article detail', 'Published article with source attribution.', articleDetailResponseSchema, { params: slugParams }, notFound('Article'));
  for (const [path, type, summary] of [
    ['/api/v1/seo/sitemap.xml', 'application/xml', 'Sitemap of published pages'],
    ['/api/v1/seo/rss.xml', 'application/rss+xml', 'RSS feed of episodes and articles'],
    ['/api/v1/seo/robots.txt', 'text/plain', 'robots.txt with the sitemap location'],
  ] as const) {
    registry.registerPath({ method: 'get', path, tags: ['Content'], summary, responses: { 200: { description: summary, content: { [type]: { schema: z.string() } } } } });
  }
  publicGet('/api/v1/flags', 'Feature flags', 'Public on/off state of every feature flag (§50).', Flags);

  // ───── Advertising (public) ─────
  registry.registerPath({
    method: 'get',
    path: '/api/v1/advertising/media-kit',
    tags: ['Advertising'],
    summary: 'Media kit',
    description: 'Active placements with specs. Rates appear only when sales has published them.',
    responses: { 200: { description: 'Placements', content: json(MediaKit) }, ...commonErrors },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/ads/serve',
    tags: ['Advertising'],
    summary: 'Serve an ad for a placement',
    description:
      'Returns an approved, in-flight ad or null. Sets a first-party `st_vid` visitor cookie for frequency capping. ' +
      '`clickUrl` is always the tracking URL; `impressionToken` is signed and single-use.',
    request: { query: serveAdQuerySchema },
    responses: { 200: { description: 'An ad, or { ad: null }', content: json(ServeAd) }, ...validationError, ...commonErrors },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/ads/impressions',
    tags: ['Advertising'],
    summary: 'Record a viewable impression',
    description: 'Idempotent per token.',
    request: { headers: csrfHeaders, body: { required: true, content: json(recordImpressionRequestSchema) } },
    responses: { 204: { description: 'Recorded (or already recorded)' }, ...validationError, ...commonErrors },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/ads/click/{token}',
    tags: ['Advertising'],
    summary: 'Track a click and redirect',
    description: 'Records the click and redirects (302) to the destination stored on the creative. Never an open redirect.',
    request: { params: tokenParams },
    responses: { 302: { description: 'Redirect to the advertiser' }, ...notFound('Ad link'), ...commonErrors },
  });

  // ───── Marketing (public) ─────
  registry.registerPath({
    method: 'post',
    path: '/api/v1/advertising/inquiries',
    tags: ['Marketing'],
    summary: 'Submit an advertising inquiry',
    description: 'Stores a sales lead with UTM attribution and notifies sales when configured. 5 per hour per IP. Honeypot submissions are accepted and discarded.',
    request: { headers: csrfHeaders, body: { required: true, content: json(InquiryRequest) } },
    responses: { 202: { description: 'Received', content: json(inquiryReceivedResponseSchema) }, ...validationError, ...commonErrors },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/newsletter/subscribe',
    tags: ['Marketing'],
    summary: 'Subscribe to the newsletter',
    description: 'Double opt-in: emails a confirmation link. The response is identical for new and existing addresses.',
    request: { headers: csrfHeaders, body: { required: true, content: json(SubscribeRequest) } },
    responses: {
      202: { description: 'Check your inbox', content: json(newsletterSubscribeResponseSchema) },
      ...validationError,
      503: errorResponse('No email provider configured or delivery failed'),
      ...commonErrors,
    },
  });
  for (const [action, summary] of [['confirm', 'Confirm a subscription'], ['unsubscribe', 'Unsubscribe']] as const) {
    registry.registerPath({
      method: 'post',
      path: `/api/v1/newsletter/${action}`,
      tags: ['Marketing'],
      summary,
      request: { headers: csrfHeaders, body: { required: true, content: json(newsletterTokenRequestSchema) } },
      responses: {
        200: { description: 'Done', content: json(newsletterTokenResponseSchema) },
        ...validationError,
        ...notFound('Token'),
        ...commonErrors,
      },
    });
  }

  // ───── Auth: local development shortcut ─────
  registry.registerPath({
    method: 'get',
    path: '/api/v1/auth/dev-login',
    tags: ['Auth'],
    summary: 'Is local one-click staff sign-in available?',
    description: 'True only when DEV_LOGIN_ENABLED=true (refused in production) and the client is on loopback.',
    responses: { 200: { description: 'Availability', content: json(devLoginStatusSchema) } },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/dev-login',
    tags: ['Auth'],
    summary: 'Local development: sign in as the seeded super admin',
    request: { headers: csrfHeaders },
    responses: { 200: { description: 'Signed in', content: json(authResponseSchema) }, ...notFound('Route'), ...commonErrors },
  });

  // ───── Admin: advertising ─────
  const admin = (
    method: 'get' | 'post' | 'put' | 'patch',
    path: string,
    summary: string,
    description: string,
    options: { tag?: string; params?: z.ZodObject; query?: z.ZodObject; body?: z.ZodType; ok?: { status: number; schema?: z.ZodType }; extra?: object } = {},
  ) =>
    registry.registerPath({
      method,
      path,
      tags: [options.tag ?? 'Admin: Advertising'],
      summary,
      description,
      security: cookieAuth,
      request: {
        ...(options.params ? { params: options.params } : {}),
        ...(options.query ? { query: options.query } : {}),
        ...(method !== 'get' ? { headers: csrfHeaders } : {}),
        ...(options.body ? { body: { required: true, content: json(options.body) } } : {}),
      },
      responses: {
        [options.ok?.status ?? 200]: {
          description: summary,
          ...(options.ok?.schema || !options.ok ? { content: json(options.ok?.schema ?? z.object({})) } : {}),
        },
        ...validationError,
        ...authErrors,
        ...(options.extra ?? {}),
        ...commonErrors,
      },
    });

  const A = '/api/v1/admin/advertising';
  admin('get', `${A}/overview`, 'Advertising overview', 'Requires `ads.manage`.', { ok: { status: 200, schema: advertisingOverviewSchema } });
  admin('get', `${A}/advertisers`, 'List advertisers', 'Requires `ads.manage`.', { ok: { status: 200, schema: advertiserListResponseSchema } });
  admin('post', `${A}/advertisers`, 'Create advertiser', 'Requires `ads.manage`. New advertisers start pending review.', {
    body: advertiserInputSchema,
    ok: { status: 201, schema: z.object({ id: z.string() }) },
  });
  admin('patch', `${A}/advertisers/{id}`, 'Update advertiser', 'Requires `ads.manage`.', { params: idParams, body: advertiserInputSchema.partial(), ok: { status: 204 }, extra: notFound('Advertiser') });
  admin('put', `${A}/advertisers/{id}/status`, 'Approve or suspend advertiser', 'Compliance decision; requires `ads.approve`.', {
    params: idParams,
    body: advertiserStatusUpdateSchema,
    ok: { status: 204 },
    extra: notFound('Advertiser'),
  });
  admin('get', `${A}/placements`, 'Rate card', 'All placements with private rates. Requires `ads.manage`.', {
    ok: { status: 200, schema: z.object({ items: z.array(adminPlacementSchema) }) },
  });
  admin('patch', `${A}/placements/{key}`, 'Update placement', 'Rates, visibility, activation. A rate must be set before it is made public.', {
    params: keyParams,
    body: placementUpdateSchema,
    ok: { status: 204 },
    extra: notFound('Placement'),
  });
  admin('get', `${A}/campaigns`, 'List campaigns', 'Requires `ads.manage`.', { query: adminCampaignListQuerySchema, ok: { status: 200, schema: campaignListResponseSchema } });
  admin('get', `${A}/campaigns/{id}`, 'Campaign detail', 'Requires `ads.manage`.', { params: idParams, ok: { status: 200, schema: Campaign }, extra: notFound('Campaign') });
  admin('post', `${A}/campaigns`, 'Create campaign', 'Created as draft. Requires `ads.manage`.', { body: campaignInputSchema, ok: { status: 201, schema: Campaign } });
  admin('put', `${A}/campaigns/{id}`, 'Edit campaign', 'Only draft, rejected or paused campaigns; edits send it back to draft for re-review.', {
    params: idParams,
    body: campaignInputSchema,
    ok: { status: 200, schema: Campaign },
    extra: { ...notFound('Campaign'), ...conflict('Campaign is live or in review') },
  });
  admin('post', `${A}/campaigns/{id}/submit`, 'Submit for review', 'Needs at least one creative.', { params: idParams, ok: { status: 200, schema: Campaign }, extra: conflict('Wrong status') });
  admin('post', `${A}/campaigns/{id}/review`, 'Approve or reject campaign', 'Requires `ads.approve`; the creator cannot review their own campaign. Approval needs an approved advertiser and creative.', {
    params: idParams,
    body: ReviewDecision,
    ok: { status: 200, schema: Campaign },
    extra: conflict('Not in review, or prerequisites unmet'),
  });
  admin('post', `${A}/campaigns/{id}/pause`, 'Pause campaign', 'Removes it from rotation immediately.', { params: idParams, ok: { status: 200, schema: Campaign }, extra: conflict('Not approved') });
  admin('post', `${A}/campaigns/{id}/resume`, 'Resume campaign', 'Only an unedited paused campaign keeps its approval.', { params: idParams, ok: { status: 200, schema: Campaign }, extra: conflict('Not resumable') });
  admin('get', `${A}/campaigns/{id}/report`, 'Campaign report', 'Impressions, clicks, CTR, estimated spend, daily and per-placement breakdown.', {
    params: idParams,
    ok: { status: 200, schema: campaignReportSchema },
    extra: notFound('Campaign'),
  });
  admin('post', `${A}/campaigns/{id}/creatives`, 'Add creative', 'Copy is scanned for policy flags (e.g. guaranteed returns).', { params: idParams, body: creativeInputSchema, ok: { status: 201, schema: Creative } });
  admin('put', `${A}/creatives/{id}`, 'Edit creative', 'Any edit requires a fresh review.', { params: idParams, body: creativeInputSchema, ok: { status: 200, schema: Creative }, extra: notFound('Creative') });
  admin('post', `${A}/creatives/{id}/review`, 'Approve or reject creative', 'Requires `ads.approve`; every policy flag must be acknowledged to approve.', {
    params: idParams,
    body: ReviewDecision,
    ok: { status: 200, schema: Creative },
    extra: conflict('Not awaiting review'),
  });
  admin('get', `${A}/review-queue`, 'Review queue', 'Campaigns and creatives awaiting an editor. Requires `ads.approve`.', { ok: { status: 200, schema: reviewQueueResponseSchema } });

  // ───── Admin: growth ─────
  admin('get', '/api/v1/admin/inquiries', 'List advertising inquiries', 'Requires `leads.manage`.', { tag: 'Admin: Growth', query: inquiryListQuerySchema, ok: { status: 200, schema: inquiryListResponseSchema } });
  admin('patch', '/api/v1/admin/inquiries/{id}', 'Update inquiry', 'Status, notes and advertiser link. Requires `leads.manage`.', {
    tag: 'Admin: Growth',
    params: idParams,
    body: inquiryUpdateSchema,
    ok: { status: 200, schema: inquirySchema },
    extra: notFound('Inquiry'),
  });
  admin('get', '/api/v1/admin/subscribers', 'List newsletter subscribers', 'Requires `newsletter.manage`.', { tag: 'Admin: Growth', query: subscriberListQuerySchema, ok: { status: 200, schema: subscriberListResponseSchema } });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/admin/subscribers/export.csv',
    tags: ['Admin: Growth'],
    summary: 'Export confirmed subscribers (CSV)',
    description: 'Confirmed subscribers only; cells are protected against spreadsheet formula injection. Audited.',
    security: cookieAuth,
    responses: { 200: { description: 'CSV file', content: { 'text/csv': { schema: z.string() } } }, ...authErrors, ...commonErrors },
  });
  admin('get', '/api/v1/admin/feature-flags', 'List feature flags', 'Requires `feature_flags.manage`.', { tag: 'Admin: Growth', ok: { status: 200, schema: z.object({ items: z.array(featureFlagSchema) }) } });
  admin('put', '/api/v1/admin/feature-flags/{key}', 'Toggle a feature flag', 'Requires `feature_flags.manage`. Audited.', {
    tag: 'Admin: Growth',
    params: flagKeyParams,
    body: featureFlagUpdateSchema,
    ok: { status: 204 },
    extra: notFound('Feature flag'),
  });

  // ───── Admin: content CMS (Milestone 2) ─────
  const CMS = '/api/v1/admin/content';
  const cms: Array<[string, string, z.ZodType, z.ZodType, z.ZodType, string]> = [
    ['shows', 'show', showInputSchema, adminShowSchema, adminShowListSchema, '`content.write`'],
    ['episodes', 'episode', episodeInputSchema, adminEpisodeSchema, adminEpisodeListSchema, '`content.write`'],
    ['projects', 'project', projectInputSchema, adminProjectSchema, adminProjectListSchema, '`entities.write`'],
    ['companies', 'company', companyInputSchema, adminCompanySchema, adminCompanyListSchema, '`entities.write`'],
    ['articles', 'article', articleInputSchema, adminArticleSchema, adminArticleListSchema, '`content.write`'],
    ['livestreams', 'broadcast', livestreamInputSchema, adminLivestreamSchema, adminLivestreamListSchema, '`content.publish`'],
  ];
  for (const [path, noun, input, item, listSchema, permission] of cms) {
    const statusRule = path === 'livestreams' ? '' : ' Publishing, archiving or rejecting additionally requires `content.publish`.';
    admin('get', `${CMS}/${path}`, `List ${path} (all statuses)`, 'Requires `content.read_drafts`.', {
      tag: 'Admin: Content',
      query: adminContentListQuerySchema,
      ok: { status: 200, schema: listSchema },
    });
    admin('post', `${CMS}/${path}`, `Create ${noun}`, `Requires ${permission}.${statusRule} Audited.`, {
      tag: 'Admin: Content',
      body: input,
      ok: { status: 201, schema: item },
      extra: conflict('Slug already in use'),
    });
    admin('put', `${CMS}/${path}/{id}`, `Update ${noun}`, `Requires ${permission}.${statusRule} Audited.`, {
      tag: 'Admin: Content',
      params: idParams,
      body: input,
      ok: { status: 200, schema: item },
      extra: { ...notFound(noun), ...conflict('Slug already in use') },
    });
  }
  for (const [path, noun] of [['hosts', 'host'], ['guests', 'guest']] as const) {
    admin('get', `${CMS}/${path}`, `List ${path}`, 'Requires `content.read_drafts`.', { tag: 'Admin: Content', ok: { status: 200, schema: adminPersonListSchema } });
    admin('post', `${CMS}/${path}`, `Create ${noun}`, noun === 'host' ? 'Requires `content.write`; marking a host as AI requires `content.publish`.' : 'Requires `content.write`.', {
      tag: 'Admin: Content',
      body: personInputSchema,
      ok: { status: 201, schema: adminPersonSchema },
    });
    admin('put', `${CMS}/${path}/{id}`, `Update ${noun}`, 'Requires `content.write`.', {
      tag: 'Admin: Content',
      params: idParams,
      body: personInputSchema,
      ok: { status: 200, schema: adminPersonSchema },
      extra: notFound(noun),
    });
  }
  admin('post', `${CMS}/search/reindex`, 'Rebuild the search index', 'Requires `settings.manage`. Indexes published content only.', {
    tag: 'Admin: Content',
    ok: { status: 200, schema: reindexResponseSchema },
  });
  admin('get', `${CMS}/chains`, 'List chains', 'Chain options for project profiles.', {
    tag: 'Admin: Content',
    ok: { status: 200, schema: z.object({ items: z.array(chainOptionSchema) }) },
  });

  // ───── Viewer library ─────
  const meTag = 'Me';
  admin('get', '/api/v1/me/library', 'My library', 'Followed shows, projects and companies, and bookmarked episodes (published only).', {
    tag: meTag,
    ok: { status: 200, schema: libraryResponseSchema },
  });
  admin('post', '/api/v1/me/follows', 'Follow', 'Idempotent.', { tag: meTag, body: followRequestSchema, ok: { status: 204 }, extra: notFound('Item') });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/me/follows',
    tags: [meTag],
    summary: 'Unfollow',
    security: cookieAuth,
    request: { headers: csrfHeaders, body: { required: true, content: json(followRequestSchema) } },
    responses: { 204: { description: 'Unfollowed' }, ...authErrors, ...commonErrors },
  });
  admin('put', '/api/v1/me/bookmarks', 'Bookmark an episode', 'Creates or updates the saved position.', {
    tag: meTag,
    body: bookmarkRequestSchema,
    ok: { status: 204 },
    extra: notFound('Episode'),
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/v1/me/bookmarks/{episodeId}',
    tags: [meTag],
    summary: 'Remove a bookmark',
    security: cookieAuth,
    request: { params: z.object({ episodeId: z.string() }), headers: csrfHeaders },
    responses: { 204: { description: 'Removed' }, ...authErrors, ...commonErrors },
  });
}
