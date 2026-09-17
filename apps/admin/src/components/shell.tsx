import type { CurrentUser } from '@stocktank/types';
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  Logo,
  LogoMark,
  ThemeToggle,
  Toaster,
  cn,
} from '@stocktank/ui';
import { ExternalLink, LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router';

import { useLogout, useMe } from '../lib/auth';
import { isGroup, visibleNav, type AdminNavGroup, type AdminNavItem } from '../lib/nav';

const PUBLIC_SITE = import.meta.env.VITE_PUBLIC_SITE_URL ?? 'http://localhost:5190';

function leafClass({ isActive }: { isActive: boolean }) {
  return cn(
    'relative flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[13px] transition-colors',
    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
    // Active indicator: a small bar that scales in, so moving between pages feels continuous.
    'before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary-hi',
    'before:transition-[transform,opacity] before:duration-300 before:ease-out-expo motion-reduce:before:transition-none',
    isActive ? 'bg-primary-soft font-semibold text-primary-hi before:scale-y-100 before:opacity-100' : 'text-muted hover:bg-raised hover:text-fg before:scale-y-0 before:opacity-0',
  );
}

function Leaf({ item, onNavigate }: { item: AdminNavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} end={item.to === '/'} className={leafClass} onClick={onNavigate}>
      {Icon ? <Icon className="size-4 shrink-0 opacity-80" aria-hidden="true" /> : <span aria-hidden="true" className="ml-1 size-1.5 shrink-0 rounded-full bg-faint" />}
      <span className="truncate">{item.label}</span>
      {item.milestone ? (
        <span className="ml-auto font-mono text-[10px] text-faint" title={`Scheduled for Milestone ${item.milestone}`}>
          M{item.milestone}
        </span>
      ) : null}
    </NavLink>
  );
}

function Group({ group, onNavigate }: { group: AdminNavGroup; onNavigate?: () => void }) {
  const Icon = group.icon;
  return (
    <li>
      <p className="mb-1 mt-4 flex items-center gap-2 px-2.5 kicker text-faint">
        <Icon className="size-3.5" aria-hidden="true" />
        {group.label}
      </p>
      <ul className="flex flex-col gap-0.5">
        {group.items.map((item) => (
          <li key={item.to}>
            <Leaf item={item} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </li>
  );
}

function SidebarNav({ user, onNavigate }: { user: CurrentUser; onNavigate?: () => void }) {
  const nav = visibleNav(user);
  return (
    <nav aria-label="Admin" className="flex-1 overflow-y-auto px-2 pb-6">
      <ul className="flex flex-col gap-0.5">
        {nav.map((entry) =>
          isGroup(entry) ? (
            <Group key={entry.label} group={entry} onNavigate={onNavigate} />
          ) : (
            <li key={entry.to} className="mt-2">
              <Leaf item={entry} onNavigate={onNavigate} />
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

function UserBlock({ user }: { user: CurrentUser }) {
  const logout = useLogout();
  return (
    <div className="flex items-center gap-2 border-t border-hairline p-3">
      <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-fg">{user.displayName}</p>
        <p className="truncate font-mono text-[10px] text-muted">{user.roles.join(', ')}</p>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Sign out" title="Sign out" loading={logout.isPending} onClick={() => logout.mutate()}>
        <LogOut aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Control-room shell: fixed sidebar on desktop, drawer on mobile. Assumes the gate has passed. */
export function AdminShell() {
  const { user } = useMe();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  return (
    <div className="flex min-h-dvh bg-control-room">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-hairline bg-surface/70 backdrop-blur lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-hairline px-4">
          <Logo size="sm" />
          <Badge variant="mono" className="ml-auto text-[10px]">
            ADMIN
          </Badge>
        </div>
        <SidebarNav user={user} />
        <UserBlock user={user} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-hairline bg-bg/80 px-3 backdrop-blur md:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}>
            <Menu aria-hidden="true" />
          </Button>
          <span className="flex items-center gap-2 lg:hidden">
            <LogoMark size={22} />
            <span className="font-display text-sm font-black italic uppercase tracking-tight">
              Stock<span className="text-gradient-primary">Tank</span>
            </span>
            <Badge variant="mono" className="text-[10px]">
              ADMIN
            </Badge>
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <a href={PUBLIC_SITE} target="_blank" rel="noreferrer">
                Public site
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 p-4 focus:outline-none md:p-6 lg:p-8">
          {/* Keyed by route so each page fades in; reduced motion turns the animation off. */}
          <div key={pathname} className="animate-fade-in motion-reduce:animate-none">
            <Outlet />
          </div>
        </main>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="left" className="w-[min(100%,18rem)] gap-0 p-0">
          <div className="flex h-14 items-center border-b border-hairline px-4">
            <DrawerTitle asChild>
              <Logo size="sm" label="Admin navigation" />
            </DrawerTitle>
            <DrawerDescription className="sr-only">Admin navigation</DrawerDescription>
          </div>
          <SidebarNav user={user} onNavigate={() => setOpen(false)} />
          <UserBlock user={user} />
        </DrawerContent>
      </Drawer>

      <Toaster />
      <ScrollRestoration />
    </div>
  );
}
