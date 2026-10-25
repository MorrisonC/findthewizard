import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Unit tests live in `tests/`. The Playwright flows in `e2e/` drive a real
 * browser and are run with `node e2e/<name>.mjs`, so they must stay out of the
 * vitest run.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
