import { test, expect } from '@playwright/test';

// M4 gate specs — WebGL2 engine + 64×4 data texture.
// Determinism: ?seed=42&t=0 freezes the clock and seeds the hashes.

async function canvasStats(page) {
  return page.evaluate(() => {
    const src = document.getElementById('gl');
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0, nb = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      sum += l;
      if (l > 0.02) nb++;
    }
    return { mean: sum / n, nonBlack: nb / n };
  });
}

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
  await page.waitForFunction(() => window.scene !== undefined);
  await page.waitForTimeout(120); // a few frames
  const stats = await canvasStats(page);
  expect(stats.nonBlack).toBeGreaterThan(0.5);
});

test('M4.3: one galaxy brightens the frame vs empty; golden captured', async ({ page }) => {
  await page.goto('/index.html?seed=42&t=0');
  await page.waitForFunction(() => window.scene !== undefined);
  await page.waitForTimeout(120);
  const empty = await canvasStats(page);

  await page.evaluate(() => { scene.addEntity(createEntity('galaxy')); });
  await page.waitForTimeout(120); // let the packer upload + render
  const withEntity = await canvasStats(page);

  // Not all-black, and measurably different from the empty frame.
  expect(withEntity.nonBlack).toBeGreaterThan(0.01);
  expect(withEntity.mean).toBeGreaterThan(empty.mean + 0.3);

  await page.locator('#gl').screenshot({ path: 'tests/golden/engine-1entity.png' });
});
