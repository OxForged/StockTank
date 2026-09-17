import { ApiClientError } from '@stocktank/api-client';
import { Button, Skeleton } from '@stocktank/ui';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';

import { NewsletterSignup } from '../components/marketing/newsletter-signup';
import { api } from '../lib/api';
import { useDocumentTitle } from '../lib/seo';

export function NewsletterPage() {
  useDocumentTitle('Newsletter');
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 md:px-8">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-xs tracking-[0.16em] text-primary-hi">THE BRIEFING</span>
        <h1 className="font-display text-5xl font-black italic tracking-tight">The StockTank newsletter</h1>
        <p className="text-lg text-muted">
          The best of the network in your inbox: new episodes, approved clips, explainers and the live schedule. We use
          double opt-in, never sell your address, and every issue has a one-click unsubscribe.
        </p>
      </div>
      <NewsletterSignup source="newsletter_page" variant="panel" />
    </div>
  );
}

/** Handles the one-time token links from emails. The token is read once and never logged or stored. */
function TokenPage({ action }: { action: 'confirm' | 'unsubscribe' }) {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const sent = useRef(false);
  const mutation = useMutation({
    mutationFn: (t: string) => (action === 'confirm' ? api.marketing.confirmSubscription(t) : api.marketing.unsubscribe(t)),
  });
  const { mutate } = mutation;

  useEffect(() => {
    if (sent.current || token.length < 20) return;
    sent.current = true;
    mutate(token);
  }, [token, mutate]);

  const invalid = token.length < 20 || (mutation.error instanceof ApiClientError && mutation.error.status === 404);
  const title = action === 'confirm' ? 'Confirm subscription' : 'Unsubscribe';

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-16 md:px-8">
      <h1 className="font-display text-4xl font-black italic">{title}</h1>
      {mutation.isPending ? <Skeleton className="h-20 rounded-2xl" /> : null}
      {mutation.isSuccess ? (
        <p role="status" className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary-soft p-5">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-primary-hi" aria-hidden="true" />
          <span>
            {action === 'confirm'
              ? 'You are subscribed. The next issue will arrive in your inbox.'
              : 'You have been unsubscribed and will not receive further issues.'}
          </span>
        </p>
      ) : null}
      {invalid ? (
        <p role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger-soft p-5">
          <CircleAlert className="mt-0.5 size-6 shrink-0 text-danger" aria-hidden="true" />
          <span>This link is invalid or has expired. {action === 'confirm' ? 'Sign up again to get a new link.' : 'Use the link from your latest email.'}</span>
        </p>
      ) : mutation.isError ? (
        <p role="alert" className="rounded-2xl border border-danger/40 bg-danger-soft p-5">
          Something went wrong.{' '}
          <Button variant="link" onClick={() => mutate(token)}>
            Try again
          </Button>
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button asChild variant="outline">
          <Link to="/">Back to StockTank</Link>
        </Button>
        {invalid && action === 'confirm' ? (
          <Button asChild>
            <Link to="/newsletter">Sign up again</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function NewsletterConfirmPage() {
  useDocumentTitle('Confirm subscription');
  return <TokenPage action="confirm" />;
}

export function NewsletterUnsubscribePage() {
  useDocumentTitle('Unsubscribe');
  return <TokenPage action="unsubscribe" />;
}
