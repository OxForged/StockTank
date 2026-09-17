import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';

import { cn } from '../lib/cn.js';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  /** Milliseconds before auto-dismiss. 0 keeps it until dismissed. */
  duration: number;
}

type Listener = () => void;

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function push(kind: ToastKind, title: string, opts?: { description?: string; duration?: number }): number {
  const id = nextId++;
  const item: ToastItem = {
    id,
    kind,
    title,
    description: opts?.description,
    duration: opts?.duration ?? (kind === 'error' ? 8000 : 4500),
  };
  items = [...items, item].slice(-5);
  emit();
  return id;
}

/** Imperative toast API. Safe to call from anywhere (event handlers, mutations). */
export const toast = {
  success: (title: string, opts?: { description?: string; duration?: number }) => push('success', title, opts),
  error: (title: string, opts?: { description?: string; duration?: number }) => push('error', title, opts),
  info: (title: string, opts?: { description?: string; duration?: number }) => push('info', title, opts),
  dismiss(id: number) {
    items = items.filter((t) => t.id !== id);
    emit();
  },
  clear() {
    items = [];
    emit();
  },
};

function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, () => items, () => items);
}

const icons: Record<ToastKind, typeof CircleCheck> = { success: CircleCheck, error: CircleAlert, info: Info };

function ToastCard({ item }: { item: ToastItem }) {
  useEffect(() => {
    if (!item.duration) return;
    const t = setTimeout(() => toast.dismiss(item.id), item.duration);
    return () => clearTimeout(t);
  }, [item.id, item.duration]);

  const Icon = icons[item.kind];
  return (
    <div
      role={item.kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-lg border bg-raised p-3 pr-2 text-sm text-fg shadow-raised animate-rise-in',
        item.kind === 'success' && 'border-primary/40',
        item.kind === 'error' && 'border-danger/40',
        item.kind === 'info' && 'border-hairline-strong',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'mt-0.5 size-4 shrink-0',
          item.kind === 'success' && 'text-primary-hi',
          item.kind === 'error' && 'text-danger',
          item.kind === 'info' && 'text-info',
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{item.title}</p>
        {item.description ? <p className="mt-0.5 text-xs text-muted">{item.description}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(item.id)}
        aria-label="Dismiss notification"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-overlay hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Mount once near the app root. */
export function Toaster({ className }: { className?: string }) {
  const list = useToasts();
  return (
    <div
      aria-label="Notifications"
      className={cn(
        'pointer-events-none fixed inset-x-4 bottom-[calc(var(--spacing-bottom-nav)+1rem)] z-[60] flex flex-col gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-96',
        className,
      )}
    >
      {list.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}
