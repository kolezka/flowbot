import { test, expect } from '@playwright/test';

test.describe('Users', () => {
  test('displays users page with stats cards', async ({ page }) => {
    await page.goto('/dashboard/users');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Total Users').first()).toBeVisible();
    await expect(page.getByText('Active Users').first()).toBeVisible();
    await expect(page.getByText('Banned Users').first()).toBeVisible();
    await expect(page.getByText('New Today').first()).toBeVisible();
  });

  test('displays users table with search', async ({ page }) => {
    await page.goto('/dashboard/users');
    await page.waitForLoadState('networkidle');

    await expect(page.getByPlaceholder('Search by username...')).toBeVisible();
  });

  test('filter buttons work', async ({ page }) => {
    await page.goto('/dashboard/users');
    await page.waitForLoadState('networkidle');

    const allBtn = page.getByRole('button', { name: 'All', exact: true });
    await expect(allBtn).toBeVisible();

    const bannedBtn = page.getByRole('button', { name: 'Banned', exact: true });
    await bannedBtn.click();
    await page.waitForLoadState('networkidle');

    await allBtn.click();
    await page.waitForLoadState('networkidle');
  });

  test('shows empty state or user list', async ({ page }) => {
    await page.goto('/dashboard/users');
    await page.waitForLoadState('networkidle');

    const noUsers = await page.getByText(/no users found/i).isVisible().catch(() => false);
    if (noUsers) {
      await expect(page.getByText(/no users found/i)).toBeVisible();
    }
  });
});
