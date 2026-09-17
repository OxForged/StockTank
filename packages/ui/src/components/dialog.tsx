import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '../lib/cn.js';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

function Overlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-scrim backdrop-blur-sm data-[state=open]:animate-fade-in',
        className,
      )}
      {...props}
    />
  );
}

export interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  size?: 'sm' | 'md' | 'lg';
  hideClose?: boolean;
}

const sizeClass = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

/** Centered modal. Always pair with <DialogTitle> (and ideally <DialogDescription>) for screen readers. */
export function DialogContent({ className, children, size = 'md', hideClose, ...props }: DialogContentProps) {
  return (
    <DialogPortal>
      <Overlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2',
          'rounded-xl border border-hairline-strong bg-surface p-6 text-fg shadow-raised',
          'focus:outline-none data-[state=open]:animate-rise-in',
          sizeClass[size],
          className,
        )}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mb-4 flex flex-col gap-1.5 pr-8', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('font-display text-xl font-bold leading-tight tracking-tight', className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm text-muted', className)} {...props} />;
}

/* ------------------------------------------------------------------------- */
/* Drawer: a Dialog that slides in from an edge.                              */
/* ------------------------------------------------------------------------- */

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

const drawerVariants = cva(
  [
    'fixed z-50 flex flex-col gap-4 border-hairline-strong bg-surface p-6 text-fg shadow-raised',
    'focus:outline-none transition-transform duration-slow ease-out-expo',
  ],
  {
    variants: {
      side: {
        right: 'inset-y-0 right-0 h-full w-[min(100%,22rem)] border-l data-[state=closed]:translate-x-full',
        left: 'inset-y-0 left-0 h-full w-[min(100%,22rem)] border-r data-[state=closed]:-translate-x-full',
        bottom: 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t data-[state=closed]:translate-y-full',
        top: 'inset-x-0 top-0 max-h-[85dvh] border-b data-[state=closed]:-translate-y-full',
      },
    },
    defaultVariants: { side: 'right' },
  },
);

export interface DrawerContentProps
  extends ComponentProps<typeof DialogPrimitive.Content>,
    VariantProps<typeof drawerVariants> {
  hideClose?: boolean;
}

export function DrawerContent({ className, children, side, hideClose, ...props }: DrawerContentProps) {
  return (
    <DialogPortal>
      <Overlay />
      <DialogPrimitive.Content className={cn(drawerVariants({ side }), className)} {...props}>
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export const DrawerTitle = DialogTitle;
export const DrawerDescription = DialogDescription;
