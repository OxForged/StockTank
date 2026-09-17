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
import { UsersPage } from './pages/users-page';

/** Pages that work today, keyed by path. Everything else in the nav renders a milestone placeholder. */
const WORKING: Record<string, () => JSX.Element> = {
  '/system/users': UsersPage,
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
    children: [{ index: true, element: <DashboardPage /> }, ...navRoutes, { path: '*', element: <NotFoundPage /> }],
  },
];
