# F's-Toybox

A WebGL2 browser-rendered animated desktop wallpaper with a master God Panel that controls per-element motion, save/load to `scene.json`, and nine entity kinds (galaxy, planet, moon, shooting star, black hole, ring, nebula, comet, star field) — all on a per-element scene graph. Designed for Linux desktops via `xwinwrap`, KDE Plasma 6, or Hyprland/Sway.

## Status

**Implemented (M1–M7 in progress):**

- **M1–M2:** Repo skeleton, Vitest harness, scene graph (`Scene`, `createEntity`, `ENTITY_KINDS`), `scene.json` load/validate/deserialize
- **M3–M3.2:** God Panel UI — entity list, property editor, save/load/autosave (`localStorage`), 8 `+ Add` buttons + Hide All / Pause / Save / Load
- **M4:** WebGL2 engine — fragment shader, 1024-texel RGBA8 entity data texture, `?seed=42&t=0` determinism, luma/GL debug hooks
- **M5:** Galaxy render kind (core + spiral arms)
- **M6:** Planet render kind (banded disk + limb glow + axial tilt)
- **M7 (in-flight):** Moon & Ring data-texture slot mapping (`moon-ring-slots.test.js` RED → green), orbit parent resolve

Golden-frame E2E specs pass (`tests/golden/*.png`).

## 🔌 Critical rule — keep the `src/*.js` files as CLASSIC scripts

`src/scene.js` and `src/pack.js` are loaded with plain `<script src="…">`, **not** `<script type="module">`. ES module imports of local files are CORS-blocked on the opaque `file://` origin, which kills the whole module script: no event handlers, no WebGL engine, and the `+ Add` buttons spawn nothing.

- **Browser:** loads the two classic scripts; `index.html` destructures `globalThis.FsToyboxScene` / `globalThis.FsToyboxPack` inside a module script.
- **Vitest (Node):** imports the ESM facade `src/index.js`, which side-effect-loads the classic scripts and re-exports the API.

**Do not convert `src/scene.js` or `src/pack.js` to ES modules without flipping `index.html` back to dynamic `import()` — and then verify the app boots from `file://` again.**

## Layout

```
.
├── index.html                  ← single-file app: WebGL2 engine + God Panel UI + engine loop
├── scene.json                  ← default boot scene
├── src/
│   ├── index.js                ← ESM facade for Vitest (scene.js + pack.js side-effects)
│   ├── scene.js                ← scene model (classic script; registers globalThis.FsToyboxScene)
│   └── pack.js                 ← data-texture packer (classic script; registers globalThis.FsToyboxPack)
├── tests/
│   ├── *.test.js               ← Vitest units (scene, pack, moon/ring slots, render guard, …)
│   ├── e2e/*.spec.js           ← Playwright E2E + golden-frame specs
│   └── golden/*.png            ← visual diff fixtures
├── docs/
│   ├── concept/                ← historical reference (Cosmic Penguin v3 WebGL2 shader)
│   └── plans/                  ← design docs & implementation plan (see plans/README.md)
├── package.json
└── README.md
```

## Running

```bash
# unit tests
npm test

# e2e + golden visual diffs (spawns a headless Chromium on localhost:8123)
npm run e2e

# manual: serve index.html (required over http:// for the <script src> classic loads;
# file:// also works, but Chrome/Chromium blocks ES-module local-file imports)
python3 -m http.server 8123   # then open http://localhost:8123/index.html
```

## Linux desktop wallpaper (valid again — `src/` is classic-script safe)

```bash
# X11 + xwinwrap (Chromium kiosk)
xwinwrap -ov -fs -- chromium --kiosk file://$(pwd)/index.html

# Hyprland / Sway / Wayland
chromium --app="file://$(pwd)/index.html" --window-type=desktop

# Firefox kiosk alternative
firefox --kiosk file://$(pwd)/index.html
```

## Tech stack

- **Render:** WebGL2 fragment shader, single `index.html`, no build step
- **Tests:** Vitest (JS units) + Playwright (E2E + visual diff)
- **Save format:** `scene.json` (download + autosave in `localStorage`)

## Known gaps

- Kinds 3–8 (moon, ring, shooting star, black hole, nebula, comet) render as minimal placeholders in the fragment shader until M7+ per-kind shaders ship.
- Orbit parenting: `parentSlot` is hard-coded to `-1` in the shader; M7 reserves it.
- `Hide All` / `Pause` / `Save` / `Load` are stubbed inert (M10+).
- `scene.json` is loaded at boot but `save`/autosave only writes `localStorage` (`mad.scene`) — there is no explicit `scene.json` writer yet.
- Frame budget: `uEntityCount` bounds the shader entity loop; adaptive render scale shrinks the canvas backing store when the GPU can't keep 60 fps.

## License

To be decided. The reference WebGL2 pipeline is taken from `docs/concept/index.html`; the original brief did not specify a license. Suggest MIT for the new code, with attribution to the reference where the shader code is carried forward.
