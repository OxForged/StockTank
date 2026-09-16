'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CompassIcon } from '@/components/icons/CompassIcon';
import { ShowsIcon } from '@/components/icons/ShowsIcon';
import { ProfileIcon } from '@/components/icons/ProfileIcon';
import { MiniPlayer } from '@/components/MiniPlayer';

const NAV_ITEMS = [
  { href: '/explore', label: 'Explore', icon: CompassIcon },
  { href: '/shows', label: 'Daily', icon: ShowsIcon },
  { href: '/profile', label: 'Profile', icon: ProfileIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      <MiniPlayer />
      <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 h-17 border-t border-border-warm bg-cream/80 backdrop-blur-sm flex items-center justify-evenly z-10 vt-fixed">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 ${
                isActive ? 'text-black' : 'text-[#666]'
              }`}
            >
              <Icon className="size-6" />
              <span className="font-inter text-[10px] font-bold uppercase tracking-[1px] leading-[15px]">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
