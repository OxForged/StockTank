import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';

/** OWASP-recommended argon2id parameters (19 MiB, 2 iterations, 1 lane). */
const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummyHashPromise: Promise<string> | undefined;

/**
 * A real argon2id hash of a random secret. Verifying a candidate password against it costs
 * the same as a real verification, so "user not found" and "wrong password" take equal time.
 */
export function getDummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= argon2.hash(randomBytes(32).toString('base64url'), ARGON2_OPTIONS);
  return dummyHashPromise;
}

/** 32 random bytes, base64url-encoded (43 chars). Only its SHA-256 is persisted. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Short, non-reversible identifier for an email so audit rows never contain the raw address. */
export function hashEmailForAudit(email: string): string {
  return sha256Hex(email.trim().toLowerCase()).slice(0, 24);
}
