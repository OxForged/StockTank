import { cn } from '@stocktank/ui';
import { NavLink } from 'react-router';

import { BOTTOM_NAV } from '../../lib/nav';

export function BottomNav() {
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-bg/90 pb-safe backdrop-blur-md lg:hidden"
    >
      <ul className="grid h-bottom-nav grid-cols-5">
        {BOTTOM_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="min-w-0">
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex h-full flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors',
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                    isActive ? 'text-primary-hi' : 'text-muted hover:text-fg',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('size-5', isActive && 'drop-shadow-[0_0_8px_rgb(30_240_168/0.6)]')} aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
