import { chromium, type FullConfig } from '@playwright/test';
import path from 'path';

const STORAGE_STATE_PATH = path.join(__dirname, '..', '.playwright', 'auth-state.json');

export const AUTH_STATE_PATH = STORAGE_STATE_PATH;

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3001';

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login to the dashboard
  await page.goto(`${baseURL}/login`);
  await page.getByPlaceholder('Enter password').fill('admin');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard');

  // Save auth state (localStorage token)
  await context.storageState({ path: STORAGE_STATE_PATH });

  await browser.close();
}

export default globalSetup;
