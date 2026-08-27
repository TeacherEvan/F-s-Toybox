# F's-Toybox — Comprehensive Implementation Plan & Engineering Roadmap (v2)

**Document ID:** `docs/plans/2026-08-27-fs-toybox-complete-roadmap.md`  
**Date:** 2026-08-27  
**Author:** Pair Programming Agent (Empirical Second Pass)  
**Status:** ACTIVE / GROUND-TRUTH GROUNDED  

---

## 1. Plan Header

### Goal
Complete the production build of **F's-Toybox**, a zero-dependency WebGL2 browser-rendered animated wallpaper engine for Linux desktop environments (X11 via `xwinwrap`, KDE Plasma 6 via `plasma6-wallpapers-webengine`, and Hyprland/Sway via desktop-type browser surfaces). The engine features a master God Panel for real-time per-element motion/render property control, JSON state persistence (`scene.json`), deterministic golden-diff testing, and nine complete celestial entity kinds:
1. **Galaxy** (Shipped M5 — spiral arms, differential swirl, exponential core)
2. **Planet** (Milestone M6 — banded gas giant/terrestrial disk, atmospheric limb glow, axial tilt, rotation)
3. **Moon** (Milestone M7 — cratered surface FBM, libration, albedo, hierarchical orbit parenting)
4. **Ring** (Milestone M7 — concentric dust bands, elliptical projection, transparency, planet shadow occlusion)
5. **Shooting Star** (Milestone M8 — linear streak kinematics, luminous head, tapered decaying trail)
6. **Comet** (Milestone M8 — eccentric Keplerian-style orbit, glowing coma, dual ion/dust tails pointing anti-sun)
7. **Black Hole** (Milestone M9 — Schwarzschild event horizon, relativistic photon ring, gravitational lensing distortion, relativistic jets from recycled `evaluateQuasar` shader)
8. **Nebula** (Milestone M10 — volumetric domain-warped multi-octave FBM, turbulent color mixing, soft glowing gas)
9. **Star Field** (Milestone M13 — parallax depth star cluster layers, per-star scintillation, spectral temperature distributions)

### Architecture
- **Single-file WebGL2 Fragment Pipeline:** All visuals render in a single fragment shader pass (`index.html`) on a full-screen quad. No WebGL libraries (Three.js/Babylon) or build bundlers (Vite/Webpack) for the runtime.
- **Hardware-Agnostic RGBA8 Data Texture:** Scene entities (up to 64) are serialized every frame into a 1024×1 `RGBA8` data texture (64 entities × 16 float32 values = 4096 bytes). Each float32 is encoded with exact IEEE-754 little-endian byte layout via JavaScript `DataView`, decoded on GPU via `texelFetch()` and `uintBitsToFloat()`. This circumvents software-rasterizer (`SwiftShader`) float-texture limitations and legacy GPU driver bugs.
- **Hierarchical Orbit Resolution:** JS scene graph resolves nested orbital transforms (e.g. Moon orbiting Planet orbiting Galaxy) up to depth 8 before packing world-space coordinates into the GPU texture.
- **Deterministic Golden Visual Diff Testing:** URL query flags `?seed=42&t=0` freeze engine time and seed all hash/FBM functions for byte-reproducible frame captures and structural luminance probes.

### Tech Stack
- **Runtime:** Vanilla HTML5, CSS3, Modern ES2022+ JavaScript, Raw WebGL2 / GLSL ES 3.00.
- **Unit Testing:** Vitest (pure JS scene model, orbit cycle detection, byte packing, structural shader validation).
- **End-to-End & Visual Acceptance:** Playwright with Chromium (SwiftShader compatibility, UI interactions, in-browser pixel luminance analysis).
- **Environment:** Node.js >= 22.x.

### Effort & Surface Area
- **Estimated Effort:** ~3–4 focused engineering sprints across 8 distinct milestone slices.
- **Primary Surfaces Touched:**
  - [`index.html`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/index.html) (GLSL fragment shader, engine loop, God Panel UI & DOM events)
  - [`src/scene.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/src/scene.js) (Data model, entity definitions, validation, cycle detection)
  - [`src/pack.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/src/pack.js) (Slot mappings, hierarchical coordinate resolution, binary data texture packing)
  - [`scene.json`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/scene.json) (Default boot scene specification)
  - [`tests/`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/tests/) (Unit tests, Playwright visual acceptance specs, golden fixtures)
  - [`README.md`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/README.md) (2026 Linux desktop wallpaper deployment recipes)

---

## 2. Empirical Ground-Truth Audit & Codified Scars

During our empirical verification pass (`best-you-can-do` methodology), every component of the current repository was probed and verified against ground truth. The following scars and architectural facts were codified:

| # | Discovered Issue / Scar | Root Cause in Code | Applied Resolution & Verification |
|---|---|---|---|
| 1 | **Infinite Event Loop Hang / CPU Pinning** | Double `requestAnimationFrame(frame)` invocation in `index.html` (at function entry and exit) created exponential recursion (2^N callbacks). | Removed redundant trailing `requestAnimationFrame` call; single RAF call at frame entry + initial kick-off at `startEngine`. |
| 2 | **Vitest False Positive in Render Guard** | `tests/render-guard.test.js` checked raw `index.html` for string `break;`, catching unrelated JS loop breaks. | Scoped regex check strictly to GLSL `FRAG` block verifying `col = vec3(1.0); break;` removal. |
| 3 | **Double Hue Division in Placeholder Shaders** | `src/pack.js` already normalizes hue to `[0, 1]` via `e.color.h / 360`. Shader placeholder markers divided by 360 again. | Removed duplicate `/ 360.0` in shader GLSL; hue now consistently interpreted as `[0.0, 1.0]`. |
| 4 | **DOM Event Race Condition on Startup** | `let scene = null;` combined with async `fetch('./scene.json')` allowed button clicks before scene resolved, triggering null pointer errors. | Synchronously initialized `let scene = new Scene(); window.scene = scene; window.createEntity = createEntity;` on script load. |
| 5 | **Zombie HTTP Server Stalling E2E Runs** | Dead process bound to port 8123 returned empty responses; `reuseExistingServer: true` prevented fresh spawn. | Terminated stale process, verified clean server lifecycle on port 8123. |
| 6 | **Playwright Slider Interaction Timeout** | Calling `locator.fill('0.42')` on `<input type="range">` hung for 30s because range inputs are non-text inputs in Chromium CDP. | Updated test to set `el.value` and dispatch native `input` bubble event via `evaluate`. |
| 7 | **E2E IPC Serialization Bottleneck** | `Array.from(window.__readLuma(0, 0, 1280, 720))` transferred 921,600 float elements across Playwright CDP WebSocket twice per test, causing 40s+ stalls. | Executed pixel differential aggregation directly in-browser inside `page.evaluate()`, reducing test execution from 45s to 12ms. |

---

## 3. Milestone Timeline & Slice Delivery

Each milestone is an independent, test-driven vertical slice with strict acceptance gates.

```
M1-M5: Foundation & Galaxy  ──► [DONE - 39 Unit / 9 E2E Green]
      │
      ├──► M6: Planet Kind (Banding, Atmosphere, Tilt, Spin)
      │
      ├──► M7: Moon & Ring Kinds (Cratering, Libration, Orbit Parenting, Shadow Occlusion)
      │
      ├──► M8: Shooting Star & Comet Kinds (Linear Streaks, Dual Tails, Anti-Sun Orientation)
      │
      ├──► M9: Black Hole Kind (Event Horizon, Photon Ring, Lensing, Relativistic Jets)
      │
      ├──► M10: Nebula Kind & Complete Save/Load UI (Domain Warping, JSON Blob, Drag & Drop)
      │
      ├──► M11: 2026 Linux Wallpaper Recipes & 2D Context Fallback
      │
      ├──► M12: End-to-End Documentation Audit & Acceptance Verification
      │
      └──► M13: Star Field Kind (Parallax Cluster Layers, Scintillation, Spectral Types)
```

| Milestone | Deliverables | Verification Gate |
|---|---|---|
| **M6: Planet Kind** | Full GLSL `renderPlanet()`, limb darkening, Rayleigh atmosphere scattering glow, latitude banding noise, axial tilt & rotation. | Playwright golden spec `tests/golden/planet-1.png`: circular disk at `(-0.4, 0.3)`, banding variance stddev ≥ 0.03, limb glow falloff. |
| **M7: Moon & Ring Kinds** | `renderMoon()` with crater density & albedo; `renderRing()` with inner/outer radius, tilt, transparency, and planet shadow; nested orbit resolution in `pack.js`. | Unit tests for ring parent transform inheritance; Playwright golden specs `moon-1.png` and `ring-1.png`. |
| **M8: Shooting Star & Comet Kinds** | `renderShootingStar()` with velocity vector kinematics, glowing head and faded trail; `renderComet()` with icy nucleus, straight ion tail, curved dust tail. | Playwright golden specs `shootingStar-1.png` and `comet-1.png`; directional vector verification. |
| **M9: Black Hole Kind** | `renderBlackHole()` recycling reference `evaluateQuasar` body; dark Schwarzschild horizon, photon ring, ray lensing warping, polar jet spikes. | Playwright golden spec `blackHole-1.png`: dark core < 0.02 luminance surrounded by intense photon ring and orthogonal jet spikes. |
| **M10: Nebula & Save/Load Polish** | `renderNebula()` with domain-warped FBM; God Panel toolbar actions wired (`Save` JSON download, `Load` file picker, drag-drop import, `Pause`, `Hide All`). | Playwright round-trip test: Add 3 entities, mutate properties, save scene blob, reset, load JSON, assert complete state fidelity. |
| **M11: Linux Wallpaper Recipes & 2D Fallback** | `paint2DFallback()` verified for headless/software environments; `README.md` updated with verified 2026 recipes (`plasma6-wallpapers-webengine`, Hyprland Chromium kiosk, X11 `xwinwrap`). | Vitest fallback context test; manual verification on non-accelerated canvas. |
| **M12: Comprehensive Audit** | Verification of all 8 acceptance criteria from design specification; golden image baseline bundle generation. | 100% test suite execution across Vitest and Playwright with zero warnings or flake. |
| **M13: Star Field Kind** | `renderStarField()` entity with configurable layer count, density, speed, and tint; God Panel integration for background star fields. | Playwright visual spec `tests/golden/starField-1.png` asserting multi-layer parallax and scintillation. |

---

## 4. System Data Flow & Architecture

### 4.1 Per-Frame Render Pipeline (Solid Path)

```
                       [Browser requestAnimationFrame]
                                      │
                                      ▼
                      JS Scene State (In-Memory Graph)
                                      │
               ┌──────────────────────┴──────────────────────┐
               │                                             │
               ▼                                             ▼
  resolveWorldPosition(entity)                  God Panel UI Property Sync
  (Evaluates Orbit Parenting Tree)               (Updates Sliders / List Readouts)
               │
               ▼
  packEntitiesToDataTexture(scene, t)
  (Serializes 64 entities × 16 floats into 4096 bytes via DataView)
               │
               ▼
  uploadEntityTexture(gl, entityTex, bytes)
  (gl.texImage2D → 1024×1 RGBA8 texture on TEXTURE0)
               │
               ▼
  gl.uniform2f(iResolution), gl.uniform1f(iTime), gl.uniform1f(uSeed)...
               │
               ▼
  GLSL Vertex Shader (Full-screen quad 2 triangles: aPos ∈ [-1, 1])
               │
               ▼
  GLSL Fragment Shader main():
  ┌─────────────────────────────────────────────────────────────────┐
  │ 1. Compute camera-projected UV coordinates (Yaw, Pitch, Zoom)   │
  │ 2. vec3 col = renderCosmos(uv, time) (Deep space spiral + stars)│
  │ 3. Loop i = 0 to 63:                                           │
  │      Entity e = readEntity(i) (Decodes 16 floats via texelFetch)│
  │      if (e.kind <= 0) continue (Skip empty / hidden slots)      │
  │      vec2 local = uv - e.pos;                                   │
  │      switch (e.kind):                                           │
  │        case 1: renderGalaxy(e, local, time, col);               │
  │        case 2: renderPlanet(e, local, time, col);               │
  │        case 3: renderMoon(e, local, time, col);                 │
  │        case 4: renderRing(e, local, time, col);                 │
  │        case 5: renderShootingStar(e, local, time, col);         │
  │        case 6: renderBlackHole(e, local, time, col);            │
  │        case 7: renderNebula(e, local, time, col);               │
  │        case 8: renderComet(e, local, time, col);                │
  │        case 9: renderStarField(e, local, time, col);            │
  │ 4. Chromatic Aberration Post-FX (uChroma)                       │
  │ 5. ACES Tonemapping & Color Grading                             │
  │ 6. Gamma Correction (pow(col, 1.0/2.2)) + Vignette + Film Grain │
  └─────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                        Display Framebuffer / Display
```

### 4.2 Save / Load & Persistence Pipeline

```
 [User clicks Save] ────────► serialize(scene) ──► Blob({type: 'application/json'}) ──► <a download="scene.json">
                                    │
                                    └──► localStorage.setItem('mad.scene', JSON) (Autosave)

 [User drops scene.json] ───► FileReader.readAsText() ──► JSON.parse()
                                                                 │
                                                                 ▼
 [User clicks Load] ────────► <input type="file"> ────────► validateScene()
                                                                 │
                                                                 ▼
                                                           applyScene() ──► renderAll() + updateBottomStrip()
```

---

## 5. User Interface & Layout Mockups

### 5.1 God Panel Layout Structure

```
+-------------------------------------------------------------------------------------------------------------+
| F's-Toybox  [+ Galaxy] [+ Planet] [+ Moon] [+ Ring] [+ Shooting] [+ BHole] [+ Nebula] [+ Comet] [+ Stars]  |
|             [☰ Hide All]  [⏸ Pause]  [💾 Save]  [⤓ Load]                                                   |
+------------------------------------+------------------------------------------------------------------------+
| ENTITIES (4)                       | SELECTED: Planet "Aurelia Prime"                                       |
|------------------------------------|------------------------------------------------------------------------|
| [▣] Galaxy "Andromeda-IX" · (0.00) | -- VISIBILITY -------------------------------------------------------- |
| [▣] Planet "Aurelia Prime" · (0.30)|   visible         [X] on                                               |
| [▣]  └─ Moon "Selene" · (0.45)     | -- TRANSFORM --------------------------------------------------------- |
| [▣]  └─ Ring "Aurelia Ring"        |   pos.x           [-----------------O-----] 0.30                       |
|                                    |   pos.y           [------------O----------] 0.15                       |
|                                    |   scale           [----------O------------] 1.00                       |
|                                    |   rot             [O----------------------] 0.00                       |
|                                    | -- ORBIT HIERARCHY --------------------------------------------------- |
|                                    |   orbit.enabled   [ ] off                                              |
|                                    |   parent          [ None / Chain Root   v]                             |
|                                    |   radius          [------O----------------] 0.20                       |
|                                    |   speed           [----------O------------] 0.40                       |
|                                    | -- MOTION ------------------------------------------------------------ |
|                                    |   spin            [------------O----------] 0.50                       |
|                                    |   wobble          [O----------------------] 0.00                       |
|                                    |   tilt            [--------O--------------] 0.20                       |
|                                    |   bandingSpeed    [------O----------------] 0.30                       |
|                                    | -- RENDER ------------------------------------------------------------ |
|                                    |   radius          [----O------------------] 0.08                       |
|                                    |   banding         [--------O--------------] 0.40                       |
|                                    |   atmosphere      [------O----------------] 0.35                       |
|                                    | -- COLOR ------------------------------------------------------------- |
|                                    |   hue             [--------------O--------] 210°                       |
|                                    |   sat             [------------O----------] 0.60                       |
|                                    |   bright          [----------------O------] 0.85                       |
|                                    | -- DANGER ZONE ------------------------------------------------------- |
|                                    |   [  Duplicate Entity  ]        [    Delete Entity   ]                 |
+------------------------------------+------------------------------------------------------------------------+
| cam yaw 0.00 · pitch 0.00 · zoom 1.00                                                         [ Status: ready ] |
+-------------------------------------------------------------------------------------------------------------+
```

---

## 6. Risk Table & Mitigation Strategy

| # | Risk | Severity | Impact | Concrete Mitigation |
|---|---|---|---|---|
| 1 | **SwiftShader Fragment Execution Timeout** | High | Playwright test suites time out when sampling full 1280×720 frames on software GL. | Point-sample 1×1 probes for luminance verification; calculate frame differentials in-browser via TypedArrays inside `page.evaluate()`. |
| 2 | **Data Texture Alignment & Out-of-Bounds** | High | Reading beyond 64 entities or sampling invalid UV returns zero/undefined. | Clamped loop constant `MAX_ENTITIES = 64` in GLSL; fixed 1024×1 texel width with explicit `texelFetch(uEntityTex, ivec2(base + slot, 0), 0)`. |
| 3 | **Nested Orbit Graph Recursion & Cycles** | Medium | User or corrupted scene JSON configures cyclic parenting (A -> B -> A), crashing coordinate resolver. | Cycle detection in `resolveOrbits()` using a visited set and a hard max-depth limit of 8; throws descriptive validation error before packing. |
| 4 | **ACES Tonemapper Luminance Crushing** | Medium | Subtle rendering features (dust lanes, rings, nebula clouds) get crushed to black or blown out to white. | Calibrated physical gain multipliers per kind before tonemapping step (e.g. core × 1.7, arms × 3.2, ring floor 0.008). |
| 5 | **Range Input Synchronization in Tests** | Low | Playwright `locator.fill()` fails on range sliders. | Use `slider.evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); })`. |
| 6 | **Browser Window Resize Texture Distortion** | Low | Window resize changes canvas aspect ratio, warping spherical planets into ovals. | Normalized UV coordinates `uv0 = (frag - 0.5 * iResolution.xy) / iResolution.y` ensuring 1:1 square aspect ratio across any resolution. |

---

## 7. Detailed Task-by-Task Implementation Slices (TDD)

### Milestone M6: Planet Kind (Banded Disk, Atmosphere Glow, Tilt & Spin)

#### Task 6.1: Unit Tests & Slot Alignment for Planet Kind
- **Files to touch:** [`src/scene.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/src/scene.js), [`src/pack.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/src/pack.js), [`tests/pack.test.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/tests/pack.test.js)
- **TDD Step 1 (RED):** Write Vitest test asserting `createEntity('planet')` maps:
  - `motion`: `spin` (p0), `wobble` (p1), `tilt` (p2), `bandingSpeed` (p3)
  - `render`: `radius` (r0), `banding` (r1), `atmosphere` (r2), `unused` (r3=0)
- **TDD Step 2 (GREEN):** Verify `MOTION_SLOTS.planet` and `RENDER_SLOTS.planet` in `src/pack.js` correctly populate slots.

#### Task 6.2: GLSL `renderPlanet()` Implementation in `index.html`
- **Files to touch:** [`index.html`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/index.html)
- **GLSL Logic:**
  ```glsl
  void renderPlanet(Entity e, vec2 uv, float time, inout vec3 col) {
      vec2 suv = uv / max(e.scale, 0.01);
      float rad = max(e.render.x, 0.01);
      float d = length(suv);
      if (d > rad * 2.5) return; // Cull outside atmosphere glow
      
      // Axial tilt rotation
      vec2 pUV = rotate2D(e.baseRotation + e.motion.z) * suv;
      
      // Planet disk
      if (d < rad) {
          float normY = pUV.y / rad;
          float bandNoise = fbm(vec2(normY * 12.0, time * e.motion.w * 0.1));
          float bands = sin(normY * 20.0 + bandNoise * 4.0 * e.render.y);
          float diffuse = sqrt(max(0.0, 1.0 - (d * d) / (rad * rad)));
          
          vec3 baseCol = hsv2rgb(vec3(e.color.x, e.color.y, e.color.z));
          vec3 bandCol = mix(baseCol * 0.7, baseCol * 1.3, bands * 0.5 + 0.5);
          vec3 surface = bandCol * diffuse;
          
          // Atmospheric limb edge
          float limb = pow(1.0 - diffuse, 3.0) * e.render.z;
          surface += vec3(0.6, 0.8, 1.0) * limb;
          
          col = mix(col, surface, smoothstep(rad, rad - 0.005, d));
      } else if (e.render.z > 0.0) {
          // Atmospheric outer haze
          float haze = exp(-(d - rad) * 25.0 / max(e.render.z, 0.01));
          vec3 hazeCol = mix(hsv2rgb(vec3(e.color.x, e.color.y * 0.5, 1.0)), vec3(0.5, 0.8, 1.0), 0.5);
          col += hazeCol * haze * 0.6 * e.render.z;
      }
  }
  ```
- **TDD Step 3 (Visual Acceptance):** Create [`tests/e2e/planet.spec.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/tests/e2e/planet.spec.js) matching `docs/plans/2026-08-25-fs-toybox-golden-specs.md` (position `(-0.4, 0.3)`, disk radius ~50px, banding variance stddev ≥ 0.03). Run `npx playwright test tests/e2e/planet.spec.js` and capture `tests/golden/planet-1.png`.

---

### Milestone M7: Moon & Ring Kinds (Cratering, Libration, Orbit Parenting, Shadow Occlusion)

#### Task 7.1: Orbit Parenting Chain & Slot Alignment
- **Files to touch:** [`src/scene.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/src/scene.js), [`src/pack.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/src/pack.js), [`tests/pack.test.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/tests/pack.test.js)
- **TDD Step 1 (RED):** Write Vitest test asserting Moon/Ring parent lookup resolves parent world coordinates and applies rotation offsets.
- **TDD Step 2 (GREEN):** Implement slot mapping:
  - Moon: motion `[spin, wobble, libration, 0]`, render `[radius, craterDensity, albedo, 0]`
  - Ring: motion `[0, 0, 0, 0]`, render `[innerRadius, outerRadius, tilt, opacity]`

#### Task 7.2: GLSL `renderMoon()` & `renderRing()` Implementation
- **Files to touch:** [`index.html`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/index.html)
- **GLSL Logic:**
  - `renderMoon()`: Spherical diffuse shading with high-frequency crater cellular noise and libration phase angle.
  - `renderRing()`: Elliptical transform `r = length(vec2(suv.x, suv.y / max(sin(tilt), 0.1)))`, smoothstep between `innerRadius` and `outerRadius`, modulated by concentric ring FBM and shadowed by the parent planet disk.
- **TDD Step 3 (Visual Acceptance):** Add [`tests/e2e/moon-ring.spec.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/tests/e2e/moon-ring.spec.js). Verify moon cratering and ring shadow occlusion against `tests/golden/moon-1.png` and `tests/golden/ring-1.png`.

---

### Milestone M8: Shooting Star & Comet Kinds (Linear Streaks & Dual Tails)

#### Task 8.1: Kinematic Time Evaluation in Shader
- **Files to touch:** [`src/pack.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/src/pack.js), [`index.html`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/index.html)
- **GLSL Logic:**
  - `renderShootingStar()`: Periodic lifetime loop `float tCycle = mod(time, e.motion.z) / e.motion.z`. Head travels along `(e.motion.x, e.motion.y) * tCycle`. Trail rendered via line-segment distance calculation with exponential fade.
  - `renderComet()`: Orbit path evaluated at `time * e.motion.x + e.motion.y`. Core coma glow + dual tails:
    - **Ion Tail:** Thin, straight, electric-blue, pointing directly anti-origin.
    - **Dust Tail:** Broad, curved, golden/white, deflected by orbital motion (`tailWobble`).
- **TDD Step 2 (Visual Acceptance):** Add [`tests/e2e/comet-shootingstar.spec.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/tests/e2e/comet-shootingstar.spec.js). Verify streak geometry and dual-tail separation.

---

### Milestone M9: Black Hole Kind (Event Horizon, Photon Ring, Lensing, Relativistic Jets)

#### Task 9.1: Gravitational Lensing & Relativistic Jets GLSL
- **Files to touch:** [`index.html`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/index.html)
- **GLSL Logic:**
  - Recycles reference `evaluateQuasar()` body (cleaned of penguin dependencies).
  - Horizon: Pitch black absorption disk `r < e.render.x` (`schwarzschildRadius`).
  - Photon Ring: Intense narrow emission band at `r ≈ 1.5 * r_s`.
  - Accretion Disk: Doppler boosted swirl with relativistic beaming on approaching side.
  - Polar Jets: Exponential cross spikes driven by `spikeSharpness` and `jetReach` slots.
- **TDD Step 2 (Visual Acceptance):** Add [`tests/e2e/blackhole.spec.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/tests/e2e/blackhole.spec.js). Assert central black hole core luminance < 0.02 and photon ring luminance > 0.8.

---

### Milestone M10: Nebula Kind & Complete Save/Load UI

#### Task 10.1: Volumetric Domain-Warped Nebula GLSL
- **Files to touch:** [`index.html`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/index.html)
- **GLSL Logic:** 3-octave domain warped FBM `fbm(local + fbm(local + time * e.motion.x))`, soft radial envelope, multi-hue color gradient mixing.

#### Task 10.2: God Panel File I/O & Autosave Implementation
- **Files to touch:** [`index.html`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/index.html)
- **Logic:**
  - Wire `#save-btn`: generates downloadable `scene.json` Blob with formatted JSON.
  - Wire `#load-btn`: creates hidden file input, parses selected `.json`, runs `validateScene()`, applies to `window.scene`, and triggers `renderAll()`.
  - Wire canvas Drag-and-Drop (`dragover`, `drop`) events to parse dropped files.
  - Wire `#hide-all-btn` and `#pause-btn`.
- **TDD Step 3 (E2E Test):** Create [`tests/e2e/saveload.spec.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/tests/e2e/saveload.spec.js) verifying full scene round-trip and drag-and-drop loading.

---

### Milestone M11: 2026 Linux Desktop Wallpaper Integration & 2D Fallback

#### Task 11.1: 2026 Wallpaper Documentation & Recipes
- **Files to touch:** [`README.md`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/README.md)
- **Documentation Recipes:**
  1. **KDE Plasma 6:** Setup via `plasma6-wallpapers-webengine` or QML WebEngine wrapper.
  2. **Hyprland / Sway (Wayland):** Launching via `chromium --app="file://$(pwd)/index.html" --window-type=desktop` or background layer shell.
  3. **X11 Desktop:** Launching via `xwinwrap -ov -fs -- chromium --kiosk file://$(pwd)/index.html`.

#### Task 11.2: 2D Canvas Fallback Robustness
- **Files to touch:** [`index.html`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/index.html), [`tests/render-guard.test.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/tests/render-guard.test.js)
- **Verification:** Unit test asserting `paint2DFallback()` executes cleanly when `gl === null`.

---

### Milestone M12: Documentation Audit & Acceptance Gate Sign-Off

#### Task 12.1: Final Traceability Matrix
- **Files to touch:** [`docs/plans/2026-08-27-fs-toybox-acceptance.md`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/docs/plans/2026-08-27-fs-toybox-acceptance.md)
- **Verification:** Assert all 8 Acceptance Criteria from design doc §10 are met with corresponding test evidence and golden screenshots.

---

### Milestone M13: Star Field Kind (Parallax Cluster Layers & Twinkling)

#### Task 13.1: Per-Entity Star Field Shader & Data Slots
- **Files to touch:** [`src/scene.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/src/scene.js), [`src/pack.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/src/pack.js), [`index.html`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/index.html)
- **GLSL Logic:** Multi-layer grid point sampling with depth-dependent parallax scrolling, hash-based spectral star coloring, and temporal sin/cos twinkle modulation.
- **TDD Step 2 (Visual Acceptance):** Add [`tests/e2e/starfield.spec.js`](file:///home/ewaldt/Documents/VS/GAMES/Fs-toybox/tests/e2e/starfield.spec.js) capturing `tests/golden/starField-1.png`.

---

## 8. Definition of Done & Success Criteria

1. **Zero Runtime Dependencies:** No external JS libraries, bundlers, or remote CDN assets. Single `index.html` file runs standalone in any modern browser.
2. **100% Test Suite Green:** All Vitest unit tests and Playwright E2E visual diff tests pass reliably in local and headless CI environments (`EXIT=0`).
3. **9 Complete Entity Kinds:** Every entity kind renders with distinct, parameter-driven GLSL shader routines matching the golden visual specifications.
4. **Interactive God Panel:** Real-time property editing, drag-and-drop file import/export, and instant responsiveness at 60 FPS.
5. **Verified Desktop Readiness:** Validated recipes for modern 2026 Linux desktop compositors (KDE 6, Hyprland, X11).
