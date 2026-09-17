import { loginRequestSchema } from '@stocktank/types';
import { Badge, Button, FormField, Input, Wordmark } from '@stocktank/ui';
import { CircleAlert } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { describeAuthError, useDevLogin, useDevLoginStatus, useLogin, useMe } from '../lib/auth';
import { formValues, validate, type FieldErrors } from '../lib/forms';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useMe();
  const login = useLogin();
  const devLoginStatus = useDevLoginStatus();
  const devLogin = useDevLogin();
  const [errors, setErrors] = useState<FieldErrors<'email' | 'password'>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  useEffect(() => {
    document.title = 'Sign in — StockTank Admin';
  }, []);

  if (user) return <Navigate to={from} replace />;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const result = validate(loginRequestSchema, formValues(e.currentTarget));
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    login.mutate(result.data, {
      onSuccess: () => navigate(from, { replace: true }),
      onError: (err) => setFormError(describeAuthError(err)),
    });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-control-room p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Wordmark mark size="md" />
          <Badge variant="mono">CONTROL ROOM</Badge>
        </div>
        <div className="rounded-xl border border-hairline bg-surface p-6 shadow-card">
          <h1 className="font-display text-xl font-extrabold">Staff sign in</h1>
          <p className="mt-1 text-sm text-muted">Authorised StockTank staff only. Activity is logged.</p>
          <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
            {formError ? (
              <p role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {formError}
              </p>
            ) : null}
            <FormField label="Email" htmlFor="admin-email" error={errors.email} required>
              {({ id, describedBy, invalid }) => (
                <Input id={id} name="email" type="email" autoComplete="username" aria-describedby={describedBy} invalid={invalid} required />
              )}
            </FormField>
            <FormField label="Password" htmlFor="admin-password" error={errors.password} required>
              {({ id, describedBy, invalid }) => (
                <Input id={id} name="password" type="password" autoComplete="current-password" aria-describedby={describedBy} invalid={invalid} required />
              )}
            </FormField>
            <Button type="submit" size="lg" loading={login.isPending} className="mt-2 w-full">
              Sign in
            </Button>
          </form>
          {devLoginStatus.data ? (
            <div className="mt-6 border-t border-hairline pt-6">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full"
                loading={devLogin.isPending}
                onClick={() =>
                  devLogin.mutate(undefined, {
                    onSuccess: () => navigate(from, { replace: true }),
                    onError: (err) => setFormError(describeAuthError(err)),
                  })
                }
              >
                Enter as local admin
              </Button>
              <p className="mt-2 text-center text-xs text-muted">
                Localhost development shortcut. Disabled in production.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
