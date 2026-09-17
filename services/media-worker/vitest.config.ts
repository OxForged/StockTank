import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    fileParallelism: false,
    // Real FFmpeg encodes run in the integration suite.
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});
