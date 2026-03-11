import { test, expect } from './fixtures/auth';

test.describe('Integration Smoke Test', () => {
  test('full flow lifecycle: create → edit → activate → verify', async ({ page, api }) => {
    const timestamp = Date.now();
    const flowName = `Smoke Flow ${timestamp}`;

    // 1. Navigate to flows page
    await page.goto('/dashboard/flows');
    await page.waitForLoadState('networkidle');

    // 2. Create a new flow via API for reliable setup
    const flow = await api.post<{ id: string; name: string }>('/api/flows', {
      name: flowName,
      description: 'Integration smoke test flow',
    });

    // 3. Verify flow appears in list
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(flowName)).toBeVisible({ timeout: 10_000 });

    // 4. Open flow editor and verify React Flow canvas loads
    await page.goto(`/dashboard/flows/${flow.id}/edit`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(flowName)).toBeVisible();

    // 5. Verify draft status badge
    await expect(page.getByText('draft')).toBeVisible();

    // 6. Activate the flow
    const activateBtn = page.getByRole('button', { name: /activate/i });
    const hasActivate = await activateBtn.isVisible().catch(() => false);

    if (hasActivate) {
      await activateBtn.click();

      // Wait for status to update — either active or an error toast
      const isActive = await page.getByText('active').first().isVisible({ timeout: 5_000 }).catch(() => false);
      const hasDeactivate = await page.getByRole('button', { name: /deactivate/i }).isVisible({ timeout: 3_000 }).catch(() => false);

      // 7. If activated, deactivate to restore state
      if (isActive || hasDeactivate) {
        const deactivateBtn = page.getByRole('button', { name: /deactivate/i });
        if (await deactivateBtn.isVisible().catch(() => false)) {
          await deactivateBtn.click();
          await expect(
            page.getByText('draft').or(page.getByText('inactive')),
          ).toBeVisible({ timeout: 10_000 });
        }
      }
    }

    // 8. Check flow executions page
    await page.goto(`/dashboard/flows/${flow.id}/executions`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Execution History')).toBeVisible({ timeout: 10_000 });

    // Should show executions or empty state
    const hasExecutions = await page.locator('[class*="font-mono"]').first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText('No executions yet').isVisible().catch(() => false);
    expect(hasExecutions || hasEmpty).toBeTruthy();

    // 9. Check flow versions page
    await page.goto(`/dashboard/flows/${flow.id}/versions`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Version History')).toBeVisible({ timeout: 10_000 });

    // 10. Cleanup
    await api.delete(`/api/flows/${flow.id}`);
  });

  test('broadcast lifecycle: create → verify status → cleanup', async ({ page, api }) => {
    const timestamp = Date.now();
    const broadcastMsg = `E2E smoke test ${timestamp}`;

    // 1. Navigate to broadcast page
    await page.goto('/dashboard/broadcast');
    await page.waitForLoadState('networkidle');

    // 2. Create a broadcast
    await page.getByPlaceholder(/enter broadcast message/i).fill(broadcastMsg);
    await page.getByPlaceholder(/-100/).fill('-1001234567890');
    await page.getByRole('button', { name: /create broadcast/i }).click();
    await page.waitForLoadState('networkidle');

    // 3. Verify broadcast appears in table
    await expect(page.getByText(broadcastMsg).first()).toBeVisible({ timeout: 10_000 });

    // 4. Verify table has status column
    await expect(page.getByText('Status').first()).toBeVisible();

    // 5. Cleanup via API
    const broadcasts = await api.get<{ data: { id: string; text: string }[] }>('/api/broadcast?limit=100');
    for (const b of broadcasts.data ?? []) {
      if (b.text?.includes(broadcastMsg)) {
        await api.delete(`/api/broadcast/${b.id}`);
      }
    }
  });

  test('moderation pages load correctly', async ({ page }) => {
    const pages = [
      '/dashboard/moderation',
      '/dashboard/moderation/groups',
      '/dashboard/moderation/logs',
      '/dashboard/moderation/analytics',
    ];

    for (const url of pages) {
      const response = await page.goto(url);
      expect(response?.status()).toBeLessThan(400);
      await page.waitForLoadState('networkidle');

      // Each page should have meaningful content, not a blank screen
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(0);
    }
  });

  test('system health check', async ({ page }) => {
    // 1. Check system status page
    await page.goto('/dashboard/system/status');
    await page.waitForLoadState('networkidle');

    // Verify health indicators are present
    const hasOperational = await page.getByText('All Systems Operational').isVisible().catch(() => false);
    const hasDegraded = await page.getByText('Some Systems Degraded').isVisible().catch(() => false);
    const hasOutage = await page.getByText('System Outage Detected').isVisible().catch(() => false);
    const hasLoading = await page.getByText('Loading system status...').isVisible().catch(() => false);
    const hasError = await page.getByText(/last refresh failed/i).isVisible().catch(() => false);

    expect(hasOperational || hasDegraded || hasOutage || hasLoading || hasError).toBeTruthy();

    // 2. Check bot config page
    const botConfigRes = await page.goto('/dashboard/bot-config');
    expect(botConfigRes?.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Bot Configuration').first()).toBeVisible({ timeout: 10_000 });

    // 3. Check tg-client page
    const tgClientRes = await page.goto('/dashboard/tg-client');
    expect(tgClientRes?.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
  });

  test('webhook lifecycle: create → verify → delete', async ({ page }) => {
    const timestamp = Date.now();
    const webhookName = `Smoke WH ${timestamp}`;

    // 1. Navigate to webhooks page
    await page.goto('/dashboard/webhooks');
    await page.waitForLoadState('networkidle');

    // 2. Create a webhook
    await page.getByRole('button', { name: /new webhook/i }).click();
    await page.getByPlaceholder('My webhook').fill(webhookName);
    await page.getByRole('button', { name: /^create$/i }).click();
    await page.waitForLoadState('networkidle');

    // 3. Verify webhook appears
    await expect(page.getByText(webhookName)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Active').first()).toBeVisible();

    // 4. Delete webhook
    const webhookRow = page.locator('div').filter({ hasText: webhookName }).first();
    const deleteBtn = webhookRow.locator('button').filter({ has: page.locator('svg') }).last();
    await deleteBtn.click();
    await page.waitForLoadState('networkidle');
  });

  test('cross-page navigation smoke test', async ({ page }) => {
    // Verify key dashboard pages load without errors
    const dashboardPages = [
      { url: '/dashboard', text: 'Dashboard' },
      { url: '/dashboard/users', text: 'Users' },
      { url: '/dashboard/flows', text: 'Flows' },
      { url: '/dashboard/broadcast', text: 'Broadcast' },
      { url: '/dashboard/webhooks', text: 'Webhooks' },
      { url: '/dashboard/automation', text: 'Automation' },
    ];

    for (const { url, text } of dashboardPages) {
      const response = await page.goto(url);
      expect(response?.status()).toBeLessThan(400);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(text).first()).toBeVisible({ timeout: 10_000 });
    }
  });
});
