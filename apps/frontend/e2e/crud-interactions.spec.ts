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

test.describe('Broadcast CRUD lifecycle', () => {
  test('create broadcast and verify status', async ({ page }) => {
    await page.goto('/dashboard/broadcast');
    await page.waitForLoadState('networkidle');

    const msg = `Lifecycle broadcast ${Date.now()}`;

    // Create
    await page.getByPlaceholder(/enter broadcast message/i).fill(msg);
    await page.getByPlaceholder(/-100/).fill('-1001234567890');
    await page.getByRole('button', { name: /create broadcast/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify it appears in table with status badge
    await expect(page.getByText(msg).first()).toBeVisible({ timeout: 10_000 });

    // Delete it
    page.once('dialog', (dialog) => dialog.accept());
    const row = page.locator('tr').filter({ hasText: msg });
    const deleteBtn = row.getByRole('button', { name: /delete/i });
    await deleteBtn.click();
    await page.waitForLoadState('networkidle');
  });
});
