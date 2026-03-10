import { test, expect } from '@playwright/test';

test.describe('Webhooks', () => {
  test('page loads with heading', async ({ page }) => {
    await page.goto('/dashboard/webhooks');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Webhooks').first()).toBeVisible();
  });

  test('shows empty state or webhook list', async ({ page }) => {
    await page.goto('/dashboard/webhooks');
    await page.waitForLoadState('networkidle');

    const isEmpty = await page.getByText('No webhooks yet').isVisible().catch(() => false);
    if (isEmpty) {
      await expect(page.getByText('Create a webhook to receive external events')).toBeVisible();
    }
  });

  test('new webhook button opens form', async ({ page }) => {
    await page.goto('/dashboard/webhooks');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /new webhook/i }).click();

    // Form should appear
    await expect(page.getByPlaceholder('My webhook')).toBeVisible();
    await expect(page.getByRole('button', { name: /^create$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('create a webhook', async ({ page }) => {
    await page.goto('/dashboard/webhooks');
    await page.waitForLoadState('networkidle');

    // Open form
    await page.getByRole('button', { name: /new webhook/i }).click();
    await page.getByPlaceholder('My webhook').fill(`E2E Webhook ${Date.now()}`);
    await page.getByRole('button', { name: /^create$/i }).click();

    // Webhook should appear (with token and Active badge)
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Active').first()).toBeVisible({ timeout: 10_000 });
  });
});
