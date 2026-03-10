import { test, expect } from '@playwright/test';

test.describe('Broadcast', () => {
  test('displays broadcast page with form and table', async ({ page }) => {
    await page.goto('/dashboard/broadcast');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('New Broadcast').first()).toBeVisible();
    await expect(page.getByText('Broadcasts').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /create broadcast/i })).toBeVisible();
  });

  test('broadcast form has message and target fields', async ({ page }) => {
    await page.goto('/dashboard/broadcast');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Message Text')).toBeVisible();
    await expect(page.getByText('Target Chat IDs')).toBeVisible();
    await expect(page.getByPlaceholder(/enter broadcast message/i)).toBeVisible();
  });

  test('create a broadcast', async ({ page }) => {
    await page.goto('/dashboard/broadcast');
    await page.waitForLoadState('networkidle');

    // Fill form using placeholders
    await page.getByPlaceholder(/enter broadcast message/i).fill('E2E test broadcast message');
    await page.getByPlaceholder(/-100/).fill('-1001234567890');

    // Submit
    await page.getByRole('button', { name: /create broadcast/i }).click();

    // Wait for the broadcast to appear in the table
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('E2E test broadcast message').first()).toBeVisible({ timeout: 10_000 });
  });

  test('broadcast table shows headers', async ({ page }) => {
    await page.goto('/dashboard/broadcast');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByText('Text').first()).toBeVisible();
    await expect(page.getByText('Status').first()).toBeVisible();
  });
});
