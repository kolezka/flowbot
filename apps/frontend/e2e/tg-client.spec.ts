import { test, expect } from '@playwright/test';

test.describe('TG Client', () => {
  test('management page loads', async ({ page }) => {
    await page.goto('/dashboard/tg-client');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('TG Client Management').first()).toBeVisible();
  });

  test('shows health metrics or error', async ({ page }) => {
    await page.goto('/dashboard/tg-client');
    await page.waitForLoadState('networkidle');

    // Should show health cards or an error
    const hasActiveLabel = await page.getByText('Active Sessions').first().isVisible().catch(() => false);
    const hasHealthy = await page.getByText('Healthy').first().isVisible().catch(() => false);
    expect(hasActiveLabel || hasHealthy).toBeTruthy();
  });

  test('sessions section exists', async ({ page }) => {
    await page.goto('/dashboard/tg-client');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Sessions').first()).toBeVisible();
  });

  test('health page loads', async ({ page }) => {
    const response = await page.goto('/dashboard/tg-client/health');
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
  });
});
