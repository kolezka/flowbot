import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const AUTH_STATE_PATH = path.join(__dirname, '.playwright', 'auth-state.json');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STATE_PATH,
      },
      testIgnore: '**/auth.spec.ts',
    },
    {
      name: 'unauthenticated',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/auth.spec.ts',
    },
  ],
  webServer: [
    {
      command: 'DASHBOARD_SECRET=admin DATABASE_URL=postgresql://postgres:postgres@localhost:5432/strefaruchu_db pnpm api start:dev',
      url: 'http://localhost:3000/api/docs',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: path.join(__dirname, '..', '..'),
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
