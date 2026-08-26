import { test, expect } from '@playwright/test';

// M3.2 gate spec — God Panel UI (no shaders).
// Source: docs/plans/2026-08-25-fs-toybox.md Task 3.2 Step 2.

test('add galaxy, select, edit position', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('button', { name: '+ Galaxy' }).click();
  await expect(page.locator('.entity-list-item')).toHaveCount(1);
  await page.locator('.entity-list-item').first().click();
  await expect(page.locator('.property-editor h2')).toContainText('Galaxy');
  const xSlider = page.locator('input[data-prop="position.x"]');
  await xSlider.fill('0.42');
  await expect(page.locator('.entity-list-item').first()).toContainText('0.42');
});

// Risk #9 mitigation: panel width asserted by test, not computed style trust.
test('property editor panel is exactly 320px wide at 1280x720', async ({ page }) => {
  await page.goto('/index.html');
  const box = await page.locator('#property-editor').boundingBox();
  expect(box.width).toBe(320);
});

// Acceptance criterion #6: toolbar has 8 Add buttons + Hide All + Pause +
// Save + Load. Nothing else.
test('toolbar has 8 add buttons, Hide All, Pause, Save, Load', async ({ page }) => {
  await page.goto('/index.html');
  // Button order follows ENTITY_KINDS order (src/scene.js keeps it stable).
  for (const k of ['Galaxy', 'Planet', 'Moon', 'Ring', 'Shooting', 'BHole', 'Nebula', 'Comet']) {
    await expect(page.getByRole('button', { name: `+ ${k}` })).toHaveCount(1);
  }
  for (const name of ['Hide All', 'Pause', 'Save', 'Load']) {
    await expect(page.locator('#toolbar').getByRole('button', { name })).toHaveCount(1);
  }
});
