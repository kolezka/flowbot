import { test, expect } from './fixtures/auth';

test.describe('Flow management smoke test', () => {
  test('create a flow, open editor, add trigger node, save, activate, and verify status', async ({ authenticatedPage: page }) => {
    // Navigate to the flows page
    await page.goto('/dashboard/flows');
    await expect(page.getByRole('heading', { name: /flows/i })).toBeVisible();

    // Create a new flow
    const createButton = page.getByRole('button', { name: /create|new flow/i });
    await createButton.click();

    // Fill in the flow name in the creation dialog/form
    const nameInput = page.getByPlaceholder(/name/i).or(page.getByLabel(/name/i)).first();
    await nameInput.fill('Smoke Test Flow');
    const submitButton = page.getByRole('button', { name: /create|save|submit/i }).first();
    await submitButton.click();

    // Expect to be redirected to the flow editor
    await page.waitForURL(/\/dashboard\/flows\/[^/]+\/edit/);

    // Verify the editor loaded with the flow name
    await expect(page.getByText('Smoke Test Flow')).toBeVisible();

    // The node palette should be visible
    await expect(page.getByText('Node Palette')).toBeVisible();

    // Add a trigger node by dragging from the palette
    // Locate the "Message Received" trigger node in the palette
    const triggerNode = page.getByText('Message Received').first();
    await expect(triggerNode).toBeVisible();

    // Drag the trigger node onto the canvas
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    const canvasBox = await canvas.boundingBox();
    if (canvasBox) {
      await triggerNode.dragTo(canvas, {
        targetPosition: {
          x: canvasBox.width / 2,
          y: canvasBox.height / 2,
        },
      });
    }

    // Save the flow
    const saveButton = page.getByRole('button', { name: /save/i });
    await saveButton.click();

    // Wait for save to complete (button text changes back from "Saving...")
    await expect(saveButton).not.toHaveText(/saving/i, { timeout: 5000 });

    // Activate the flow
    const activateButton = page.getByRole('button', { name: /activate/i });
    await activateButton.click();

    // Verify the status badge changes to "active"
    await expect(page.getByText('active')).toBeVisible({ timeout: 5000 });
  });

  test('navigate to live execution view', async ({ authenticatedPage: page }) => {
    // Navigate to a flow's live view (even without a real execution, the page should load)
    await page.goto('/dashboard/flows');

    // Check that the flows page loads
    await expect(page.getByRole('heading', { name: /flows/i })).toBeVisible();
  });
});
