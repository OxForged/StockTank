/**
 * Vitest setup: point the API at the real `stocktank_test` database.
 * Tests delete users/sessions/audit rows, so refuse to run against anything that is not a test DB.
 */
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL must be set (see .env.example) to run the API tests');
}
if (!/test/i.test(new URL(testDatabaseUrl).pathname)) {
  throw new Error(`Refusing to run tests: TEST_DATABASE_URL database name must contain "test" (got ${testDatabaseUrl})`);
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';
