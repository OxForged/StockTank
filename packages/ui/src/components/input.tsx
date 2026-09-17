import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

import { cn } from '../lib/cn.js';

const fieldClasses = [
  'flex w-full min-w-0 rounded-md border border-hairline-strong bg-surface px-3 text-sm text-fg',
  'placeholder:text-faint',
  'transition-[border-color,box-shadow] duration-fast',
  'hover:border-faint',
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
  'aria-invalid:border-danger aria-invalid:focus:ring-danger/30',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={cn(fieldClasses, 'h-10', type === 'number' && 'font-mono tabular', className)}
      {...props}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={cn(fieldClasses, 'min-h-24 py-2', className)}
      {...props}
    />
  );
}

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ className, required, children, ...props }: LabelProps) {
  return (
    <label className={cn('text-sm font-medium text-fg', className)} {...props}>
      {children}
      {required ? (
        <span aria-hidden="true" className="ml-0.5 text-primary-hi">
          *
        </span>
      ) : null}
    </label>
  );
}

export interface FormFieldProps {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  /** Render function receives the ids to wire aria attributes. */
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Label + control + hint/error, wired with ids for accessibility. */
export function FormField({ label, htmlFor, hint, error, required, className, children }: FormFieldProps) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
