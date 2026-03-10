import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ authenticatedPage: import('@playwright/test').Page }>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByPlaceholder('Password').fill('admin');
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await page.waitForURL('/dashboard');
    await use(page);
  },
});

export { expect };
