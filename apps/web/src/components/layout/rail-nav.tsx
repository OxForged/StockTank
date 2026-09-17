import { LogoMark, cn } from '@stocktank/ui';
import { Link, NavLink, useLocation } from 'react-router';

import { RAIL_NAV } from '../../lib/nav';

const ITEM_HEIGHT = 64;
const ITEM_GAP = 8;

function activeIndex(pathname: string): number {
  if (pathname === '/') return 0;
  return RAIL_NAV.findIndex((n) => n.to !== '/' && (pathname === n.to || pathname.startsWith(`${n.to}/`)));
}

/** Desktop left rail (Concept B): icon + label buttons with a sliding active indicator. */
export function RailNav() {
  const { pathname } = useLocation();
  const index = activeIndex(pathname);

  return (
    <aside
      aria-label="Sections"
      className="fixed inset-y-0 left-0 z-40 hidden w-rail flex-col items-center gap-6 border-r border-hairline bg-surface py-5 transition-colors lg:flex"
    >
      <Link to="/" aria-label="StockTank home" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
        <LogoMark size={44} />
      </Link>
      <nav aria-label="Primary" className="relative flex w-full flex-col items-center" style={{ gap: ITEM_GAP }}>
        <span
          aria-hidden="true"
          className={cn(
            'absolute left-0 top-0 w-[3px] rounded-r bg-primary-hi transition-[transform,opacity] duration-500 ease-out-expo',
            index < 0 && 'opacity-0',
          )}
          style={{ height: ITEM_HEIGHT, transform: `translateY(${Math.max(index, 0) * (ITEM_HEIGHT + ITEM_GAP)}px)` }}
        />
        {RAIL_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex w-[72px] flex-col items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  isActive ? 'bg-raised text-fg' : 'text-muted hover:bg-raised/60 hover:text-fg',
                )
              }
              style={{ height: ITEM_HEIGHT }}
            >
              <Icon className="size-5" aria-hidden="true" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
