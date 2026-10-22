// Regression: the toolbar wraps onto extra rows on narrow windows. The side
// panels used to sit at a hard-coded `top: 44px`, so they covered the wrapped
// rows and swallowed the clicks — the "+ Add" buttons appeared dead.
import { test, expect } from '@playwright/test';

test.setTimeout(120_000);

const NARROW = { width: 480, height: 320 };

test('side panels never overlap the toolbar, at any width', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/index.html?seed=42&t=0');
  await expect(page.locator('#status')).toHaveText('ready');

  for (const size of [NARROW, { width: 1024, height: 768 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(200);
    const overlap = await page.evaluate(() => {
      const tb = document.getElementById('toolbar').getBoundingClientRect();
      const panels = ['entity-list', 'property-editor']
        .map((id) => document.getElementById(id).getBoundingClientRect());
      return panels.filter((p) => p.top < tb.bottom - 0.5).map((p) => p.top);
    });
    expect(overlap, `panels overlap the toolbar at ${size.width}x${size.height}`).toEqual([]);
  }
});

test('"+ Galaxy" is clickable when the toolbar wraps (narrow window)', async ({ page }) => {
  await page.setViewportSize(NARROW);
  await page.goto('/index.html?seed=42&t=0');
  await expect(page.locator('#status')).toHaveText('ready');

  await page.getByRole('button', { name: '+ Galaxy' }).click();
  await expect(page.locator('.entity-list-item')).toHaveCount(1);
  await expect(page.locator('#entity-count')).toHaveText('1');
});
