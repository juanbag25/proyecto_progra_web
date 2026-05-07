import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Pure-logic tests for the nutrition engine, optimizer, etc. live under
// `tests/`. UI / E2E tests land in Phase 9 with Playwright in its own runner.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
  },
});
