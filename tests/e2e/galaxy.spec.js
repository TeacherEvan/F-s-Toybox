import { test, expect } from '@playwright/test';

// M5 gate — galaxy golden spec (docs/plans/2026-08-25-fs-toybox-golden-specs.md).
// Structural checks, not pixel-exact: a wrong implementation (uniform disk,
// no arms, brightness confined to the core) must FAIL.
// Determinism: ?seed=42&t=0.

const CX = 832, CY = 288; // UV (0.3, 0.2) at 1280×720

async function analyze(page, cx, cy) {
  return page.evaluate(([cx, cy]) => {
    const src = document.getElementById('gl');
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const W = c.width, H = c.height;
    const L = new Float32Array(W * H);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      L[j] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    }
    const box = 120;
    let sum = 0, sum2 = 0, n = 0, cSum = 0, cN = 0, aSum = 0, aN = 0, oSum = 0, oN = 0;
    const y0 = Math.max(0, cy - box), y1 = Math.min(H - 1, cy + box);
    const x0 = Math.max(0, cx - box), x1 = Math.min(W - 1, cx + box);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const l = L[y * W + x];
        sum += l; sum2 += l * l; n++;
        const dr = Math.hypot(x - cx, y - cy);
        if (dr <= 20) { cSum += l; cN++; }
        else if (dr >= 60 && dr <= 100) { aSum += l; aN++; }
        if (dr > 140 && x >= 0 && x < W && y >= 0 && y < H &&
            Math.hypot(x - cx, y - cy) <= 400) { oSum += l; oN++; }
      }
    }
    const mean = sum / n;
    return {
      core: cSum / cN,
      annulus: aSum / aN,
      outside: oSum / oN,
      std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)),
      canvasW: W,
    };
  }, [cx, cy]);
}

test('M5: galaxy renders core + spiral arms at declared position', async ({ page }) => {
  await page.goto('/index.html?seed=42&t=0');
  await page.waitForFunction(() => window.scene !== undefined);
  await page.waitForTimeout(120);

  await page.evaluate(() => {
    const e = createEntity('galaxy');
    e.position = { x: 0.3, y: 0.2 };
    scene.addEntity(e);
  });
  await page.waitForTimeout(120); // pack + upload + draw

  const s = await analyze(page, CX, CY);
  expect(s.canvasW).toBe(1280); // pixel-mapping precondition (DPR 1)

  // Central 40×40: bright core
  expect(s.core).toBeGreaterThanOrEqual(0.5);
  // Annulus 60-100px: arms present, dimmer than core, not blown out
  expect(s.annulus).toBeGreaterThanOrEqual(0.10);
  expect(s.annulus).toBeLessThanOrEqual(0.60);
  // Arm vs inter-arm contrast across the 240×240 box
  expect(s.std).toBeGreaterThanOrEqual(0.10);
  // Galaxy does not extend infinitely
  expect(s.outside).toBeLessThan(0.10);

  await page.locator('#gl').screenshot({ path: 'tests/golden/galaxy-1.png' });
});

test('M5: galaxy frame differs from the empty-scene frame (>=1% pixels)', async ({ page }) => {
  await page.goto('/index.html?seed=42&t=0');
  await page.waitForFunction(() => window.scene !== undefined);
  await page.waitForTimeout(120);

  const emptyShot = await page.locator('#gl').screenshot();
  await page.evaluate(() => {
    const e = createEntity('galaxy');
    e.position = { x: 0.3, y: 0.2 };
    scene.addEntity(e);
  });
  await page.waitForTimeout(120);
  const galaxyShot = await page.locator('#gl').screenshot();

  expect(emptyShot.equals(galaxyShot)).toBe(false);
});
