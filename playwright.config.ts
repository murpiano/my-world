import { defineConfig, devices } from '@playwright/test';
import { localStack } from './e2e/stack';

const stack = localStack();
const PORT = 4173;

/**
 * End-to-end: the built app, as it is deployed, against the local Supabase (`npm run db:start`)
 * with the migrations and the Edge Functions of this checkout. Nothing here reaches the real
 * project.
 */
export default defineConfig({
  testDir: 'e2e',
  // every test makes its own accounts, but one browser at a time keeps the local stack calm
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      // these win over .env.local, so a local build never points the tests at the real project
      VITE_SUPABASE_URL: stack.url,
      VITE_SUPABASE_KEY: stack.publishableKey,
      VITE_BASE: '/',
    },
  },
});
