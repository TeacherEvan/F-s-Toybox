import { test, expect } from '@playwright/test';

// The boot stub takes a full-page screenshot, which waits for a committed GPU
// frame. Under SwiftShader (CI, no GPU) one frame takes ~15 s, and with two
// parallel workers the 30 s default budget is not enough (verified flake:
// 2026-10-22, 28.6 s → 30 s timeout).
test.setTimeout(90_000);

test('M1.4 boot stub: status becomes "ready" with no errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err);
  });

  await page.goto('/index.html?seed=42&t=0', { waitUntil: 'domcontentloaded' });

  const status = page.locator('#status');
  await expect(status).toHaveText('ready', { timeout: 20000 });
  await expect(status).not.toHaveClass(/err/);

  expect(pageErrors, `uncaught page errors: ${pageErrors.map((e) => e.message).join(' | ')}`).toEqual([]);

  await page.screenshot({ path: 'tests/golden/boot-stub-1.png', fullPage: false });
});
