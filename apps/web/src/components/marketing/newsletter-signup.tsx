import { ApiClientError } from '@stocktank/api-client';
import { Button, Input, cn } from '@stocktank/ui';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Mail } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { api } from '../../lib/api';
import { getAttribution } from '../../lib/attribution';

function describe(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 429) return 'Too many attempts. Please try again in a few minutes.';
    if (err.status === 503) return 'Sign-up is temporarily unavailable. Please try again later.';
    if (err.code === 'VALIDATION_FAILED') return 'Enter a valid email address and confirm consent.';
    if (err.status === 0) return 'Network error. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}

interface NewsletterSignupProps {
  source: string;
  variant?: 'band' | 'panel';
  className?: string;
}

/** Double opt-in newsletter sign-up. The confirmation email is required before anyone is subscribed. */
export function NewsletterSignup({ source, variant = 'band', className }: NewsletterSignupProps) {
  const emailId = useId();
  const consentId = useId();
  const [error, setError] = useState<string | null>(null);
  const subscribe = useMutation({
    mutationFn: (input: { email: string; website: string }) => {
      const { utm } = getAttribution();
      return api.marketing.subscribe({ email: input.email, consent: true, source, utm, ...(input.website ? { website: input.website } : {}) });
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (data.get('consent') !== 'on') {
      setError('Please confirm you want to receive the newsletter.');
      return;
    }
    subscribe.mutate(
      { email, website: String(data.get('website') ?? '') },
      { onError: (err) => setError(describe(err)) },
    );
  }

  return (
    <section
      aria-labelledby={`${emailId}-title`}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-hairline bg-surface',
        variant === 'band' ? 'px-6 py-8 md:px-10 md:py-10' : 'p-6',
        className,
      )}
    >
      <div aria-hidden="true" className="bg-desk-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className={cn('relative grid gap-6', variant === 'band' && 'md:grid-cols-[1.1fr_1fr] md:items-center')}>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs tracking-[0.16em] text-primary-hi">THE BRIEFING</span>
          <h2 id={`${emailId}-title`} className="font-display text-2xl font-extrabold md:text-3xl">
            StockTank, in your inbox
          </h2>
          <p className="text-sm text-muted">
            New shows, clips and explainers on tokenized markets and crypto. Informational, never advice. Unsubscribe any
            time.
          </p>
        </div>

        {subscribe.isSuccess ? (
          <p role="status" className="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary-soft p-4 text-sm">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary-hi" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Check your inbox.</strong> We sent a confirmation link. You are not
              subscribed until you click it.
            </span>
          </p>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor={emailId} className="sr-only">
                Email address
              </label>
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <Input id={emailId} name="email" type="email" autoComplete="email" placeholder="you@example.com" className="h-11 pl-10" invalid={Boolean(error)} />
              </div>
              <Button type="submit" className="h-11" loading={subscribe.isPending}>
                Subscribe
              </Button>
            </div>
            {/* Honeypot: hidden from people and assistive tech. */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] size-px opacity-0" />
            <label htmlFor={consentId} className="flex items-start gap-2.5 text-xs text-muted">
              <input id={consentId} name="consent" type="checkbox" className="mt-0.5 size-4 accent-[var(--st-primary)]" />
              <span>
                I want to receive the StockTank newsletter. See the <Link to="/legal/privacy" className="underline hover:text-fg">privacy policy</Link>.
              </span>
            </label>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </section>
  );
}
