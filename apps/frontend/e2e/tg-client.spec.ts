import { test, expect } from '@playwright/test';

test.describe('TG Client', () => {
  test('management page loads', async ({ page }) => {
    await page.goto('/dashboard/tg-client');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('TG Client Management').first()).toBeVisible();
  });

  test('shows health metrics or error', async ({ page }) => {
    await page.goto('/dashboard/tg-client');
    await page.waitForLoadState('networkidle');

    const hasActiveLabel = await page.getByText('Active Sessions').first().isVisible().catch(() => false);
    const hasHealthy = await page.getByText('Healthy').first().isVisible().catch(() => false);
    expect(hasActiveLabel || hasHealthy).toBeTruthy();
  });

  test('sessions section exists', async ({ page }) => {
    await page.goto('/dashboard/tg-client');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Sessions').first()).toBeVisible();
  });

  test('health page loads', async ({ page }) => {
    const response = await page.goto('/dashboard/tg-client/health');
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
  });

  test('new session button links to auth wizard', async ({ page }) => {
    await page.goto('/dashboard/tg-client');
    await page.waitForLoadState('networkidle');

    const newSessionBtn = page.getByRole('link', { name: /new session/i });
    await expect(newSessionBtn).toBeVisible();

    // Verify the link points to the auth page
    const href = await newSessionBtn.getAttribute('href');
    expect(href).toContain('/dashboard/tg-client/auth');
  });

  test('sessions list shows entries or empty state', async ({ page }) => {
    await page.goto('/dashboard/tg-client');
    await page.waitForLoadState('networkidle');

    // Either sessions are listed or empty state
    const hasSessions = await page.locator('a[href*="/dashboard/tg-client/sessions/"]').first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText('No sessions found').isVisible().catch(() => false);
    expect(hasSessions || hasEmpty).toBeTruthy();
  });

  test('can navigate to session detail if sessions exist', async ({ page }) => {
    await page.goto('/dashboard/tg-client');
    await page.waitForLoadState('networkidle');

    const sessionLink = page.locator('a[href*="/dashboard/tg-client/sessions/"]').first();
    const hasSession = await sessionLink.isVisible().catch(() => false);

    if (hasSession) {
      await sessionLink.click();
      await page.waitForURL(/\/dashboard\/tg-client\/sessions\/.+/, { timeout: 10_000 });

      // Session detail page should load without crashing
      const response = page.url();
      expect(response).toMatch(/\/dashboard\/tg-client\/sessions\/.+/);
    }
  });

  test('health metrics page shows stat cards', async ({ page }) => {
    await page.goto('/dashboard/tg-client/health');
    await page.waitForLoadState('networkidle');

    // Either health data loads or error state
    const hasHealthTitle = await page.getByText('Transport Health').first().isVisible().catch(() => false);
    const hasError = await page.locator('[class*="destructive"]').first().isVisible().catch(() => false);

    if (hasHealthTitle) {
      // Should show stat cards: Active Sessions, Healthy, Errors, Msgs/min
      await expect(page.getByText('Active Sessions').first()).toBeVisible();
      await expect(page.getByText('Healthy').first()).toBeVisible();
      await expect(page.getByText('Errors').first()).toBeVisible();
      await expect(page.getByText('Msgs/min').first()).toBeVisible();
    }

    expect(hasHealthTitle || hasError).toBeTruthy();
  });

  test('health page shows circuit breaker section', async ({ page }) => {
    await page.goto('/dashboard/tg-client/health');
    await page.waitForLoadState('networkidle');

    const hasHealthTitle = await page.getByText('Transport Health').first().isVisible().catch(() => false);

    if (hasHealthTitle) {
      // Circuit Breaker card should be present
      await expect(page.getByText('Circuit Breaker').first()).toBeVisible();

      // Message Throughput card should be present
      await expect(page.getByText('Message Throughput').first()).toBeVisible();
    }
  });

  test('health page has refresh button', async ({ page }) => {
    await page.goto('/dashboard/tg-client/health');
    await page.waitForLoadState('networkidle');

    const hasHealthTitle = await page.getByText('Transport Health').first().isVisible().catch(() => false);

    if (hasHealthTitle) {
      const refreshBtn = page.getByRole('button', { name: /refresh/i });
      await expect(refreshBtn).toBeVisible();
    }
  });

  test('auth wizard page shows phone step', async ({ page }) => {
    await page.goto('/dashboard/tg-client/auth');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('New Session Authentication')).toBeVisible();

    // Phone step should be active by default
    await expect(page.getByText('Phone Number')).toBeVisible();
    await expect(page.getByText('Enter the phone number for MTProto authentication')).toBeVisible();

    // Phone input field should be present
    await expect(page.getByPlaceholder('+1234567890')).toBeVisible();

    // Send Code button should be present but disabled (no phone entered)
    const sendBtn = page.getByRole('button', { name: /send code/i });
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeDisabled();
  });

  test('auth wizard enables send button when phone is entered', async ({ page }) => {
    await page.goto('/dashboard/tg-client/auth');
    await page.waitForLoadState('networkidle');

    const phoneInput = page.getByPlaceholder('+1234567890');
    await phoneInput.fill('+1234567890');

    const sendBtn = page.getByRole('button', { name: /send code/i });
    await expect(sendBtn).toBeEnabled();
  });

  test('auth wizard shows step indicators', async ({ page }) => {
    await page.goto('/dashboard/tg-client/auth');
    await page.waitForLoadState('networkidle');

    // Step indicators (1, 2, 3, 4) should be visible
    const stepIndicators = page.locator('[class*="rounded-full"][class*="flex"]');
    const count = await stepIndicators.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });
});
