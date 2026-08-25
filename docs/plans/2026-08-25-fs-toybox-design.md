# F's-Toybox — Design Doc

> **Status:** design approved, awaiting Phase 2 (writing-plans) to slice into tasks.
> **Author:** opencode (Hermes)
> **Date:** 2026-08-25
> **Source concept:** `docs/concept/concept.txt` + `docs/concept/index.html` (Cosmic Penguin v3 reference — kept as historical, not edited)

## 1. Identity

| Field | Value |
|---|---|
| Working title | **F's-Toybox** |
| Project root | `/home/ewaldt/Documents/VS/GAMES/Desktop_Director/` (existing, no new dir) |
| Type | Browser-rendered animated desktop wallpaper (no build step) |
| Render target | WebGL2 fragment shader (carry forward from `docs/concept/index.html`) |
| Linux wallpaper engines supported (documented, not auto-configured) | `plasma6-wallpapers-webengine` (KDE Plasma 5.27 LTS / 6.x, primary KDE path), Chromium `--ozone-platform=wayland --window-type=desktop` (Hyprland / Sway / river, primary Wayland tiling path), `xwinwrap` (X11-only fallback for GNOME X11 / i3 / Xfce / openbox). GNOME Wayland has no first-class HTML wallpaper support and is documented as a known gap. See §12. |
| Save format | `scene.json` (download + autosave to localStorage) |
| Default scene | **Empty.** Black cosmos with the spiral background, zero entities. User adds via God Panel. |

## 2. File layout

```
Desktop_Director/
├── docs/
│   ├── concept/                                  ← historical, untouched
│   │   ├── concept.txt
│   │   └── index.html                            ← Cosmic Penguin v3 reference
│   └── plans/
│       ├── 2026-08-25-fs-toybox-design.md   ← this file
│       └── 2026-08-25-fs-toybox.md          ← Phase 2 task plan
├── index.html                                    ← THE app
├── scene.json                                    ← empty default scene
├── README.md                                     ← how to set as Linux wallpaper
└── .gitignore                                    ← editor noise only
```

Rationale: zero build step. The file Linux wallpaper engines point at is `index.html`. `scene.json` is the canonical saved state — portable, human-readable, hand-editable.

## 3. Scene model

### 3.1 Entity base shape

Every entity — galaxy, planet, moon, shooting star, black hole, ring, nebula, comet — is a JS object with the same base:

```ts
// KIND_GPU is the GLSL-side enum. Kind 0 is reserved for "unused slot."
// JS uses the string form ('galaxy', etc.) for human-readable JSON; the
// packing function in `src/pack.js` translates to KIND_GPU on every upload.
export const KIND_GPU = {
  UNUSED:        0,
  GALAXY:        1,
  PLANET:        2,
  MOON:          3,
  RING:          4,
  SHOOTING_STAR: 5,
  BLACK_HOLE:    6,
  NEBULA:        7,
  COMET:         8,
  FIELD:         9,
} as const;

type EntityKind = 'galaxy' | 'planet' | 'moon' | 'ring'
                 | 'shootingStar' | 'blackHole' | 'nebula' | 'comet';

type EntityBase = {
  id: string;            // uuid v4 (used by the God Panel + Save; NEVER sent to GPU)
  kind: EntityKind;
  name: string;          // user-editable, e.g. "Andromeda"
  visible: boolean;      // toggle in God Panel
  position: { x: number; y: number };   // world units (UV space, centered)
  orbit: {               // optional parent-relative orbit
    enabled: boolean;
    parentId: string | null;  // uuid v4 (JS-side identity; see below)
    radius: number;           // world units
    speed: number;            // radians/sec, sign = direction
    phase: number;            // starting angle radians
  };
  scale: number;         // multiplier on the entity's native size
  rotation: number;      // radians, intrinsic spin
  color: { h: number; s: number; b: number };
    // HSV stored in JSON as:
    //   h: degrees 0..360 (the God Panel slider displays "210°")
    //   s: 0..1
    //   b: 0..1
    // The GLSL `hsv2rgb()` consumes h as 0..1; `src/pack.js` divides by 360
    // on upload. Keep the conversion in ONE place (the packer), not the shader.
  motion: MotionParams;  // per-kind, see §3.3
  render: RenderParams;  // per-kind, see §3.4
};

type Scene = {
  schemaVersion: 1;
  camera: { x: number; y: number; zoom: number };
  globalMotion: { paused: boolean; timeScale: number };
  background: { enabled: boolean; spiralSpeed: number; starDensity: number };
  entities: EntityBase[];
};
```

#### GPU-side parentId encoding

`orbit.parentId` is a JS-side uuid used by the God Panel and orbit-graph DFS.
It is **never sent to the GPU**. The packer writes the parent's **slot index
in the data texture** (0..63) into the parent's `vec4[0].w` field. The GLSL
side reads `int e.parentSlot` (range 0..63) and looks up the parent's world
position via a second `texture()` call on the same data texture. This means:

- Deleting a parent does NOT leave dangling references in the data texture —
  `packEntitiesToDataTexture` rebuilds every frame and resolves fresh slot indices.
- Cycles and depth overflow are caught in JS (`resolveOrbits` in M2) and
  never reach the GPU.
- The ring (kind 4) gets its position by `texture(uEntityTex, vec2(parentSlot, 0.5))`.

### 3.2 Motion vs. render split

`motion` is everything that **changes over time** (per-kind — see catalog §6).
`render` is everything that **changes what the entity looks like** (color, size, sharpness, glow — also per-kind).
This split is what makes the God Panel "master" — every prop in both groups is individually editable.

### 3.3 World & time

- World is a UV-square: `x ∈ [-1, 1]`, `y ∈ [-1, 1]`.
- **Y-axis sign convention:** UV-space `+y` maps to screen `+y` (UP). Orbit math uses `y = sin(theta) * radius`; a positive `speed` is **counter-clockwise on screen**. This is the only sign convention used; both the God Panel and the orbit tests assert it.
- Time advances from `t = 0` when the scene is loaded. `paused` halts; `timeScale` scales the rate.
- **Determinism hook:** if the URL contains `?t=0`, the engine freezes time at `t=0` for the entire session. Combined with `?seed=42`, this makes golden-image visual diffs reliable. `?t=NaN` (or no param) is the normal live-clock mode. URL params are parsed once at boot; changing them requires a reload.
- Orbits compose: a moon orbits its planet which orbits its star. Recursion depth checked at save-time (max 8).

### 3.4 Scale / rotation math

- **Effective size** for any entity with a `render.radius` (planet, moon, nebula, black hole) is `render.radius * scale`. Rings ignore `scale` — their size is `outerRadius` only (the parent provides the world scale).
- **Effective intrinsic angle** is `base.rotation + t * motion.spin`. `base.rotation` is the God Panel slider value (static offset); `motion.spin` is the per-kind angular velocity.
- The data-texture packing (see §5.1) stores `base.rotation` in `vec4[0].w` when the entity is the "first parent in the chain" — i.e. the entity at the top of the orbit tree. For child entities, `vec4[0].w` is occupied by `parentSlot` and `base.rotation` is uploaded in `vec4[3].w`. The GLSL `Entity` struct has both fields; the renderer reads whichever the packer filled in.

### 3.5 Per-kind field-to-slot mapping (the JS packer)

The 4-slot `vec4[2]` and `vec4[3]` layout holds 4 floats each, but the per-kind
`motion` and `render` field names are NOT slot names. The packer in `src/pack.js`
maps kind-specific named fields to the 4 slots in a fixed order, so the GLSL
shader sees a uniform `motion: vec4` and `render: vec4` regardless of kind.

| Kind | `motion.p0..p3` | `render.r0..r3` |
|---|---|---|
| galaxy | spin, pulse, wobble, _ (0) | coreBright, dust, armSharp, coreSize |
| planet | spin, wobble, tilt, bandingSpeed | radius, banding, atmosphere, _ |
| moon | spin, wobble, libration, _ | radius, craterDensity, albedo, _ |
| ring | _ (0), _ (0), _ (0), _ (0) | innerRadius, outerRadius, tilt, opacity |
| shootingStar | vx, vy, lifetime, _ | length, thickness, brightness, trailFade |
| blackHole | spin, accretionSpeed, lensingPulse, _ | schwarzschildRadius, accretionRadius, jetReach, spikeSharpness |
| nebula | drift, turbulence, _ (0), _ (0) | radius, density, softness, _ |
| comet | orbitSpeed, orbitPhase, tailWobble, _ | nucleusRadius, tailLength, tailWidth, tailFade |

**Note on `intensity`:** the reference's global `uIntensity` (used by
`evaluateQuasar`) is **not** a per-entity field in the new design. Black-hole
brightness is driven by the per-entity `motion.p0..p3` slots above plus the
HSV `color.b` channel. The golden-image spec at
`docs/plans/2026-08-25-fs-toybox-golden-specs.md` references
`e.p2` (which maps to `lensingPulse` per this table) as a stand-in for
"intensity" — the implementer may use any of the four motion slots to
control overall quasar brightness; the test cares about the SHAPE of the
output (dark horizon + bright spikes) not which slot drives it.

## 4. God Panel UX

### 4.1 Mockup (ASCII)

```
┌─ F's-Toybox ────────────────────────────────────────┐
│ [ +Galaxy ] [ +Planet ] [ +Moon ] [ +Shooting ] [ +BHole ] │
│ [ +Ring ] [ +Nebula ] [ +Comet ]  │ ☰ Hide All │ ⏸ Pause │
│                                       │ 💾 Save │ ⤓ Load   │
├──────────────────────┬─────────────────────────────────────┤
│ ENTITIES             │ SELECTED: Planet "Aurelia"          │
│  ▣ Galaxy "Whirl"    │                                      │
│  ▣ Planet "Aurelia"  │  Visibility      [●────]  on        │
│  ▢ Moon "Lume"  ←    │  Position X      [────●]  0.42      │
│  ▣ Shooting "X-7"    │  Position Y      [──●──] -0.15      │
│  ▣ BHole "Patient"   │  Scale           [──●──]  1.20      │
│  ▣ Ring (of Aurelia) │  Rotation        [●────]  0.00      │
│  ▢ Comet              │ ── Motion ──────────────────────── │
│                      │  Orbit Parent   [planet "Aurelia"  ]│
│                      │  Orbit Radius   [────●]  0.18        │
│                      │  Orbit Speed    [──●──]  0.50 rad/s  │
│                      │  Spin           [●────]  0.30 rad/s  │
│                      │  Wobble         [─────]  0.00        │
│                      │ ── Render ──────────────────────── │
│                      │  Hue            [────●]  210°        │
│                      │  Saturation     [────●]  0.55        │
│                      │  Brightness     [──●──]  0.80        │
│                      │  Banding        [──●──]  0.40        │
│                      │  [ Duplicate ]  [ Delete ]           │
└──────────────────────┴─────────────────────────────────────┘
```

### 4.2 Panel zones

| Zone | Purpose |
|---|---|
| Top toolbar | Add buttons (one per kind), Hide All toggle, Pause, Save, Load |
| Left column | Scrollable entity list, drag-to-reorder (z-paint order), click to select, eye-icon toggles `visible` per entity |
| Right column | Property editor for the selected entity, grouped: **Visibility/Transform → Motion → Render → Danger (Delete/Duplicate)** |
| Bottom strip | Camera coords + zoom readout; clickable to reset camera |

### 4.3 Interaction model

- **Plain drag** on canvas → rotate / tilt camera (carry forward from reference).
- **Scroll wheel** on canvas → zoom (carry forward from reference).
- **Shift+drag** on canvas → rubber-band selection box; entities inside are added to selection.
- **Click** on a visible entity → selects it; right column shows its props.
- **Click** on empty canvas → deselects.
- **Drag-and-drop** a `scene.json` onto canvas → loads it.
- **Keyboard**: `Space` = pause toggle; `Delete` = delete selected; `Ctrl/Cmd+D` = duplicate selected; arrow keys nudge position.

### 4.4 Save / load

- **Save**: serializes current scene to JSON, triggers `<a download="scene.json">` Blob download, **and** writes the same JSON to `localStorage["mad.scene"]` (autosave on every edit too).
- **Load**: button opens native file picker; user picks a `scene.json`; parsed, validated against schema (see §3.1). If invalid → red toast, scene unchanged. If valid → applied, current autosave overwritten.
- **Drag-and-drop**: same parser/validator; applies on drop.
- **Reset**: wipes localStorage and reloads the empty default.

## 5. Rendering approach

The reference's pattern is **one full-screen fragment shader** that reads the scene from uniforms. The new design extends that — but uniforms have a hard cap. With 9 entity kinds × N entities, we must route data differently.

**Chosen approach: a 64×4 `RGBA32F` data texture.** Each entity occupies one row (4 texels wide) holding four `vec4` slots. The fragment shader walks a fixed loop over 64 rows and reads its entity's data via a single `texture()` call per row, plus a second `texture()` per row to fetch the parent's world position. This is the same approach the reference uses (it already loops 3 star-field layers in a single pass); we just scale it.

### 5.1 Per-entity vec4 layout (the row)

Each row of the data texture holds 4 vec4s for one entity. Packing is fixed — the packer in `src/pack.js` writes these slots, the shader reads them via `readEntity(int slot)`.

| Slot | x | y | z | w |
|---|---|---|---|---|
| vec4[0] | `kind` (KIND_GPU int) | `pos.x` (world, JS-resolved) | `pos.y` (world, JS-resolved) | `parentSlot` (0..63, or 255 if none) — OR `base.rotation` if this entity is a chain root |
| vec4[1] | `color.h / 360` (0..1) | `color.s` (0..1) | `color.b` (0..1) | `scale` |
| vec4[2] | `motion.p0` (per-kind) | `motion.p1` | `motion.p2` | `motion.p3` |
| vec4[3] | `render.r0` (per-kind) | `render.r1` | `render.r2` | `render.r3` (or `base.rotation` if vec4[0].w is occupied) |

**Why 64×4, not 64×1?** A 1-tall texture cannot be sampled with positive Y-offsets — those would return the border color (0), and every entity's slots 2/3/4 would read as zero. The shape is `width=64, height=4`. The packer calls `gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 64, 4, 0, gl.RGBA, gl.FLOAT, data)`. The GLSL `readEntity(i)` returns row `i`, all four vec4s, via a single 2D `texture()` call with the right UV; no Y-offset trick.

### 5.2 Data flow (per frame)

```
JS (scene state)
   │
   ├─ resolveOrbits(scene, t)            ← walks orbit graph, computes
   │                                       world position for each entity
   │
   ├─ packEntitiesToDataTexture(scene)   ← writes 64×4 RGBA32F
   │
   ▼
gl.texImage2D(... RGBA32F, 64, 4 ... data)
   │
   ▼
fragment shader main() {
  vec3 col = renderBackground(uv, time);
  for (int i = 0; i < MAX_ENTITIES; i++) {
    Entity e = readEntity(i);
    if (e.kind == 0) continue;       // 0 = unused slot
    if (!e.visible) continue;        // 0.0 visible
    col = renderEntity(e, uv, time, col);
  }
  fragColor = vec4(grade(aces(col)), 1.0);
}
   │
   ▼
gl.drawArrays()
```

### 5.3 Uniform budget (the reason for data texture)

- `GL_MAX_FRAGMENT_UNIFORM_COMPONENTS` minimum in WebGL2 / ES 3.0 is **896**, not 1024 (the 1024 figure is the WebGL 1.0 / GLSL ES 1.00 number). 64 entities × 16 floats per entity × 4 components per vec4 / 4 components per scalar = 256 vec4s if we had to use individual uniforms — well over the budget. The data-texture approach is the only realistic path.
- The engine logs the live `gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_COMPONENTS)` to the console at boot. If it's below **896** (the ES 3.0 spec minimum, verified against Khronos `glGet` reference), the engine aborts with a spec-violation error — the page is broken on a non-conformant GPU.

### 5.4 Hard caps

- **Max entities**: 64. Beyond that, JS shows a "scene too dense" warning in the God Panel. The shader loops with a constant `MAX_ENTITIES = 64` and culls unused slots.
- **Max nesting depth**: 8 (orbits-of-orbits-of-orbits…); enforced at load + edit time.
- **Render order**: painter's algorithm — entities with lower `z` (sort key, derived from orbit radius) draw first, so far things sit behind near things. Re-sorted when orbits change.

### 5.5 Camera + world-to-UV

- Camera state (`x`, `y`, `zoom`) maps to the same `uMouse` + `uZoom` uniforms the reference already exposes. Yaw/pitch (driven by drag) maps to a rotation matrix as in `renderScene` (reference lines 401-405). All unchanged.

## 6. Element catalog (per-kind motion & render)

Each kind extends `EntityBase` with kind-specific `motion` and `render` fields.

### 6.1 Galaxy
- **Motion**: `spin` (rad/s), `pulse` (0..1 — slow brightness breathing), `wobble` (rad amplitude on tilt).
- **Render**: `armCount` (1..6), `armSharpness` (0..1), `coreSize` (0..1), `coreBrightness` (0..3), `dustIntensity` (0..1), `colorH/S/B` (HSV).
- **SDF shape**: logarithmic spiral arms + Gaussian core + 3-layer star field (carried forward from `renderCosmos`, reference lines 247-280).

### 6.2 Planet
- **Motion**: `spin`, `wobble`, `tilt` (rad), `bandingSpeed` (0..1 — how fast the surface bands drift).
- **Render**: `radius` (0..1), `banding` (0..1 — surface texture bands), `atmosphere` (0..1 — rim glow), `atmosphereColor` (HSV), `colorH/S/B`.
- **SDF shape**: `sdCircle` + animated procedural bands + optional atmosphere ring.

### 6.3 Moon
- **Motion**: `spin`, `wobble`, `libration` (0..1 — small amplitude swing).
- **Render**: `radius`, `craterDensity` (0..1), `albedo` (0..1 — brightness), `colorH/S/B`.
- **SDF shape**: `sdCircle` + crater noise pattern (FBM, reference lines 162-182).

### 6.4 Shooting star
- **Motion**: `vx`, `vy` (world units / s) — straight-line motion, not an orbit. `lifetime` (s) + respawns at edge.
- **Render**: `length` (0..1), `thickness`, `brightness`, `colorH/S/B`, `trailFade` (0..1).
- **SDF**: line segment with a soft falloff in `renderScene`.

### 6.5 Black hole
- **Motion**: `spin` (event horizon rotation), `accretionSpeed` (disk rotation rate), `lensingPulse` (0..1).
- **Render**: `schwarzschildRadius` (0..1), `accretionRadius` (0..1), `jetReach` (0..1), `spikeSharpness` (matches reference's `uSpikes` uniform), `colorH/S/B`.
- **SDF**: central dark disk + bright accretion ring + optional polar jets. Reuse `evaluateQuasar` logic from reference (lines 291-320) without the penguin-eyes context.

### 6.6 Ring (attaches to a planet or moon)
- **Motion**: none (inherits parent's orbit + spin).
- **Render**: `innerRadius`, `outerRadius`, `tilt` (rad), `opacity` (0..1), `banding` (0..1), `colorH/S/B`.
- **Implementation**: parented entity; position = parent position; orbit disabled. Render as ellipse with banding in shader.

### 6.7 Nebula
- **Motion**: `drift` (world units / s — slow translation), `turbulence` (0..1 — internal FBM time-scale).
- **Render**: `radius` (0..1), `density` (0..1), `softness` (0..1 — falloff), `colorH/S/B`.
- **SDF**: Gaussian falloff × FBM × HSV.

### 6.8 Comet
- **Motion**: `orbitParent`, `orbitRadius`, `orbitSpeed`, `orbitPhase`, `tailWobble` (rad amplitude).
- **Render**: `nucleusRadius` (0..1), `tailLength` (0..1), `tailWidth` (0..1), `tailFade` (0..1), `colorH/S/B`.
- **SDF**: bright head + elongated tail pointing away from orbit's parent (computed in shader from velocity vector).

## 7. Removing the penguin

The reference's `mapPenguin` (lines 218-245), the eye quasar logic (lines 354-371), and the `mapPenguin` call in `renderScene` (line 338) are **deleted entirely**. The penguin's quasar-eyes and bloom pass are **recycled** for the new Black Hole kind, which keeps the visual identity (spectral color, spikes, jets) without the bird.

The `uniform` block is slimmed: keep `iResolution`, `iTime`, `uMouse`, `uZoom`. Drop the eight `uPeriod/uIntensity/uBloom/...` sliders — replaced by per-entity controls in the God Panel. Keep `uChroma` and `uGrain` as **global post-FX** still exposed in the top toolbar (so the wallpaper still has the cinematic feel).

## 8. Risk table

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Exceed WebGL2 uniform count with many entities | Medium | High | Use a data texture (one pixel per entity) rather than individual uniforms. Hard cap = 64 entities. |
| Shader compile time grows with kind count | Medium | Low | One shader, fixed `MAX_ENTITIES = 64`, all 9 kinds' code paths always compiled. Branch on `kind` per pixel. |
| Scene JSON desync between Save and Load | Low | Medium | `schemaVersion` field; load-time validation; on version mismatch, refuse with a clear error. |
| Orbit recursion blow-up (A orbits B orbits A) | Low | High | At save + edit time, DFS the orbit graph; reject if cycle found or depth > 8. |
| Wallpaper engine sandboxing (no `localStorage`) | Medium | Low | Save to download is the canonical path. localStorage is only an autosave convenience; if blocked, the app still works. |
| WebGL2 not available (older / headless GPU) | Low | High | Keep the reference's 2D-fallback path: detect on boot, render the spiral background + a static message; God Panel still editable. |
| Pointer-event collision (drag-to-rotate vs. shift-drag-to-select) | Medium | Medium | Explicit modifier; no auto-detection. Document in README. |
| File picker for Load blocked in kiosk mode | Low | Low | Drag-and-drop is the secondary path. |

## 9. Out of scope (YAGNI)

- Audio. Concept is visual.
- 3D physics. Motion is parametric (orbits, drifts, sin/cos oscillators).
- Cloud save / account / sharing. Save = local file.
- Mobile-specific layout. This is a Linux desktop wallpaper; if it works in a phone browser, fine, but the panel layout assumes ≥1280px wide.
- Custom shader entities. Eight fixed kinds. Power users can edit the shader source.
- Multi-scene timeline / animation tracks. One scene, one moment.
- Undo/redo. (Could be a v2 if requested; flagged for future.)

## 10. Acceptance criteria (Phase 1 → Phase 2 gate)

The Phase 2 task plan is acceptable when:

1. The default scene is **empty** (zero entities, background on).
2. The user can add each of the 9 entity kinds via the toolbar and see it appear in the canvas within one frame.
3. Clicking an entity selects it; right column shows its per-kind properties; edits apply live (no Save needed to preview).
4. Save downloads a `scene.json` whose `schemaVersion === 1` and that round-trips (Load restores identical scene).
5. The 8 penguin references (SDF body, eyes, eye-quasar call, all `uPeriod/uIntensity/...` uniforms, the `mapPenguin` function, the cosmic-penguin title, the penguin credit, the eye-socket dark circles) are **not present** anywhere in `index.html`.
6. Top toolbar has: 8 Add buttons, Hide All, Pause, Save, Load. Nothing else.
7. README documents at least three Linux wallpaper-engine recipes matching the **2026 reality** in §12 (`plasma6-wallpapers-webengine` for KDE 6, Chromium `--window-type=desktop` for Hyprland/Sway, xwinwrap as the X11-only fallback). **No mention** of the dropped KDE tech preview or Variety.
8. The 2D-fallback path still paints something reasonable if WebGL2 is missing.

## 11. Resolved open questions (no longer open — locked in §5.1 and the design above)

- **Data texture slot assignment:** every frame the packer walks `scene.entities` in array order and writes them into the first N rows; rows N..63 are zeros. Deleting an entity shifts the rest down. Slot index is the entity's position in `scene.entities`. The shader reads slot i via `vec2((i+0.5)/64, 0.5/4)` for the first vec4, etc.
- **GLSL source location:** one inlined `FRAG` template literal in `index.html`. Matches the reference's pattern, keeps the file self-contained.
- **TDD for a fragment shader:** Vitest for JS units, Playwright visual diff for the shader, gated by `?seed=42&t=0` for determinism. The 9 golden-image specs (galaxy, planet, moon, ring, shootingStar, blackHole, nebula, comet, emptyScene) live at `docs/plans/2026-08-25-fs-toybox-golden-specs.md`.

## 12. Reality check: 2026 Linux desktop landscape (added by the subagent review pass)

The original design assumed the three wallpaper engines — xwinwrap + Firefox kiosk, KDE Plasma WebEngine Wallpaper, and GNOME + Variety — were the canonical paths. **None of these are correct in 2026.** The implementation plan's M11 must reflect this; the README recipes (M11.1) must use the recipes below.

| Engine | Status in 2026 | Use it? |
|---|---|---|
| xwinwrap + Firefox/Chromium kiosk (X11) | Real, but **X11-only**. Works on Ubuntu 22.04 (last X11 default), Debian 12, Xfce, i3. | **Documented as the X11 fallback** for GNOME X11 / i3 / openbox users. |
| KDE Plasma WebEngine Wallpaper (tech preview) | **Dropped in Plasma 6.** Repo is archived; the Plasma 6 default wallpaper plugin set does not include it. | **Do not mention.** Replace with the community fork. |
| `luisbocanegra/plasma6-wallpapers-webengine` | **Active, maintained for Plasma 5.27 LTS and Plasma 6.x.** | **Primary KDE recipe** for Plasma 6 (Kubuntu 24.04, KDE neon, Fedora KDE). |
| Chromium `--ozone-platform=wayland --window-type=desktop` (Hyprland / Sway / river) | Real. Headless Chromium reparented to a layer-shell surface. | **Primary Wayland recipe** for tiling WMs. GNOME Wayland and KDE Wayland can use this too. |
| Variety | **Not an HTML renderer** — Variety is an image rotator. The `github.com/variety/variety` URL is now a MongoDB schema analyzer. | **Do not mention.** |
| GNOME Wayland | **No first-class HTML wallpaper support.** Workaround: drop to GNOME X11 session, or use a compositor that exposes layer-shell. | **Known gap**, documented in the README. |

**Consequence for the design:** the README (M11.1) is the only place these recipes appear; the design itself is environment-agnostic (it just ships an `index.html`). The implementation plan's M11.1 task list is updated to match.
