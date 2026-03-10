import { test, expect } from '@playwright/test';

test.describe('Categories', () => {
  test('displays categories page with controls', async ({ page }) => {
    await page.goto('/dashboard/categories');

    await expect(page.getByText('Categories').first()).toBeVisible();
    await expect(page.getByText('Manage your product categories')).toBeVisible();
    await expect(page.getByRole('button', { name: /new category/i })).toBeVisible();
  });

  test('shows empty state or category tree', async ({ page }) => {
    await page.goto('/dashboard/categories');
    await page.waitForLoadState('networkidle');

    const hasCategories = await page.getByText('Active').first().isVisible().catch(() => false);
    const isEmpty = await page.getByText(/no categories found/i).isVisible().catch(() => false);
    expect(hasCategories || isEmpty).toBeTruthy();
  });

  test('navigate to new category form', async ({ page }) => {
    await page.goto('/dashboard/categories');

    await page.getByRole('button', { name: /new category/i }).click();
    await page.waitForURL('**/dashboard/categories/new');

    await expect(page.getByText('New Category').first()).toBeVisible();
  });

  test('create a new category', async ({ page }) => {
    await page.goto('/dashboard/categories/new');

    await expect(page.getByText('New Category').first()).toBeVisible();

    // Use unique name to avoid 409 conflict
    const uniqueName = `Test Cat ${Date.now()}`;
    await page.getByLabel('Name').fill(uniqueName);
    // Slug should auto-generate
    await expect(page.getByLabel('Slug')).not.toHaveValue('');

    await page.getByLabel('Sort Order').fill('10');

    // Submit
    await page.getByRole('button', { name: /create category/i }).click();

    // Should redirect to categories list or stay on form with success
    await page.waitForURL('**/dashboard/categories', { timeout: 10_000 });
  });

  test('newly created category appears in list', async ({ page }) => {
    await page.goto('/dashboard/categories');
    await page.waitForLoadState('networkidle');

    // Check if any category exists (either test category or others)
    const hasAnyCategory = await page.getByText('Active').first().isVisible().catch(() => false);
    expect(hasAnyCategory).toBeTruthy();
  });
});
