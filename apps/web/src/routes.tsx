import { Navigate, type RouteObject } from 'react-router';

import { SiteLayout } from './components/layout/site-layout';
import { RequireAuth } from './components/require-auth';
import { AccountPage } from './pages/account-page';
import { AreaPage, AREAS, type AreaKey } from './pages/area-page';
import { LoginPage } from './pages/auth/login-page';
import { SignupPage } from './pages/auth/signup-page';
import { HomePage } from './pages/home/home-page';
import { LegalPage } from './pages/legal/legal-page';
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

const areaRoutes: RouteObject[] = (Object.keys(AREAS) as AreaKey[]).map((key) => ({
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
