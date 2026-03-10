import { test, expect } from '@playwright/test';

test.describe('Bot Configuration', () => {
  test('page loads with heading', async ({ page }) => {
    await page.goto('/dashboard/bot-config');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Bot Configuration').first()).toBeVisible();
  });

  test('shows empty state or bot cards', async ({ page }) => {
    await page.goto('/dashboard/bot-config');
    await page.waitForLoadState('networkidle');

    const noBots = await page.getByText('No bots configured').isVisible().catch(() => false);
    if (noBots) {
      await expect(page.getByText('Bot instances will appear here once registered')).toBeVisible();
    }
  });
});
