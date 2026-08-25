// @ts-check
// Playwright 1.62 config for F's-Toybox (M3.2 plan).
// ESM .js: matches package.json's "type": "module".
//
// NOTE: port 8123 (not 8080) to avoid colliding with a stale Python web server
// running on this host (verified 2026-08-25).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  baseURL: 'http://localhost:8123',
  fullyParallel: false,

  webServer: {
    command: 'python3 -m http.server 8123',
    port: 8123,
    reuseExistingServer: true,
    timeout: 10000,
  },

  timeout: 30000,
  expect: {
    timeout: 5000,
  },

  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:8123',
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
