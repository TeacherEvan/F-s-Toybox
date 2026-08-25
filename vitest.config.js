import { defineConfig } from 'vitest/config';

// F's-Toybox: Vitest runs unit tests in tests/*.test.js.
// Playwright runs E2E tests in tests/e2e/*.spec.js (configured separately in
// playwright.config.js). We must EXCLUDE tests/e2e from Vitest's default
// include glob, otherwise Vitest tries to execute Playwright's `test()`
// helper and fails with "Playwright Test did not expect test() to be called
// here" (verified 2026-08-25).
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules/**', 'tests/e2e/**', 'dist/**'],
  },
});
