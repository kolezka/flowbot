import { test, expect } from '@playwright/test';

test.describe('Flows', () => {
  test('displays flows page with heading and button', async ({ page }) => {
    await page.goto('/dashboard/flows');
    await page.waitForLoadState('networkidle');

    // The main content area has an h1 "Flows"
    const mainContent = page.locator('main, [class*="flex-1"]').first();
    await expect(mainContent.getByText('Flows').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /new flow/i })).toBeVisible();
  });

  test('shows empty state or flow cards', async ({ page }) => {
    await page.goto('/dashboard/flows');
    await page.waitForLoadState('networkidle');

    const isEmpty = await page.getByText('No flows yet').isVisible().catch(() => false);
    if (isEmpty) {
      await expect(page.getByText('Create your first automation flow')).toBeVisible();
      await expect(page.getByRole('button', { name: /create flow/i })).toBeVisible();
    }
  });

  test('create a new flow and open editor', async ({ page }) => {
    await page.goto('/dashboard/flows');
    await page.waitForLoadState('networkidle');

    // Click create button
    const newFlowBtn = page.getByRole('button', { name: /new flow|create flow/i }).first();
    await newFlowBtn.click();

    // Should navigate to editor
    await page.waitForURL(/\/dashboard\/flows\/.+\/edit/, { timeout: 15_000 });

    // React Flow canvas should be present
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10_000 });
  });
});
