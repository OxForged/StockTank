import {
  Avatar,
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  Logo,
  Skeleton,
  ThemeToggle,
  cn,
} from '@stocktank/ui';
import { useQuery } from '@tanstack/react-query';
import { LogOut, Menu, Search, UserRound } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';

import { api } from '../../lib/api';
import { useLogout, useMe } from '../../lib/auth';
import { PRIMARY_NAV, sectionFor } from '../../lib/nav';

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

interface Result {
  key: string;
  label: string;
  type: 'SHOW' | 'EPISODE' | 'PROJECT' | 'COMPANY';
  mono: string;
  to: string;
}

const monogram = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Live search from the top bar (Concept B). Enter opens the full results page. */
function HeaderSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const listId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const q = useDebounced(query.trim(), 200);

  const search = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.content.search(q),
    enabled: q.length > 0,
    staleTime: 30_000,
  });

  const results: Result[] = search.data
    ? [
        ...search.data.shows.map((s) => ({ key: `s-${s.id}`, label: s.title, type: 'SHOW' as const, mono: monogram(s.title), to: `/shows/${s.slug}` })),
        ...search.data.projects.map((p) => ({ key: `p-${p.id}`, label: p.name, type: 'PROJECT' as const, mono: monogram(p.name), to: `/projects#${p.slug}` })),
        ...search.data.companies.map((c) => ({ key: `c-${c.id}`, label: c.name, type: 'COMPANY' as const, mono: monogram(c.name), to: `/companies#${c.slug}` })),
        ...search.data.episodes.map((e) => ({ key: `e-${e.id}`, label: e.title, type: 'EPISODE' as const, mono: monogram(e.show.title), to: `/shows/${e.show.slug}` })),
      ].slice(0, 7)
    : [];

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    setQuery('');
    navigate(to);
  };

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) go(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') setOpen(false);
  }

  const showPanel = open && q.length > 0;

  return (
    <div ref={wrapper} className="relative hidden w-full max-w-[460px] md:block">
      <form role="search" onSubmit={onSubmit}>
        <label htmlFor="site-search" className="sr-only">
          Search shows, projects and companies
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id="site-search"
          type="search"
          autoComplete="off"
          placeholder="Search shows, projects, companies…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-expanded={showPanel}
          aria-controls={listId}
          className="h-11 w-full rounded-lg border border-hairline bg-raised pl-11 pr-4 text-sm text-fg placeholder:text-faint transition-colors focus:border-primary focus:outline-none"
        />
      </form>
      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="absolute inset-x-0 top-[52px] z-50 flex animate-rise-in flex-col gap-0.5 rounded-xl border border-hairline bg-surface p-2 shadow-raised"
        >
          {search.isPending ? (
            <p className="px-3 py-3 text-sm text-muted">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">No matches for “{q}”.</p>
          ) : (
            results.map((r) => (
              <button
                key={r.key}
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => go(r.to)}
                className="flex h-12 items-center gap-3 rounded-lg px-3 text-left transition-transform hover:translate-x-1 hover:bg-raised focus-visible:bg-raised focus-visible:outline-none"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-raised font-display text-xs font-extrabold text-primary-hi">
                  {r.mono}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.label}</span>
                <span className="font-mono text-[11px] tracking-[0.1em] text-muted">{r.type}</span>
              </button>
            ))
          )}
          <Link
            to={`/search?q=${encodeURIComponent(q)}`}
            onClick={() => setOpen(false)}
            className="mt-1 rounded-lg px-3 py-2 text-xs font-semibold text-primary-hi hover:bg-raised"
          >
            See all results →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function AccountActions() {
  const { user, isLoading } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  if (isLoading) return <Skeleton className="h-11 w-36 rounded-lg" />;
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" className="hidden h-11 sm:inline-flex">
          <Link to="/login">Sign in</Link>
        </Button>
        <Button asChild className="h-11">
          <Link to="/signup">Join free</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" className="h-11 gap-2 pl-1.5">
        <Link to="/account" aria-label={`Account: ${user.displayName}`}>
          <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
          <span className="hidden max-w-32 truncate xl:inline">{user.displayName}</span>
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sign out"
        title="Sign out"
        loading={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/') })}
      >
        <LogOut aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Top bar (Concept B): "STOCKTANK / Section", search, local clock, theme toggle, account. */
export function TopBar() {
  const { pathname } = useLocation();
  const clock = useClock();
  const { user } = useMe();
  const [drawer, setDrawer] = useState(false);
  const close = () => setDrawer(false);

  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center gap-4 border-b border-hairline bg-surface/95 px-4 backdrop-blur-md transition-colors md:gap-6 md:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setDrawer(true)}>
        <Menu aria-hidden="true" />
      </Button>

      <div className="flex min-w-0 flex-col gap-0.5">
        <Link to="/" className="truncate rounded-sm font-display text-xl font-black italic tracking-tight md:text-2xl" aria-label="StockTank home">
          STOCK<span className="text-primary-hi">TANK</span>{' '}
          <span className="font-semibold not-italic text-muted">/ {sectionFor(pathname)}</span>
        </Link>
        <span className="hidden font-mono text-[11px] tracking-[0.14em] text-muted sm:block">ON-CHAIN STOCKS &amp; CRYPTO</span>
      </div>

      <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-4 md:gap-6">
        <HeaderSearch />
        <div className="hidden min-w-[104px] flex-col items-end gap-0.5 xl:flex" aria-live="off">
          <span className="font-mono text-lg font-bold tracking-wide tabular">{clock}</span>
          <span className="font-mono text-[10px] tracking-[0.16em] text-muted">LOCAL TIME</span>
        </div>
        <Button asChild variant="ghost" size="icon" className="md:hidden" aria-label="Search">
          <Link to="/search">
            <Search aria-hidden="true" />
          </Link>
        </Button>
        <ThemeToggle variant="outline" className="size-11" />
        <AccountActions />
      </div>

      <Drawer open={drawer} onOpenChange={setDrawer}>
        <DrawerContent side="left" className="w-[min(100%,20rem)] gap-0 p-0">
          <div className="flex h-topbar items-center border-b border-hairline px-4">
            <DrawerTitle asChild>
              <Logo size="sm" label="StockTank navigation" />
            </DrawerTitle>
            <DrawerDescription className="sr-only">Site navigation</DrawerDescription>
          </div>
          <nav aria-label="Mobile" className="flex-1 overflow-y-auto p-3">
            <ul className="flex flex-col">
              {PRIMARY_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={close}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors',
                          isActive ? 'bg-raised text-fg' : 'text-muted hover:bg-raised/60 hover:text-fg',
                        )
                      }
                    >
                      <Icon className="size-4 text-primary-hi" aria-hidden="true" />
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="border-t border-hairline p-3">
            {user ? (
              <Button asChild variant="secondary" className="w-full">
                <Link to="/account" onClick={close}>
                  <UserRound aria-hidden="true" />
                  {user.displayName}
                </Link>
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="secondary">
                  <Link to="/login" onClick={close}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild>
                  <Link to="/signup" onClick={close}>
                    Join free
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </header>
  );
}
