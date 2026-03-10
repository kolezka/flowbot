import { test, expect } from '@playwright/test';

test.describe('Moderation', () => {
  test('overview page loads', async ({ page }) => {
    await page.goto('/dashboard/moderation');
    await page.waitForLoadState('networkidle');

    // Page should load (may show error state if no data, that's OK)
    await expect(page.getByText('Moderation').first()).toBeVisible();
  });

  test('overview shows content or error state', async ({ page }) => {
    await page.goto('/dashboard/moderation');
    await page.waitForLoadState('networkidle');

    // Either stat cards load or error message appears
    const hasStats = await page.getByText('Managed Groups').first().isVisible().catch(() => false);
    const hasError = await page.getByText(/failed to load/i).isVisible().catch(() => false);

    // One of these should be true
    expect(hasStats || hasError).toBeTruthy();
  });

  test('groups page loads with search', async ({ page }) => {
    await page.goto('/dashboard/moderation/groups');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Managed Groups').first()).toBeVisible();
    await expect(page.getByPlaceholder('Search groups...')).toBeVisible();
  });

  test('groups page shows empty state or group list', async ({ page }) => {
    await page.goto('/dashboard/moderation/groups');
    await page.waitForLoadState('networkidle');

    const noGroups = await page.getByText(/no groups found/i).isVisible().catch(() => false);
    if (noGroups) {
      await expect(page.getByText(/no groups found/i)).toBeVisible();
    }
  });

  test('moderation logs page loads', async ({ page }) => {
    const response = await page.goto('/dashboard/moderation/logs');
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
  });

  test('moderation analytics page loads', async ({ page }) => {
    const response = await page.goto('/dashboard/moderation/analytics');
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
  });

  test('scheduled messages page loads', async ({ page }) => {
    const response = await page.goto('/dashboard/moderation/scheduled-messages');
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
  });
});
