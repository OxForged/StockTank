import { ThemeProvider } from '@stocktank/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { routes } from './routes';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 },
    },
  });
}

export function AppProviders({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      {/* The control room defaults to dark; the toggle still works and is stored separately from the public site. */}
      <ThemeProvider storageKey="stocktank.admin.theme" defaultTheme="dark">
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const router = createBrowserRouter(routes);

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
