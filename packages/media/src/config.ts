import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

/** Object storage + media delivery settings shared by the API and the media worker. */
export const mediaEnvSchema = z.object({
  S3_ENDPOINT: z.preprocess(emptyToUndefined, z.url().optional()),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().min(3).default('stocktank-media'),
  S3_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  S3_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  /** Public base URL for renditions (CDN in production, MinIO bucket URL in development). */
  MEDIA_PUBLIC_BASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  /** Maximum upload size in megabytes. */
  MEDIA_MAX_UPLOAD_MB: z.coerce.number().int().positive().default(4096),
});
export type MediaEnv = z.infer<typeof mediaEnvSchema>;

export function loadMediaEnv(source: Record<string, string | undefined> = process.env): MediaEnv {
  const parsed = mediaEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid media environment: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  return parsed.data;
}

export function isStorageConfigured(env: MediaEnv): boolean {
  return Boolean(env.S3_ENDPOINT && env.S3_ACCESS_KEY && env.S3_SECRET_KEY && env.MEDIA_PUBLIC_BASE_URL);
}
