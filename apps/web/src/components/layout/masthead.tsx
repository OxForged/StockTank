import {
  Avatar,
  Button,
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
  Logo,
  Skeleton,
  ThemeToggle,
  Ticker,
  cn,
} from '@stocktank/ui';
import { LogOut, Menu, Search, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';

import { useLogout, useMe } from '../../lib/auth';
import { PRIMARY_NAV } from '../../lib/nav';

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'relative inline-flex h-9 items-center whitespace-nowrap rounded-sm px-2.5 text-[13px] font-semibold tracking-tight transition-colors',
    'hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    isActive ? 'text-fg after:absolute after:inset-x-2.5 after:-bottom-[13px] after:h-0.5 after:rounded-pill after:bg-gradient-primary' : 'text-muted',
  );
}

function AccountMenu() {
  const { user, isLoading } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  if (isLoading) return <Skeleton className="h-9 w-24 rounded-pill" />;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link to="/login">Sign in</Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/signup">Create account</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="sm" className="gap-2 pl-1.5">
        <Link to="/account" aria-label={`Account: ${user.displayName}`}>
          <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
          <span className="hidden max-w-32 truncate md:inline">{user.displayName}</span>
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
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

export function Masthead() {
  const [open, setOpen] = useState(false);
  const { user } = useMe();
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-bg/85 backdrop-blur-md supports-[backdrop-filter]:bg-bg/70">
      <Ticker items={[]} emptyMessage="Market data connects in a later release" className="hidden md:flex" />
      <div className="container-site flex h-masthead items-center gap-3">
        <div className="flex items-center gap-2 lg:hidden">
          <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setOpen(true)}>
            <Menu aria-hidden="true" />
          </Button>
        </div>

        <Link to="/" className="flex shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" aria-label="StockTank home">
          <Logo size="sm" className="md:hidden" />
          <Logo size="md" className="hidden md:inline-flex" />
        </Link>

        <nav aria-label="Primary" className="ml-4 hidden min-w-0 flex-1 lg:block">
          <ul className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
            {PRIMARY_NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === '/'} className={navLinkClass}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Search" title="Search">
            <Link to="/search">
              <Search aria-hidden="true" />
            </Link>
          </Button>
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="left" className="w-[min(100%,20rem)] gap-0 p-0">
          <div className="flex h-masthead items-center border-b border-hairline px-4">
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
                    Create account
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
