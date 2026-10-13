import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

// Authenticated specs must sign in to a real (test) Supabase project, so load
// the developer's .env.local for those runs. Without this, the placeholder
// values below would override it and every sign-in would fail. Anonymous runs
// skip this and keep needing no credentials at all.
const authenticatedRun = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
if (authenticatedRun && !process.env.E2E_BASE_URL) {
  loadEnvConfig(path.resolve(__dirname, '..'), true);
}

// Without E2E_BASE_URL the suite starts `next dev` with placeholder public
// Supabase values, so it runs with no production credentials. Authenticated
// specs need a real test project and are skipped unless E2E_EMAIL and
// E2E_PASSWORD are set (see docs/testing).
export default defineConfig({
  testDir: '../e2e',
  outputDir: '../test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]]
    : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-small', use: { ...devices['iPhone SE'], browserName: 'chromium' } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        cwd: path.resolve(__dirname, '..'),
        command: `npx next dev --webpack -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          NEXT_PUBLIC_APP_URL: baseURL,
          NEXT_PUBLIC_SUPABASE_URL:
            process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
          NEXT_PUBLIC_SUPABASE_ANON_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'e2e-placeholder-anon-key',
        },
      },
});
