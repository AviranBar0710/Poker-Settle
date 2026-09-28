import { defineConfig } from '@playwright/test';

/**
 * Pure unit tests (no browser, no dev server). Run with: npm run test:unit
 */
export default defineConfig({
  testDir: './tests/unit',
  reporter: 'list',
});
