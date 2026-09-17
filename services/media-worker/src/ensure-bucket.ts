import { isStorageConfigured, loadMediaEnv, S3Storage } from '@stocktank/media';

/** Creates the media bucket and its rendition-only public read policy (development and first deploys). */
const env = loadMediaEnv();
if (!isStorageConfigured(env)) {
  console.error('Object storage is not configured (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, MEDIA_PUBLIC_BASE_URL)');
  process.exit(1);
}
await new S3Storage(env).ensureBucket();
console.log(`Bucket "${env.S3_BUCKET}" ready: renditions/* are publicly readable, originals/* are private.`);
