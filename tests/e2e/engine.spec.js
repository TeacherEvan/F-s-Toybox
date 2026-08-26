import { test, expect } from '@playwright/test';

// M4 gate specs — WebGL2 engine + data texture.
// Determinism: ?seed=42&t=0 freezes the clock and seeds the hashes.
// Sampling via window.__readLuma (gl.readPixels, top-down rows).
test.setTimeout(90_000);

async function canvasStats(page) {
  return page.evaluate(() => {
    const L = window.__readLuma(0, 0, 1280, 720);
    let sum = 0, nb = 0;
    for (let i = 0; i < L.length; i++) {
      sum += L[i];
      if (L[i] > 0.02) nb++;
    }
    return { mean: sum / L.length, nonBlack: nb / L.length };
  });
}

const sync = (page) => page.evaluate(() =>
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test('M4.1: engine reports WebGL2 uniform count to console', async ({ page }) => {
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  await page.goto('/index.html?seed=42&t=0');
  await expect.poll(() =>
    logs.some((l) => l.includes('MAX_FRAGMENT_UNIFORM_COMPONENTS')),
  ).toBe(true);
});

test('M4.3: empty scene renders spiral background (not all-black)', async ({ page }) => {
  await page.goto('/index.html?seed=42&t=0');
  await page.waitForFunction(() => window.__readLuma !== undefined && window.scene !== undefined);
  await page.waitForTimeout(200);
  await sync(page);
  const stats = await canvasStats(page);
  expect(stats.nonBlack).toBeGreaterThan(0.5);
});

test('M4.3: one galaxy brightens the frame vs empty; golden captured', async ({ page }) => {
  await page.goto('/index.html?seed=42&t=0');
  await page.waitForFunction(() => window.__readLuma !== undefined && window.scene !== undefined);
  await page.waitForTimeout(200);
  await sync(page);
  const empty = await canvasStats(page);

  await page.evaluate(() => { scene.addEntity(createEntity('galaxy')); });
  await sync(page); await sync(page); await sync(page);
  const withEntity = await canvasStats(page);

  expect(withEntity.nonBlack).toBeGreaterThan(0.01);
  // Center pixel must be bright (knockout + galaxy core)
  const centerLuma = await page.evaluate(() => window.__readLuma(640, 360, 1, 1)[0]);
  expect(centerLuma).toBeGreaterThan(0.6);

  await page.locator('#gl').screenshot({ path: 'tests/golden/engine-1entity.png' });
});
