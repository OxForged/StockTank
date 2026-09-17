import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn.js';

export const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap select-none',
    'rounded-md font-sans font-semibold tracking-tight',
    'transition-[background-color,color,box-shadow,transform,opacity] duration-fast ease-out-expo',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:translate-y-px',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-primary text-on-primary shadow-[0_8px_24px_-10px_rgb(0_201_122/0.65)] hover:brightness-110',
        secondary: 'bg-raised text-fg border border-hairline-strong hover:bg-overlay',
        outline: 'border border-hairline-strong bg-transparent text-fg hover:border-primary hover:text-primary-hi',
        ghost: 'bg-transparent text-muted hover:bg-raised hover:text-fg',
        danger: 'bg-danger-soft text-danger border border-danger/30 hover:bg-danger hover:text-white',
        link: 'text-primary-hi underline-offset-4 hover:underline h-auto px-0',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10 p-0',
        'icon-sm': 'size-8 p-0 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a <button> (e.g. a router Link). */
  asChild?: boolean;
  /** Shows a spinner, sets aria-busy and disables the control. */
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  leadingIcon,
  trailingIcon,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  const content = asChild ? (
    children
  ) : (
    <>
      {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </>
  );
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      aria-busy={loading || undefined}
      disabled={asChild ? undefined : disabled || loading}
      type={asChild ? undefined : (type ?? 'button')}
      {...props}
    >
      {content}
    </Comp>
  );
}
