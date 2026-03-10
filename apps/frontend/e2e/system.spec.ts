import { test, expect } from '@playwright/test';

test.describe('System Status', () => {
  test('page loads with heading', async ({ page }) => {
    await page.goto('/dashboard/system/status');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('System Status').first()).toBeVisible();
  });

  test('shows status banner or loading state', async ({ page }) => {
    await page.goto('/dashboard/system/status');
    await page.waitForLoadState('networkidle');

    // Should show one of the status banners or loading
    const hasOperational = await page.getByText('All Systems Operational').isVisible().catch(() => false);
    const hasDegraded = await page.getByText('Some Systems Degraded').isVisible().catch(() => false);
    const hasOutage = await page.getByText('System Outage Detected').isVisible().catch(() => false);
    const hasLoading = await page.getByText('Loading system status...').isVisible().catch(() => false);
    const hasError = await page.getByText(/last refresh failed/i).isVisible().catch(() => false);

    expect(hasOperational || hasDegraded || hasOutage || hasLoading || hasError).toBeTruthy();
  });

  test('auto-refresh checkbox is visible', async ({ page }) => {
    await page.goto('/dashboard/system/status');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Auto-refresh (30s)')).toBeVisible();
  });
});
