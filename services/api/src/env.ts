import { loadServerEnv, type ServerEnv } from '@stocktank/config';
import { z } from 'zod';

/**
 * Express `trust proxy` setting. Accepts the same values Express does:
 * `false`/`true`, a hop count, or a named/CIDR list such as `loopback` or `10.0.0.0/8`.
 */
const trustProxySchema = z
  .string()
  .default('false')
  .transform((raw): boolean | number | string => {
    const value = raw.trim();
    if (value === '' || value.toLowerCase() === 'false') return false;
    if (value.toLowerCase() === 'true') return true;
    if (/^\d+$/.test(value)) return Number(value);
    return value;
  });

const apiOnlyEnvSchema = z.object({
  TRUST_PROXY: trustProxySchema,
  LOG_LEVEL: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  ),
  /** Local-only one-click staff sign-in. Refused at boot when NODE_ENV=production. */
  DEV_LOGIN_ENABLED: z
    .string()
    .optional()
    .transform((v) => v?.trim().toLowerCase() === 'true'),
  /** Public site origin, used to build links in emails (newsletter confirmation, unsubscribe). */
  PUBLIC_WEB_URL: z.url().default('http://localhost:5190'),
  /** `resend` sends real email; `log` (development only) prints messages to the API log; `none` disables sending. */
  EMAIL_PROVIDER: z.enum(['resend', 'log', 'none']).optional(),
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  /** Where new advertising inquiries are forwarded. Optional. */
  SALES_NOTIFY_EMAIL: z.preprocess((v) => (v === '' ? undefined : v), z.email().optional()),
  GIT_COMMIT: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v.trim() : null)),
});

export type ApiEnv = ServerEnv & z.infer<typeof apiOnlyEnvSchema>;

/** Parses the shared server env plus API-specific settings. Throws on invalid config. */
export function loadEnv(source: Record<string, string | undefined> = process.env): ApiEnv {
  const shared = loadServerEnv(source);
  const parsed = apiOnlyEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid API environment:\n${issues}`);
  }
  const emailProvider = parsed.data.EMAIL_PROVIDER ?? (shared.NODE_ENV === 'production' ? 'none' : 'log');
  if (emailProvider === 'log' && shared.NODE_ENV === 'production') {
    throw new Error('EMAIL_PROVIDER=log is for development only');
  }
  if (emailProvider === 'resend' && (!parsed.data.EMAIL_PROVIDER_API_KEY || !parsed.data.EMAIL_FROM)) {
    throw new Error('EMAIL_PROVIDER=resend requires EMAIL_PROVIDER_API_KEY and EMAIL_FROM');
  }
  parsed.data.EMAIL_PROVIDER = emailProvider;
  if (parsed.data.DEV_LOGIN_ENABLED && shared.NODE_ENV === 'production') {
    throw new Error('DEV_LOGIN_ENABLED must not be set in production');
  }
  return { ...shared, ...parsed.data };
}
