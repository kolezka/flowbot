import { test, expect } from '@playwright/test';

test.describe('Bot Configuration', () => {
  test('page loads with heading', async ({ page }) => {
    await page.goto('/dashboard/bot-config');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Bot Configuration').first()).toBeVisible();
  });

  test('shows empty state or bot cards', async ({ page }) => {
    await page.goto('/dashboard/bot-config');
    await page.waitForLoadState('networkidle');

    const noBots = await page.getByText('No bots configured').isVisible().catch(() => false);
    if (noBots) {
      await expect(page.getByText('Bot instances will appear here once registered')).toBeVisible();
    }
  });

  test('can navigate to bot detail page if bots exist', async ({ page }) => {
    await page.goto('/dashboard/bot-config');
    await page.waitForLoadState('networkidle');

    const noBots = await page.getByText('No bots configured').isVisible().catch(() => false);
    if (noBots) {
      // No bots to navigate to; skip gracefully
      return;
    }

    // Click the first bot card link
    const botLink = page.locator('a[href*="/dashboard/bot-config/"]').first();
    const hasBotLink = await botLink.isVisible().catch(() => false);

    if (hasBotLink) {
      await botLink.click();
      await page.waitForURL(/\/dashboard\/bot-config\/.+/, { timeout: 10_000 });

      // Bot detail page should show the bot name and sub-page navigation
      const hasCommands = await page.getByText('Commands').first().isVisible().catch(() => false);
      const hasResponses = await page.getByText('Responses').first().isVisible().catch(() => false);
      const hasMenus = await page.getByText('Menus').first().isVisible().catch(() => false);

      expect(hasCommands || hasResponses || hasMenus).toBeTruthy();
    }
  });

  test('bot detail page shows sub-page navigation cards', async ({ page }) => {
    await page.goto('/dashboard/bot-config');
    await page.waitForLoadState('networkidle');

    const noBots = await page.getByText('No bots configured').isVisible().catch(() => false);
    if (noBots) return;

    const botLink = page.locator('a[href*="/dashboard/bot-config/"]').first();
    if (!(await botLink.isVisible().catch(() => false))) return;

    await botLink.click();
    await page.waitForURL(/\/dashboard\/bot-config\/.+/, { timeout: 10_000 });

    // Sub-page nav cards: Commands, Responses, Menus, i18n Strings
    await expect(page.getByText('Commands').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Responses').first()).toBeVisible();
    await expect(page.getByText('Menus').first()).toBeVisible();

    // Publish Config button should be present
    const publishBtn = page.getByRole('button', { name: /publish config/i });
    await expect(publishBtn).toBeVisible();
  });

  test('commands sub-page loads', async ({ page }) => {
    await page.goto('/dashboard/bot-config');
    await page.waitForLoadState('networkidle');

    const noBots = await page.getByText('No bots configured').isVisible().catch(() => false);
    if (noBots) return;

    const botLink = page.locator('a[href*="/dashboard/bot-config/"]').first();
    if (!(await botLink.isVisible().catch(() => false))) return;

    await botLink.click();
    await page.waitForURL(/\/dashboard\/bot-config\/.+/, { timeout: 10_000 });

    // Navigate to commands sub-page
    const commandsLink = page.locator('a[href*="/commands"]').first();
    if (!(await commandsLink.isVisible().catch(() => false))) return;

    await commandsLink.click();
    await page.waitForURL(/\/commands/, { timeout: 10_000 });

    // Commands page heading
    await expect(page.getByText('Commands').first()).toBeVisible();
    await expect(page.getByText('Manage bot commands').first()).toBeVisible();

    // Add Command button
    await expect(page.getByRole('button', { name: /add command/i })).toBeVisible();

    // Either commands are listed or empty state
    const hasCommands = await page.locator('[class*="font-mono"]').first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText('No commands configured').isVisible().catch(() => false);
    expect(hasCommands || hasEmpty).toBeTruthy();
  });

  test('responses sub-page loads', async ({ page }) => {
    await page.goto('/dashboard/bot-config');
    await page.waitForLoadState('networkidle');

    const noBots = await page.getByText('No bots configured').isVisible().catch(() => false);
    if (noBots) return;

    const botLink = page.locator('a[href*="/dashboard/bot-config/"]').first();
    if (!(await botLink.isVisible().catch(() => false))) return;

    await botLink.click();
    await page.waitForURL(/\/dashboard\/bot-config\/.+/, { timeout: 10_000 });

    // Navigate to responses sub-page
    const responsesLink = page.locator('a[href*="/responses"]').first();
    if (!(await responsesLink.isVisible().catch(() => false))) return;

    await responsesLink.click();
    await page.waitForURL(/\/responses/, { timeout: 10_000 });

    // Responses page heading
    await expect(page.getByText('Responses').first()).toBeVisible();
    await expect(page.getByText('Manage bot response templates').first()).toBeVisible();

    // Add Response button
    await expect(page.getByRole('button', { name: /add response/i })).toBeVisible();
  });

  test('bot detail page shows version history section', async ({ page }) => {
    await page.goto('/dashboard/bot-config');
    await page.waitForLoadState('networkidle');

    const noBots = await page.getByText('No bots configured').isVisible().catch(() => false);
    if (noBots) return;

    const botLink = page.locator('a[href*="/dashboard/bot-config/"]').first();
    if (!(await botLink.isVisible().catch(() => false))) return;

    await botLink.click();
    await page.waitForURL(/\/dashboard\/bot-config\/.+/, { timeout: 10_000 });

    // Version History section should be present
    await expect(page.getByText('Version History').first()).toBeVisible({ timeout: 10_000 });

    // Either versions exist or empty state
    const hasVersions = await page.getByText(/^v\d/).isVisible().catch(() => false);
    const hasEmpty = await page.getByText('No versions published yet').isVisible().catch(() => false);
    expect(hasVersions || hasEmpty).toBeTruthy();
  });
});
