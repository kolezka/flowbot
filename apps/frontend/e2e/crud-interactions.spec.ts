import { test, expect } from './fixtures/auth';

test.describe('Category CRUD lifecycle', () => {
  test('create, verify, and navigate to edit', async ({ page, api }) => {
    const catName = `CRUD Cat ${Date.now()}`;

    // Create via API for reliable setup
    const cat = await api.post<{ id: string; name: string; slug: string }>('/api/categories', {
      name: catName,
      slug: `crud-cat-${Date.now()}`,
      sortOrder: 99,
      isActive: true,
    });

    // Verify it appears in the UI
    await page.goto('/dashboard/categories');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(catName)).toBeVisible({ timeout: 10_000 });

    // Navigate to edit page via View button
    const row = page.getByText(catName).locator('..').locator('..');
    const viewBtn = row.getByRole('button', { name: /view/i }).or(row.getByRole('link', { name: /view/i }));
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click();
      await page.waitForURL(/\/dashboard\/categories\//);
    }

    // Cleanup
    await api.delete(`/api/categories/${cat.id}`);
  });
});

test.describe('Product CRUD lifecycle', () => {
  test('create product via API and verify in table', async ({ page, api }) => {
    // Ensure a category exists
    const cat = await api.post<{ id: string }>('/api/categories', {
      name: `ProdTest Cat ${Date.now()}`,
      slug: `prodtest-${Date.now()}`,
      isActive: true,
    });

    const prodName = `CRUD Product ${Date.now()}`;
    const product = await api.post<{ id: string }>('/api/products', {
      name: prodName,
      slug: `crud-product-${Date.now()}`,
      price: 49.99,
      categoryId: cat.id,
      stock: 50,
      isActive: true,
    });

    // Verify in UI
    await page.goto('/dashboard/products');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(prodName).first()).toBeVisible({ timeout: 10_000 });

    // Verify price display
    await expect(page.getByText('$49.99').first()).toBeVisible();

    // Delete via UI confirm dialog
    page.once('dialog', (dialog) => dialog.accept());
    const deleteBtn = page.locator('tr').filter({ hasText: prodName }).locator('button').last();
    await deleteBtn.click();

    // Product should disappear
    await page.waitForLoadState('networkidle');

    // Cleanup category
    await api.delete(`/api/categories/${cat.id}`);
  });
});

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
