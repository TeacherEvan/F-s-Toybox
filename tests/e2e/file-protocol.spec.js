// Regression: the "+ Add" toolbar buttons must spawn an entity even when
// index.html is opened from disk (file://) — the documented wallpaper
// deployment path. Before the fix, the ES module import of ./src/*.js was
// CORS-blocked on the file:// origin, so the module script never ran: the
// canvas stayed black and the "+" buttons did nothing.
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test.setTimeout(180_000);

// A small viewport keeps the SwiftShader software-GL frame cost down: every
// scene change forces a redraw, and at 1280x720 one frame takes ~15 s.
test.use({ viewport: { width: 480, height: 320 } });

const fileUrl = pathToFileURL(path.resolve('index.html')).href;

test('app boots from file:// and "+ Galaxy" spawns an entity', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // ?seed=42&t=0 freezes the clock so the render loop stops redrawing (SwiftShader
  // software GL is ~15 s/frame, which would starve the DOM event loop).
  await page.goto(`${fileUrl}?seed=42&t=0`);

  await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

  // The WebGL engine started (proves the module script actually executed).
  await expect.poll(() => page.evaluate(() => window.__dbg?.draws ?? -1),
                     { timeout: 60_000 }).toBeGreaterThan(0);

  await page.getByRole('button', { name: '+ Galaxy' }).click();
  await expect(page.locator('.entity-list-item')).toHaveCount(1);
  await expect(page.locator('#entity-count')).toHaveText('1');
  expect(await page.evaluate(() => window.scene.entities.length)).toBe(1);

  expect(pageErrors, `uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
});

test('every add button spawns an entity from file://', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.goto(`${fileUrl}?seed=42&t=0`);
  await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

  const kinds = ['Galaxy', 'Planet', 'Moon', 'Ring', 'Shooting', 'BHole', 'Nebula', 'Comet'];
  for (const k of kinds) {
    await page.getByRole('button', { name: `+ ${k}` }).click();
  }
  await expect(page.locator('.entity-list-item')).toHaveCount(kinds.length);
  expect(await page.evaluate(() => window.scene.entities.map((e) => e.kind).sort()))
    .toEqual(['blackHole', 'comet', 'galaxy', 'moon', 'nebula', 'planet', 'ring', 'shootingStar']);
  expect(pageErrors, `uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
});
