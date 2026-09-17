import { Navigate, type RouteObject } from 'react-router';

import { SiteLayout } from './components/layout/site-layout';
import { RequireAuth } from './components/require-auth';
import { AccountPage } from './pages/account-page';
import { AdvertisePage } from './pages/advertise-page';
import { AreaPage, AREAS, type AreaKey } from './pages/area-page';
import { CompaniesPage, LivePage, ProjectsPage, SearchPage, ShowDetailPage, ShowsPage } from './pages/content-pages';
import { LoginPage } from './pages/auth/login-page';
import { SignupPage } from './pages/auth/signup-page';
import { HomePage } from './pages/home/home-page';
import { LegalPage } from './pages/legal/legal-page';
import { NewsletterConfirmPage, NewsletterPage, NewsletterUnsubscribePage } from './pages/newsletter-pages';
import { NotFoundPage } from './pages/not-found-page';
import { RouteErrorPage } from './pages/route-error-page';

const LEGAL_ALIASES = [
  'terms',
  'privacy',
  'cookies',
  'copyright',
  'dmca',
  'ai-disclosure',
  'advertising-disclosure',
  'financial-disclaimer',
] as const;

/** Areas backed by real data have their own pages; the rest show their milestone state. */
const DATA_BACKED = new Set<string>(['shows', 'live', 'projects', 'companies', 'search']);

const areaRoutes: RouteObject[] = (Object.keys(AREAS) as AreaKey[]).filter((key) => !DATA_BACKED.has(key)).map((key) => ({
  path: key,
  element: <AreaPage area={key} />,
}));

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <SiteLayout />,
    errorElement: (
      <SiteLayout>
        <RouteErrorPage />
      </SiteLayout>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'shows', element: <ShowsPage /> },
      { path: 'shows/:slug', element: <ShowDetailPage /> },
      { path: 'live', element: <LivePage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'companies', element: <CompaniesPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'advertise', element: <AdvertisePage /> },
      { path: 'newsletter', element: <NewsletterPage /> },
      { path: 'newsletter/confirm', element: <NewsletterConfirmPage /> },
      { path: 'newsletter/unsubscribe', element: <NewsletterUnsubscribePage /> },
      ...areaRoutes,
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      {
        path: 'account',
        element: (
          <RequireAuth>
            <AccountPage />
          </RequireAuth>
        ),
      },
      { path: 'legal/:slug', element: <LegalPage /> },
      // Short aliases (README §48 names them without the /legal prefix).
      ...LEGAL_ALIASES.map((slug) => ({ path: slug, element: <Navigate to={`/legal/${slug}`} replace /> })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
