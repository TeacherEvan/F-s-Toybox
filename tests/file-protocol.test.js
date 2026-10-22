// Guard: the app must work when index.html is opened directly from disk
// (file://) — that is the documented wallpaper deployment (chromium --kiosk
// file://.../index.html, xwinwrap). ES module imports of local files are
// CORS-blocked on the opaque file:// origin, so a single `import ... from
// './src/*.js'` silently kills the whole module script: no event handlers,
// no WebGL engine, and the "+ Add" buttons appear to do nothing.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const read = (p) => fs.readFileSync(path.resolve(p), 'utf8');

describe('file:// protocol compatibility', () => {
  it('src/scene.js is classic-script safe (no import/export keywords)', () => {
    const src = read('src/scene.js');
    expect(src).not.toMatch(/^\s*export\s/m);
    expect(src).not.toMatch(/^\s*import\s/m);
  });

  it('src/pack.js is classic-script safe (no import/export keywords)', () => {
    const src = read('src/pack.js');
    expect(src).not.toMatch(/^\s*export\s/m);
    expect(src).not.toMatch(/^\s*import\s/m);
  });

  it('index.html loads src/*.js with classic <script src> tags', () => {
    const html = read('index.html');
    expect(html).toContain('<script src="./src/scene.js"></script>');
    expect(html).toContain('<script src="./src/pack.js"></script>');
  });

  it('index.html does not statically import local modules', () => {
    const html = read('index.html');
    // A dynamic import() of a local file is equally CORS-blocked on file://.
    expect(html).not.toMatch(/from\s+['"]\.\/src\//);
    expect(html).not.toMatch(/import\s*\(\s*['"]\.\/src\//);
  });

  it('the ESM facade in src/index.js re-exports the public API', () => {
    const facade = read('src/index.js');
    for (const name of ['Scene', 'createEntity', 'ENTITY_KINDS', 'KIND_GPU',
                        'serialize', 'deserialize', 'validateScene', 'resolveOrbits',
                        'packEntitiesToDataTexture', 'uploadEntityTexture',
                        'resolveWorldPosition', 'MAX_ENTITIES', 'TEX_WIDTH']) {
      expect(facade).toContain(name);
    }
  });
});
