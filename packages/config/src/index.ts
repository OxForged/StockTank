import { z } from 'zod';

const csv = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

/** Server-side environment. Parsed once at boot; the process exits on invalid config. */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_VERSION: z.string().default('0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: csv,
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(336),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url().optional(),
  MEILISEARCH_URL: z.url().optional(),
  MEILISEARCH_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function loadServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid server environment:\n${issues}`);
  }
  if (parsed.data.NODE_ENV === 'production' && /replace-with|change-me/i.test(parsed.data.SESSION_SECRET)) {
    throw new Error('SESSION_SECRET still has its placeholder value');
  }
  return parsed.data;
}
