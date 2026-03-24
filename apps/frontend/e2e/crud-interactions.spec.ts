import { test, expect } from './fixtures/auth';

test.describe('Webhook CRUD lifecycle', () => {
  test('create and delete a webhook', async ({ page }) => {
    await page.goto('/dashboard/webhooks');
    await page.waitForLoadState('networkidle');

    const webhookName = `Lifecycle WH ${Date.now()}`;

    // Create
    await page.getByRole('button', { name: /new webhook/i }).click();
    await page.getByPlaceholder('My webhook').fill(webhookName);
    await page.getByRole('button', { name: /^create$/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify it appears with Active badge
    await expect(page.getByText(webhookName)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Active').first()).toBeVisible();

    // Delete it (trash icon button)
    const webhookRow = page.locator('div').filter({ hasText: webhookName }).first();
    const deleteBtn = webhookRow.locator('button').filter({ has: page.locator('svg') }).last();
    await deleteBtn.click();
    await page.waitForLoadState('networkidle');
  });
});

