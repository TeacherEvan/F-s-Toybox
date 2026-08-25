import { test, expect } from '@playwright/test';

test('M1.4 boot stub: status becomes "ready" with no errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err);
  });

  await page.goto('/index.html?seed=42&t=0', { waitUntil: 'domcontentloaded' });

  const status = page.locator('#status');
  await expect(status).toHaveText('ready');
  await expect(status).not.toHaveClass(/err/);

  const errApplied = await page.evaluate(() =>
    document.getElementById('status').classList.contains('err'),
  );
  expect(errApplied).toBe(false);

  expect(pageErrors, `uncaught page errors: ${pageErrors.map((e) => e.message).join(' | ')}`).toEqual([]);

  await page.screenshot({ path: 'tests/golden/boot-stub-1.png', fullPage: false });
});
