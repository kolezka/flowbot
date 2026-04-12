import { test, expect } from './fixtures/auth';

const WEBHOOK_URL = 'http://localhost:3000/api/flow/webhook';

function makeTriggerEvent(overrides: Record<string, unknown> = {}) {
  return {
    platform: 'telegram',
    eventType: 'message_received',
    data: {
      text: '/test e2e',
      command: '/test',
      commandArgs: 'e2e',
      messageId: Date.now(),
      senderName: 'E2E Tester',
      username: 'e2e_user',
      isDirectMessage: true,
      mediaType: null,
    },
    botInstanceId: 'e2e-bot-instance',
    accountId: '999888777',
    communityId: null,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

test.describe('Flow Webhook Ingestion', () => {
  let flowId: string;

  test.beforeAll(async ({ api }) => {
    // Create and activate a command reply flow
    const flow = await api.post<{ id: string }>('/api/flows/from-template/command-reply', {});
    flowId = flow.id;
    await api.post(`/api/flows/${flowId}/activate`, {});
  });

  test.afterAll(async ({ api }) => {
    if (flowId) {
      await api.post(`/api/flows/${flowId}/deactivate`, {});
      await api.delete(`/api/flows/${flowId}`);
    }
  });

  test('webhook accepts valid event and matches active flow', async ({ api }) => {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeTriggerEvent()),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.received).toBe(true);
    expect(body.matched).toBeGreaterThanOrEqual(1);
    expect(body.executions).toHaveLength(body.matched);
    expect(body.executions[0]).toHaveProperty('flowId');
    expect(body.executions[0]).toHaveProperty('executionId');
  });

  test('webhook rejects non-matching command', async () => {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeTriggerEvent({
        data: { text: '/unknown', command: '/unknown', commandArgs: null },
      })),
    });
    const body = await res.json();

    expect(body.received).toBe(true);
    expect(body.matched).toBe(0);
    expect(body.executions).toHaveLength(0);
  });

  test('webhook rejects wrong platform', async () => {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeTriggerEvent({ platform: 'discord' })),
    });
    const body = await res.json();

    expect(body.matched).toBe(0);
  });

  test('webhook rejects plain message without command', async () => {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeTriggerEvent({
        data: { text: 'hello world', command: null, mediaType: null },
      })),
    });
    const body = await res.json();

    expect(body.matched).toBe(0);
  });

  test('webhook is publicly accessible without auth token', async () => {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeTriggerEvent()),
    });

    // Should not return 401/403
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

test.describe('Flow Execution Lifecycle', () => {
  let flowId: string;

  test.beforeAll(async ({ api }) => {
    const flow = await api.post<{ id: string }>('/api/flows/from-template/command-reply', {});
    flowId = flow.id;
    await api.post(`/api/flows/${flowId}/activate`, {});
  });

  test.afterAll(async ({ api }) => {
    if (flowId) {
      await api.post(`/api/flows/${flowId}/deactivate`, {});
      await api.delete(`/api/flows/${flowId}`);
    }
  });

  test('execution is dispatched via webhook', async () => {
    // Trigger via webhook
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeTriggerEvent()),
    });
    const body = await res.json();

    // Webhook should match and return execution IDs
    expect(body.received).toBe(true);
    expect(body.executions.length).toBeGreaterThanOrEqual(1);

    // Our flow should be among the matched flows
    const ourExec = body.executions.find(
      (e: { flowId: string }) => e.flowId === flowId,
    );
    expect(ourExec).toBeTruthy();
    expect(ourExec.executionId).toBeTruthy();
    expect(typeof ourExec.executionId).toBe('string');
  });

  test('execution appears in flow analytics', async ({ page, api }) => {
    // Trigger an execution
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeTriggerEvent()),
    });

    // Check analytics page
    await page.goto('/dashboard/flows/analytics');
    await page.waitForLoadState('networkidle');

    const totalExec = page.getByText('Total Executions').locator('..');
    await expect(totalExec).toBeVisible();

    // The "Top Flows" table should show Command Reply
    await expect(page.getByText('Command Reply').first()).toBeVisible();
  });

  test('execution count updates on flows list page', async ({ page }) => {
    await page.goto('/dashboard/flows');
    await page.waitForLoadState('networkidle');

    // At least one flow card should show execution count
    const card = page.locator('[class*="card"], a[href*="/flows/"]').filter({
      hasText: /execution/i,
    });
    await expect(card.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Flow Validation', () => {
  test('template flow passes validation', async ({ page, api }) => {
    const flow = await api.post<{ id: string }>('/api/flows/from-template/command-reply', {});

    await page.goto(`/dashboard/flows/${flow.id}/edit`);
    await page.waitForLoadState('networkidle');

    // Dismiss draft restore dialog if present
    page.on('dialog', (dialog) => dialog.accept());

    // Wait for canvas
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10_000 });

    // Click validate
    await page.getByRole('button', { name: 'Validate' }).click();

    // Should see success dialog (handled by the dialog listener above)
    // If validation fails, the dialog would say "Validation errors"
    // We verify via API as well
    const result = await api.post<{ valid: boolean; errors: string[] }>(
      `/api/flows/${flow.id}/validate`,
      {},
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);

    await api.delete(`/api/flows/${flow.id}`);
  });

  test('empty flow fails validation', async ({ api }) => {
    const flow = await api.post<{ id: string }>('/api/flows', {
      name: `E2E Empty Flow ${Date.now()}`,
    });

    const result = await api.post<{ valid: boolean; errors: string[] }>(
      `/api/flows/${flow.id}/validate`,
      {},
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    await api.delete(`/api/flows/${flow.id}`);
  });
});

test.describe('Flow Activation & Deactivation', () => {
  test('activating a flow adds it to the trigger registry', async ({ api }) => {
    const flow = await api.post<{ id: string }>('/api/flows/from-template/command-reply', {});

    // Get trigger registry before activation
    const registryBefore = await api.get<{ triggers: unknown[]; version: number }>(
      '/api/flows/trigger-registry',
    );
    const countBefore = registryBefore.triggers.length;

    // Activate
    await api.post(`/api/flows/${flow.id}/activate`, {});

    // Registry should have one more trigger
    const registryAfter = await api.get<{ triggers: unknown[]; version: number }>(
      '/api/flows/trigger-registry',
    );
    expect(registryAfter.triggers.length).toBe(countBefore + 1);
    expect(registryAfter.version).toBeGreaterThan(registryBefore.version);

    // Deactivate and verify trigger is removed
    await api.post(`/api/flows/${flow.id}/deactivate`, {});

    const registryDeactivated = await api.get<{ triggers: unknown[]; version: number }>(
      '/api/flows/trigger-registry',
    );
    expect(registryDeactivated.triggers.length).toBe(countBefore);

    await api.delete(`/api/flows/${flow.id}`);
  });

  test('active flow shows active badge in UI', async ({ page, api }) => {
    const flow = await api.post<{ id: string }>('/api/flows/from-template/command-reply', {});
    await api.post(`/api/flows/${flow.id}/activate`, {});

    await page.goto('/dashboard/flows');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('active').first()).toBeVisible();

    await api.post(`/api/flows/${flow.id}/deactivate`, {});
    await api.delete(`/api/flows/${flow.id}`);
  });
});
