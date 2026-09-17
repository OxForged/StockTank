import type { HTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-raised', className)}
      {...props}
    />
  );
}

/** A card-shaped skeleton for media grids. */
export function MediaSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)} aria-hidden="true">
      <Skeleton className="aspect-video w-full rounded-lg" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
