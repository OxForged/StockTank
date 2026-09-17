import { loginRequestSchema } from '@stocktank/types';
import { Button, FormField, Input } from '@stocktank/ui';
import { CircleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { describeAuthError, useLogin, useMe } from '../../lib/auth';
import { formValues, validate, type FieldErrors } from '../../lib/forms';
import { useDocumentTitle } from '../../lib/seo';
import { AuthLayout } from './auth-layout';

export function LoginPage() {
  useDocumentTitle('Sign in');
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useMe();
  const login = useLogin();
  const [errors, setErrors] = useState<FieldErrors<'email' | 'password'>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/account';

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
      onError: (err) => setFormError(describeAuthError(err, 'login')),
    });
  }

  return (
    <AuthLayout
      title="Sign in"
      intro="Welcome back. Sign in to your StockTank account."
      footer={
        <>
          New to StockTank?{' '}
          <Link to="/signup" className="font-semibold text-primary-hi hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-describedby={formError ? 'login-error' : undefined}>
        {formError ? (
          <p id="login-error" role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {formError}
          </p>
        ) : null}
        <FormField label="Email" htmlFor="login-email" error={errors.email} required>
          {({ id, describedBy, invalid }) => (
            <Input id={id} name="email" type="email" autoComplete="email" inputMode="email" aria-describedby={describedBy} invalid={invalid} required />
          )}
        </FormField>
        <FormField label="Password" htmlFor="login-password" error={errors.password} required>
          {({ id, describedBy, invalid }) => (
            <Input id={id} name="password" type="password" autoComplete="current-password" aria-describedby={describedBy} invalid={invalid} required />
          )}
        </FormField>
        <Button type="submit" size="lg" loading={login.isPending} className="mt-2 w-full">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
