import { test, expect } from '@playwright/test';

test.describe('Products', () => {
  test('displays products page with controls', async ({ page }) => {
    await page.goto('/dashboard/products');

    await expect(page.getByText('Products').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /new product/i })).toBeVisible();
    await expect(page.getByPlaceholder('Search by name...')).toBeVisible();
  });

  test('shows empty state or product table', async ({ page }) => {
    await page.goto('/dashboard/products');
    await page.waitForLoadState('networkidle');

    const hasProducts = await page.locator('table').isVisible().catch(() => false);
    if (!hasProducts) {
      await expect(page.getByText(/no products found/i)).toBeVisible();
    }
  });

  test('navigate to new product form', async ({ page }) => {
    await page.goto('/dashboard/products');

    await page.getByRole('button', { name: /new product/i }).click();
    await page.waitForURL('**/dashboard/products/new');

    await expect(page.getByText('New Product').first()).toBeVisible();
    await expect(page.getByText('Create a new product')).toBeVisible();
  });

  test('new product form has required fields', async ({ page }) => {
    await page.goto('/dashboard/products/new');

    await expect(page.getByPlaceholder('Product name')).toBeVisible();
    await expect(page.getByPlaceholder('0.00').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /create product/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('create a new product', async ({ page }) => {
    await page.goto('/dashboard/products/new');
    await page.waitForLoadState('networkidle');

    // Fill name
    await page.getByPlaceholder('Product name').fill(`Test Product ${Date.now()}`);

    // Generate slug
    await page.getByRole('button', { name: /generate/i }).click();

    // Fill price
    await page.getByPlaceholder('0.00').first().fill('29.99');

    // Select category (Radix Select) - click the trigger button
    await page.locator('button').filter({ hasText: 'Select category' }).click();
    // Wait for the popover to appear and click the first item
    await page.locator('[role="option"]').first().click();

    // Scroll to bottom and submit
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    const submitBtn = page.getByRole('button', { name: /create product/i });
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();

    // Should redirect to products list or show success
    await page.waitForURL('**/dashboard/products', { timeout: 15_000 });
  });

  test('search filters products', async ({ page }) => {
    await page.goto('/dashboard/products');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder('Search by name...');
    await searchInput.fill('nonexistent-product-xyz-99999');

    // Wait for debounced search to execute
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Nonexistent search term should show "No products found"
    await expect(page.getByText(/no products found/i)).toBeVisible({ timeout: 5_000 });
  });
});
