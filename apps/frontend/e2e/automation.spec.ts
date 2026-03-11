import { test, expect } from '@playwright/test';

test.describe('Automation', () => {
  test('health page loads', async ({ page }) => {
    await page.goto('/dashboard/automation/health');
    await page.waitForLoadState('networkidle');

    // Should show health heading or loading/error
    const hasHealth = await page.getByText('TG Client Health').first().isVisible().catch(() => false);
    const hasLoading = await page.getByText('Loading health data...').isVisible().catch(() => false);
    expect(hasHealth || hasLoading).toBeTruthy();
  });

  test('jobs page loads', async ({ page }) => {
    const response = await page.goto('/dashboard/automation/jobs');
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
  });

  test('crosspost templates page loads', async ({ page }) => {
    await page.goto('/dashboard/automation/crosspost-templates');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Cross-post Templates').first()).toBeVisible();
  });

  test('crosspost templates shows empty state or list', async ({ page }) => {
    await page.goto('/dashboard/automation/crosspost-templates');
    await page.waitForLoadState('networkidle');

    const isEmpty = await page.getByText('No cross-post templates yet.').isVisible().catch(() => false);
    if (isEmpty) {
      await expect(page.getByText('No cross-post templates yet.')).toBeVisible();
    } else {
      // Templates exist - verify table headers
      await expect(page.getByText('Name').first()).toBeVisible();
    }
  });

});
