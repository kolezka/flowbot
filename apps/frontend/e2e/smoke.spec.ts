import { test, expect } from '@playwright/test';

test.describe('Dashboard home', () => {
  test('loads with KPI cards', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByText('Total Users')).toBeVisible();
    await expect(page.getByText('Active Groups')).toBeVisible();
    await expect(page.getByText('Active Warnings')).toBeVisible();
    await expect(page.getByText('Pending Jobs')).toBeVisible();
  });

  test('shows automation and group health sections', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByText('Automation').first()).toBeVisible();
    await expect(page.getByText('Group Health')).toBeVisible();
    await expect(page.getByText('Quick Links')).toBeVisible();
  });

  test('recent activity section is visible', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByText('Recent Activity')).toBeVisible();
  });

  test('quick links navigate correctly', async ({ page }) => {
    await page.goto('/dashboard');

    // Scroll to quick links and click "All groups" button
    const allGroupsBtn = page.getByRole('button', { name: /all groups/i });
    await allGroupsBtn.scrollIntoViewIfNeeded();
    await allGroupsBtn.click();

    await expect(page).toHaveURL(/\/dashboard\/moderation\/groups/);
  });
});

test.describe('Page navigation smoke tests', () => {
  const pages = [
    { path: '/dashboard/identity/accounts', text: /accounts/i },
    { path: '/dashboard/broadcast', text: /broadcast/i },
    { path: '/dashboard/moderation', text: /moderation/i },
    { path: '/dashboard/flows', text: /flows/i },
    { path: '/dashboard/bot-config', text: /bot/i },
    { path: '/dashboard/automation/jobs', text: /jobs|automation/i },
    { path: '/dashboard/community/reputation', text: /reputation/i },
  ];

  for (const { path, text } of pages) {
    test(`${path} loads successfully`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBeLessThan(400);

      await page.waitForLoadState('networkidle');

      await expect(page.getByText(text).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});
