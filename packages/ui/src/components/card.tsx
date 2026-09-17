import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';

export const cardVariants = cva('rounded-lg border text-fg', {
  variants: {
    variant: {
      surface: 'border-hairline bg-surface shadow-card',
      raised: 'border-hairline-strong bg-raised shadow-raised',
      ghost: 'border-transparent bg-transparent',
      outline: 'border-hairline bg-transparent',
      glow: 'border-primary/30 bg-surface shadow-glow',
    },
    padding: {
      none: '',
      sm: 'p-3',
      md: 'p-5',
      lg: 'p-6 md:p-8',
    },
    interactive: {
      true: 'transition-[border-color,transform,box-shadow] duration-base ease-out-expo hover:-translate-y-0.5 hover:border-hairline-strong focus-within:border-primary',
      false: '',
    },
  },
  defaultVariants: { variant: 'surface', padding: 'md', interactive: false },
});

export interface CardProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export function Card({ className, variant, padding, interactive, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant, padding, interactive }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col gap-1', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-display text-lg font-bold leading-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4 flex items-center gap-3 border-t border-hairline pt-4', className)} {...props} />;
}
