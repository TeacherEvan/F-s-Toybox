import { test, expect } from '@playwright/test';

// M6 gate - planet golden spec
// (docs/plans/2026-08-25-fs-toybox-golden-specs.md "planet golden spec").
//
// Pixel mapping (matches the actual pipeline, uv0 = (frag-0.5res)/res.y):
//   px = W/2 + uv.x * H      (720 px per UV unit at 1280x720)
//   py = H/2 - uv.y * H      (+y is UP; GL origin bottom-left)
//   UV (-0.4, 0.3) -> (352, 144)  (720 px/unit; golden-spec doc's 640 px/unit is stale)
test.setTimeout(90_000);

const CX = 352, CY = 144; // UV (-0.4, 0.3): px = 640 + uv.x*720, py = 360 - uv.y*720 (720 px/unit, matches galaxy.spec.js)

async function analyze(page) {
  return page.evaluate(async ([cx, cy]) => {
    const px = (x, y) => window.__readLuma(x, y, 1, 1)[0];
    // Central 60x60 box (the planet body).
    const body = [];
    for (let gy = -30; gy <= 30; gy++)
      for (let gx = -30; gx <= 30; gx++)
        body.push(px(cx + gx, cy + gy));
    const bMean = body.reduce((s, v) => s + v, 0) / body.length;
    const bStd = Math.sqrt(body.reduce((s, v) => s + (v - bMean) ** 2, 0) / body.length);
    // Outside: 4 radii x 16 angles, all beyond the 55px bleed radius.
    let oSum = 0, oN = 0;
    for (const radius of [80, 120, 160, 200]) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + radius;
        oSum += px(Math.round(cx + Math.cos(a) * radius),
                   Math.round(cy + Math.sin(a) * radius));
        oN++;
      }
    }
    return { bMean, bStd, outside: oSum / oN };
  }, [CX, CY]);
}

const sync = (page) => page.evaluate(() =>
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const draws = (page) => page.evaluate(() => window.__dbg.draws);
async function waitDraw(page, prevDraws) {
  await page.waitForFunction((p) => window.__dbg.draws > p, prevDraws);
  await sync(page);
}

test('M6: planet adds a banded bright disk at declared position', async ({ page }) => {
  await page.goto('/index.html?seed=42&t=0');
  await page.waitForFunction(() => window.__readLuma !== undefined && window.scene !== undefined);
  await page.waitForTimeout(200);
  await sync(page);

  const E = await analyze(page);
  const d0 = await draws(page);
  await page.evaluate(() => {
    const e = createEntity('planet');
    e.position = { x: -0.4, y: 0.3 };
    scene.addEntity(e);
  });
  await waitDraw(page, d0);
  const P = await analyze(page);

  // Bright body added on top of whatever the background provides
  expect(P.bMean).toBeGreaterThanOrEqual(0.3);
  expect(P.bMean - E.bMean).toBeGreaterThanOrEqual(0.05);
  // Banding creates visible variation across the disk (a flat disk fails)
  expect(P.bStd).toBeGreaterThanOrEqual(0.06);
  // The planet stays local - far field unchanged
  expect(Math.abs(P.outside - E.outside)).toBeLessThanOrEqual(0.10);

  await page.locator('#gl').screenshot({ path: 'tests/golden/planet-1.png' });
});
