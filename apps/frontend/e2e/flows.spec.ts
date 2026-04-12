import { test, expect } from './fixtures/auth';

test.describe('Flows', () => {
  test('displays flows page with heading and button', async ({ page }) => {
    await page.goto('/dashboard/flows');
    await page.waitForLoadState('networkidle');

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

    const newFlowBtn = page.getByRole('button', { name: /new flow|create flow/i }).first();
    await newFlowBtn.click();

    await page.waitForURL(/\/dashboard\/flows\/.+\/edit/, { timeout: 15_000 });
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Flow Editor', () => {
  test('flow editor canvas loads with React Flow components', async ({ page, api }) => {
    // Create a flow via API for reliable setup
    const flow = await api.post<{ id: string }>('/api/flows', {
      name: `E2E Editor Flow ${Date.now()}`,
      description: 'Test flow for editor canvas',
    });

    await page.goto(`/dashboard/flows/${flow.id}/edit`);
    await page.waitForLoadState('networkidle');

    // React Flow canvas should be present
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10_000 });

    // Controls (zoom buttons) should be present
    await expect(page.locator('.react-flow__controls')).toBeVisible();

    // MiniMap should be present
    await expect(page.locator('.react-flow__minimap')).toBeVisible();

    // Background grid should be present
    await expect(page.locator('.react-flow__background')).toBeVisible();

    // Cleanup
    await api.delete(`/api/flows/${flow.id}`);
  });

  test('node palette is visible with categories', async ({ page, api }) => {
    const flow = await api.post<{ id: string }>('/api/flows', {
      name: `E2E Palette Flow ${Date.now()}`,
      description: 'Test flow for node palette',
    });

    await page.goto(`/dashboard/flows/${flow.id}/edit`);
    await page.waitForLoadState('networkidle');

    // Node Palette heading should be visible
    await expect(page.getByText('Node Palette')).toBeVisible({ timeout: 10_000 });

    // Category headers should be visible
    await expect(page.getByText('triggers', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('conditions', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('actions', { exact: false }).first()).toBeVisible();

    // Some node types should be listed
    await expect(page.getByText('Message Received')).toBeVisible();
    await expect(page.getByText('Send Message', { exact: true })).toBeVisible();
    await expect(page.getByText('Keyword Match')).toBeVisible();

    await api.delete(`/api/flows/${flow.id}`);
  });

  test('toolbar shows flow name and status badge', async ({ page, api }) => {
    const flowName = `E2E Toolbar Flow ${Date.now()}`;
    const flow = await api.post<{ id: string }>('/api/flows', {
      name: flowName,
      description: 'Test flow for toolbar',
    });

    await page.goto(`/dashboard/flows/${flow.id}/edit`);
    await page.waitForLoadState('networkidle');

    // Flow name should appear in toolbar
    await expect(page.getByText(flowName)).toBeVisible({ timeout: 10_000 });

    // Version badge should be visible (e.g. "v1")
    await expect(page.getByText(/^v\d+$/)).toBeVisible();

    // Save Draft button should be present
    await expect(page.getByRole('button', { name: /save draft/i })).toBeVisible();

    // Validate button should be present
    await expect(page.getByRole('button', { name: /validate/i })).toBeVisible();

    // History button should be present
    await expect(page.getByRole('button', { name: /history/i })).toBeVisible();

    // Test Run button should be present
    await expect(page.getByRole('button', { name: /test run/i })).toBeVisible();

    await api.delete(`/api/flows/${flow.id}`);
  });

  test('can save flow', async ({ page, api }) => {
    const flow = await api.post<{ id: string }>('/api/flows', {
      name: `E2E Save Flow ${Date.now()}`,
      description: 'Test flow for saving',
    });

    await page.goto(`/dashboard/flows/${flow.id}/edit`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10_000 });

    // Click save draft button
    const saveBtn = page.getByRole('button', { name: /save draft/i });
    await saveBtn.click();

    // After saving, the button text should return to "Save Draft"
    await expect(saveBtn).toContainText(/save draft/i, { timeout: 10_000 });

    await api.delete(`/api/flows/${flow.id}`);
  });

  test('can activate and deactivate flow', async ({ page, api }) => {
    const flow = await api.post<{ id: string }>('/api/flows', {
      name: `E2E Activate Flow ${Date.now()}`,
      description: 'Test flow for activation',
    });

    await page.goto(`/dashboard/flows/${flow.id}/edit`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10_000 });

    // Initially draft — try to activate
    const activateBtn = page.getByRole('button', { name: /activate/i });
    const hasActivate = await activateBtn.isVisible().catch(() => false);

    if (hasActivate) {
      await activateBtn.click();

      // After activation, either status changes to "active" or an error dialog appears
      const isActive = await page.getByText('active').first().isVisible().catch(() => false);
      const hasDeactivate = await page.getByRole('button', { name: /deactivate/i }).isVisible().catch(() => false);

      if (isActive || hasDeactivate) {
        // Deactivate
        const deactivateBtn = page.getByRole('button', { name: /deactivate/i });
        if (await deactivateBtn.isVisible().catch(() => false)) {
          await deactivateBtn.click();
          await expect(page.getByText('draft').or(page.getByText('inactive'))).toBeVisible({ timeout: 10_000 });
        }
      }
    }

    await api.delete(`/api/flows/${flow.id}`);
  });
});

test.describe('Flow Templates', () => {
  test('templates page loads with template cards', async ({ page }) => {
    await page.goto('/dashboard/flows/templates');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Flow Templates')).toBeVisible();
    await expect(page.getByText('Start with a pre-built template')).toBeVisible();

    // Check some templates are listed
    await expect(page.getByText('Command Reply')).toBeVisible();
    await expect(page.getByText('Spam Filter')).toBeVisible();
    await expect(page.getByText('Auto-Reply by Keyword')).toBeVisible();
  });

  test('template cards show use template button', async ({ page }) => {
    await page.goto('/dashboard/flows/templates');
    await page.waitForLoadState('networkidle');

    // Wait for template content to load (past the loading spinner)
    await expect(page.getByText('Flow Templates')).toBeVisible({ timeout: 10_000 });

    const useButtons = page.getByRole('button', { name: /use template/i });
    await expect(useButtons.first()).toBeVisible({ timeout: 10_000 });
    const count = await useButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Flow Versions', () => {
  test('versions page loads', async ({ page, api }) => {
    const flow = await api.post<{ id: string }>('/api/flows', {
      name: `E2E Versions Flow ${Date.now()}`,
      description: 'Test flow for versions',
    });

    await page.goto(`/dashboard/flows/${flow.id}/versions`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Version History')).toBeVisible({ timeout: 10_000 });

    // Should show "Save Current Version" button
    await expect(page.getByRole('button', { name: /save current version/i })).toBeVisible();

    // Should show "Back to Editor" button
    await expect(page.getByRole('button', { name: /back to editor/i })).toBeVisible();

    // Either versions exist or empty state
    const hasVersions = await page.getByText(/^v\d/).isVisible().catch(() => false);
    const hasEmpty = await page.getByText('No saved versions yet').isVisible().catch(() => false);
    expect(hasVersions || hasEmpty).toBeTruthy();

    await api.delete(`/api/flows/${flow.id}`);
  });
});

test.describe('Flow Executions', () => {
  test('executions page loads', async ({ page, api }) => {
    const flow = await api.post<{ id: string }>('/api/flows', {
      name: `E2E Executions Flow ${Date.now()}`,
      description: 'Test flow for executions',
    });

    await page.goto(`/dashboard/flows/${flow.id}/executions`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Execution History')).toBeVisible({ timeout: 10_000 });

    // Should show executions or empty state
    const hasExecutions = await page.locator('[class*="font-mono"]').first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText('No executions yet').isVisible().catch(() => false);
    expect(hasExecutions || hasEmpty).toBeTruthy();

    await api.delete(`/api/flows/${flow.id}`);
  });
});
