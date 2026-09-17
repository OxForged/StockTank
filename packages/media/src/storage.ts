import { createReadStream, createWriteStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { MediaEnv } from './config.js';

/** Storage abstraction (§1.19: no hard coupling to one cloud). S3-compatible today: AWS S3, Cloudflare R2, MinIO. */
export interface ObjectStorage {
  presignUpload(key: string, contentType: string, contentLength: number, expiresSeconds?: number): Promise<string>;
  head(key: string): Promise<{ size: number; contentType: string | undefined } | null>;
  download(key: string, filePath: string): Promise<void>;
  uploadFile(key: string, filePath: string, contentType: string, cacheControl?: string): Promise<void>;
  uploadDirectory(prefix: string, dir: string): Promise<number>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

const CONTENT_TYPES: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.m4s': 'video/iso.segment',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.aac': 'audio/aac',
  '.jpg': 'image/jpeg',
  '.vtt': 'text/vtt',
};

export class S3Storage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(
    private readonly env: MediaEnv,
    client?: S3Client,
  ) {
    this.client =
      client ??
      new S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        forcePathStyle: true,
        credentials: { accessKeyId: env.S3_ACCESS_KEY ?? '', secretAccessKey: env.S3_SECRET_KEY ?? '' },
      });
  }

  private get bucket() {
    return this.env.S3_BUCKET;
  }

  presignUpload(key: string, contentType: string, contentLength: number, expiresSeconds = 3600): Promise<string> {
    return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: contentLength }), {
      expiresIn: expiresSeconds,
    });
  }

  async head(key: string) {
    try {
      const r = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: Number(r.ContentLength ?? 0), contentType: r.ContentType };
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return null;
      throw err;
    }
  }

  async download(key: string, filePath: string): Promise<void> {
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!r.Body) throw new Error(`Object ${key} has no body`);
    await pipeline(r.Body as Readable, createWriteStream(filePath));
  }

  async uploadFile(key: string, filePath: string, contentType: string, cacheControl = 'public, max-age=31536000, immutable'): Promise<void> {
    const { size } = await stat(filePath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentType: contentType,
        ContentLength: size,
        CacheControl: cacheControl,
      }),
    );
  }

  async uploadDirectory(prefix: string, dir: string): Promise<number> {
    let count = 0;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        count += await this.uploadDirectory(`${prefix}/${entry.name}`, full);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        // Playlists can change between renders; segments are immutable.
        const cache = ext === '.m3u8' ? 'public, max-age=60' : 'public, max-age=31536000, immutable';
        await this.uploadFile(`${prefix}/${entry.name}`, full, CONTENT_TYPES[ext] ?? 'application/octet-stream', cache);
        count++;
      }
    }
    return count;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  publicUrl(key: string): string {
    return `${(this.env.MEDIA_PUBLIC_BASE_URL ?? '').replace(/\/$/, '')}/${key}`;
  }

  /**
   * Development/bootstrap: creates the bucket and allows anonymous reads of `renditions/*` only.
   * Originals under `originals/` stay private. In production the CDN/bucket policy is managed by infrastructure.
   */
  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadRenditions',
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucket}/renditions/*`],
        },
      ],
    };
    await this.client.send(new PutBucketPolicyCommand({ Bucket: this.bucket, Policy: JSON.stringify(policy) }));
  }
}
