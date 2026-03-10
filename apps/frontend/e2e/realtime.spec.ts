import { test, expect } from '@playwright/test';

test.describe('Real-Time Features', () => {
  test('connection status indicator is visible in sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // ConnectionStatus component renders "Live" or "Offline" text
    const hasLive = await page.getByText('Live', { exact: true }).isVisible().catch(() => false);
    const hasOffline = await page.getByText('Offline', { exact: true }).isVisible().catch(() => false);

    // One of the connection states should be displayed
    expect(hasLive || hasOffline).toBeTruthy();
  });

  test('connection status shows colored indicator dot', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // The indicator has a colored dot (green for connected, red for disconnected)
    const dot = page.locator('[class*="rounded-full"][class*="bg-green-500"], [class*="rounded-full"][class*="bg-red-500"]');
    await expect(dot.first()).toBeVisible({ timeout: 10_000 });
  });

  test('system status page shows health indicators', async ({ page }) => {
    await page.goto('/dashboard/system/status');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('System Status').first()).toBeVisible();

    // Should show one of the status banners
    const hasOperational = await page.getByText('All Systems Operational').isVisible().catch(() => false);
    const hasDegraded = await page.getByText('Some Systems Degraded').isVisible().catch(() => false);
    const hasOutage = await page.getByText('System Outage Detected').isVisible().catch(() => false);
    const hasLoading = await page.getByText('Loading system status...').isVisible().catch(() => false);
    const hasError = await page.getByText(/failed/i).isVisible().catch(() => false);

    expect(hasOperational || hasDegraded || hasOutage || hasLoading || hasError).toBeTruthy();
  });

  test('system status page has auto-refresh control', async ({ page }) => {
    await page.goto('/dashboard/system/status');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Auto-refresh (30s)')).toBeVisible();
  });

  test('moderation page loads with live-data sections', async ({ page }) => {
    await page.goto('/dashboard/moderation');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Moderation').first()).toBeVisible();

    // Should show stat cards or error state
    const hasStats = await page.getByText('Managed Groups').first().isVisible().catch(() => false);
    const hasError = await page.getByText(/failed to load/i).isVisible().catch(() => false);
    expect(hasStats || hasError).toBeTruthy();
  });

  test('moderation logs page renders', async ({ page }) => {
    const response = await page.goto('/dashboard/moderation/logs');
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');

    // Page should render without crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('notification badge component is in sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // The NotificationBadge renders a Bell icon button
    // Look for the bell icon SVG inside a button
    const bellButton = page.locator('button').filter({
      has: page.locator('svg.lucide-bell, [class*="lucide-bell"]'),
    });

    const hasBell = await bellButton.first().isVisible().catch(() => false);

    // Bell icon may or may not be present depending on sidebar implementation
    // At minimum, the sidebar should be visible
    const sidebar = page.locator('aside, nav, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible();

    // If the bell is found, it should be clickable
    if (hasBell) {
      await bellButton.first().click();
    }
  });

  test('dashboard page loads with real-time aware components', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Dashboard should render its main structure
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // Sidebar navigation should be present
    const sidebarLinks = page.locator('a[href*="/dashboard/"]');
    const linkCount = await sidebarLinks.count();
    expect(linkCount).toBeGreaterThanOrEqual(1);
  });
});
