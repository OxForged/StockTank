import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// findBy*/waitFor default to 1s, which is too short when turbo runs every suite in parallel.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
});
