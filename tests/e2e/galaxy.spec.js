import { test, expect } from '@playwright/test';

// M5 gate — galaxy golden spec.
// Structural baseline-delta checks: the frame WITH a galaxy is compared
// against the empty-scene frame at the same probe site, so background
// brightness cannot mask a missing/broken galaxy.
//
// Pixel mapping (matches the actual pipeline, uv0 = (frag-0.5res)/res.y):
//   px = W/2 + uv.x * H      (720 px per UV unit at 1280×720)
//   py = H/2 - uv.y * H      (+y is UP; GL origin bottom-left)
//   UV (0.3, 0.2) → (856, 216)
//   (The original golden-specs doc used py=(1-uv.y)*H/2*2 and 640 px/unit —
//   corrected here; see docs/plans/2026-08-25-fs-toybox-golden-specs.md.)
//
// Determinism: ?seed=42&t=0. Sampling uses window.__readLuma (gl.readPixels),
// not drawImage (stale-frame unreliable under SwiftShader).
test.setTimeout(90_000);

const CX = 856, CY = 216;

async function analyze(page) {
  // Point-sampling via tiny readPixels: full-canvas reads return partially
  // stale rows under SwiftShader, 1×1 reads are always fresh.
  return page.evaluate(async ([cx, cy]) => {
    const px = (x, y) => window.__readLuma(x, y, 1, 1)[0];
    const sampleRing = (radius, count) => {
      let sum = 0;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        sum += px(Math.round(cx + Math.cos(a) * radius),
                  Math.round(cy + Math.sin(a) * radius));
      }
      return sum / count;
    };
    // Core: 5×5 grid over the central 40×40
    let cSum = 0;
    for (let gy = -2; gy <= 2; gy++)
      for (let gx = -2; gx <= 2; gx++)
        cSum += px(cx + gx * 8, cy + gy * 8);
    const core = cSum / 25;
    const annulus = sampleRing(80, 48);           // 60-100px band midpoint
    // Outside: 3 radii × 16 angles, all beyond the ~169px coverage fade
    let oSum = 0, oN = 0;
    for (const radius of [200, 280, 360]) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + radius;
        oSum += px(Math.round(cx + Math.cos(a) * radius),
                   Math.round(cy + Math.sin(a) * radius));
        oN++;
      }
    }
    // Arm texture: luma variance along the 80px annulus
    const ringVals = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      ringVals.push(px(Math.round(cx + Math.cos(a) * 80),
                       Math.round(cy + Math.sin(a) * 80)));
    }
    const rMean = ringVals.reduce((s, v) => s + v, 0) / ringVals.length;
    const rStd = Math.sqrt(ringVals.reduce((s, v) => s + (v - rMean) ** 2, 0) / ringVals.length);
    return { core, annulus, outside: oSum / oN, ringStd: rStd };
  }, [CX, CY]);
}

const sync = (page) => page.evaluate(() =>
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// Condition-based wait: the engine must actually redraw (frozen scenes skip
// identical frames), then one more frame to settle the drawing buffer.
async function waitDraw(page, prevDraws) {
  await page.waitForFunction((p) => window.__dbg.draws > p, prevDraws);
  await sync(page);
}
const draws = (page) => page.evaluate(() => window.__dbg.draws);

test('M5: galaxy adds bright core + arm structure at declared position', async ({ page }) => {
  await page.goto('/index.html?seed=42&t=0');
  await page.waitForFunction(() => window.__readLuma !== undefined && window.scene !== undefined);
  await page.waitForTimeout(200);
  await sync(page);

  const E = await analyze(page);
  const d0 = await draws(page);
  await page.evaluate(() => {
    const e = createEntity('galaxy');
    e.position = { x: 0.3, y: 0.2 };
    scene.addEntity(e);
  });
  await waitDraw(page, d0);
  const G = await analyze(page);

  // Bright core added on top of whatever the background provides
  expect(G.core).toBeGreaterThanOrEqual(0.6);
  expect(G.core - E.core).toBeGreaterThanOrEqual(0.05);
  // Arms brighten the 60-100px ring (structure appears where bg was dimmer)
  expect(G.annulus - E.annulus).toBeGreaterThanOrEqual(0.02);
  // Arm/fbm texture present on the annulus — a flat saturated disk fails
  expect(G.ringStd).toBeGreaterThanOrEqual(0.03);
  // The galaxy stays local — far field unchanged
  expect(Math.abs(G.outside - E.outside)).toBeLessThanOrEqual(0.05);

  await page.locator('#gl').screenshot({ path: 'tests/golden/galaxy-1.png' });
});

test('M5: galaxy frame differs from the empty-scene frame (>=1% pixels)', async ({ page }) => {
  await page.goto('/index.html?seed=42&t=0');
  await page.waitForFunction(() => window.__readLuma !== undefined && window.scene !== undefined);
  await page.waitForTimeout(200);
  await sync(page);
  const diffRatio = await page.evaluate(async () => {
    const before = window.__readLuma(0, 0, 1280, 720);
    const e = window.createEntity('galaxy');
    e.position = { x: 0.3, y: 0.2 };
    window.scene.addEntity(e);
    // Force reupload / draw
    if (window.__reupload) window.__reupload();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const after = window.__readLuma(0, 0, 1280, 720);
    let diff = 0;
    for (let i = 0; i < before.length; i++) {
      if (Math.abs(before[i] - after[i]) > 0.02) diff++;
    }
    return diff / before.length;
  });

  expect(diffRatio).toBeGreaterThanOrEqual(0.01);
});
