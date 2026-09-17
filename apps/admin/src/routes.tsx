import type { JSX } from 'react';
import type { RouteObject } from 'react-router';

import { AdminGate } from './components/gate';
import { RequirePermission } from './components/require-permission';
import { AdminShell } from './components/shell';
import { allNavItems } from './lib/nav';
import { DashboardPage } from './pages/dashboard-page';
import { LoginPage } from './pages/login-page';
import { NotFoundPage } from './pages/not-found-page';
import { PlaceholderPage } from './pages/placeholder-page';
import { AdvertisersPage } from './pages/advertising/advertisers-page';
import { CampaignDetailPage } from './pages/advertising/campaign-detail-page';
import { CampaignsPage } from './pages/advertising/campaigns-page';
import { AdvertisingOverviewPage } from './pages/advertising/overview-page';
import { PlacementsPage } from './pages/advertising/placements-page';
import { ReviewQueuePage } from './pages/advertising/review-page';
import { LeadsPage } from './pages/growth/leads-page';
import { NewsletterAudiencePage } from './pages/growth/newsletter-page';
import { FeatureFlagsPage } from './pages/system/feature-flags-page';
import {
  ArticlesCmsPage,
  CompaniesCmsPage,
  EpisodesCmsPage,
  LivestreamsCmsPage,
  ProjectsCmsPage,
  ShowsCmsPage,
} from './pages/cms-pages';
import { UsersPage } from './pages/users-page';

/** Pages that work today, keyed by path. Everything else in the nav renders a milestone placeholder. */
const WORKING: Record<string, () => JSX.Element> = {
  '/system/users': UsersPage,
  '/content/episodes': EpisodesCmsPage,
  '/content/articles': ArticlesCmsPage,
  '/network/shows': ShowsCmsPage,
  '/entities/projects': ProjectsCmsPage,
  '/entities/companies': CompaniesCmsPage,
  '/live/streams': LivestreamsCmsPage,
  '/system/feature-flags': FeatureFlagsPage,
  '/advertising/overview': AdvertisingOverviewPage,
  '/advertising/advertisers': AdvertisersPage,
  '/advertising/campaigns': CampaignsPage,
  '/advertising/review': ReviewQueuePage,
  '/advertising/placements': PlacementsPage,
  '/growth/leads': LeadsPage,
  '/growth/newsletter': NewsletterAudiencePage,
};

const navRoutes: RouteObject[] = allNavItems()
  .filter((item) => item.to !== '/')
  .map((item) => {
    const Working = WORKING[item.to];
    return {
      path: item.to.replace(/^\//, ''),
      element: (
        <RequirePermission permission={item.permission}>
          {Working ? <Working /> : <PlaceholderPage item={item} />}
        </RequirePermission>
      ),
    };
  });

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <AdminGate>
        <AdminShell />
      </AdminGate>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      ...navRoutes,
      {
        path: 'advertising/campaigns/:id',
        element: (
          <RequirePermission permission="ads.manage">
            <CampaignDetailPage />
          </RequirePermission>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
