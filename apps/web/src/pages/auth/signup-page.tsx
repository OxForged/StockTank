import { registerRequestSchema } from '@stocktank/types';
import { Button, FormField, Input } from '@stocktank/ui';
import { CircleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';

import { describeAuthError, useMe, useRegister } from '../../lib/auth';
import { formValues, validate, type FieldErrors } from '../../lib/forms';
import { useDocumentTitle } from '../../lib/seo';
import { AuthLayout } from './auth-layout';

export function SignupPage() {
  useDocumentTitle('Create account');
  const navigate = useNavigate();
  const { user } = useMe();
  const register = useRegister();
  const [errors, setErrors] = useState<FieldErrors<'email' | 'password' | 'displayName'>>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (user) return <Navigate to="/account" replace />;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const result = validate(registerRequestSchema, formValues(e.currentTarget));
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    register.mutate(result.data, {
      onSuccess: () => navigate('/account', { replace: true }),
      onError: (err) => setFormError(describeAuthError(err, 'signup')),
    });
  }

  return (
    <AuthLayout
      title="Create your account"
      intro="Free. Follow shows, save episodes and get notified when things go live."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary-hi hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError ? (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {formError}
          </p>
        ) : null}
        <FormField label="Display name" htmlFor="signup-name" error={errors.displayName} hint="2 to 60 characters. Shown on comments and your profile." required>
          {({ id, describedBy, invalid }) => (
            <Input id={id} name="displayName" autoComplete="nickname" maxLength={60} aria-describedby={describedBy} invalid={invalid} required />
          )}
        </FormField>
        <FormField label="Email" htmlFor="signup-email" error={errors.email} required>
          {({ id, describedBy, invalid }) => (
            <Input id={id} name="email" type="email" autoComplete="email" inputMode="email" aria-describedby={describedBy} invalid={invalid} required />
          )}
        </FormField>
        <FormField label="Password" htmlFor="signup-password" error={errors.password} hint="At least 12 characters." required>
          {({ id, describedBy, invalid }) => (
            <Input id={id} name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} aria-describedby={describedBy} invalid={invalid} required />
          )}
        </FormField>
        <p className="text-xs text-muted">
          By creating an account you agree to the{' '}
          <Link to="/legal/terms" className="underline hover:text-fg">
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/legal/privacy" className="underline hover:text-fg">
            Privacy Policy
          </Link>
          .
        </p>
        <Button type="submit" size="lg" loading={register.isPending} className="mt-1 w-full">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
