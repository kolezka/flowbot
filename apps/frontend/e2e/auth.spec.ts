import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('shows login page with password field', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('Flowbot Dashboard')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('rejects invalid password', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('Enter password').fill('wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/invalid password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('Enter password').fill('admin');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('authenticated user is redirected from login to dashboard', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.getByPlaceholder('Enter password').fill('admin');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard');

    // Navigate back to login - should redirect to dashboard
    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });
});
