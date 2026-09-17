import type { HTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = { sm: 'size-7 text-[10px]', md: 'size-9 text-xs', lg: 'size-12 text-sm', xl: 'size-20 text-xl' } as const;

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, src, size = 'md', className, ...props }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline-strong bg-raised font-display font-bold text-primary-hi',
        sizes[size],
        className,
      )}
      {...props}
    >
      {src ? <img src={src} alt={name} className="size-full object-cover" /> : <span aria-label={name}>{initials(name)}</span>}
    </span>
  );
}
