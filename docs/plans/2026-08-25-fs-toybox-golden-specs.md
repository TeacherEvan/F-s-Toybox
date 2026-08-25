# Golden Image Specs — F's-Toybox

> Each spec is a **structural** check the Playwright visual-diff test will
> run on the captured PNG. The implementer generates the golden PNG by
> running their working engine at the specified seed/position/time; the
> test asserts the listed *properties* on that PNG. The golden is NOT a
> pixel-exact match — the 1% threshold is the noise floor for shader
> non-determinism. These specs are designed so that wrong implementations
> (no-spiral galaxy, missing trail, event horizon painted as a glow, ring
> rendered as a filled disk, no comet tail, etc.) all FAIL.

## Global test conditions (apply to every spec)

- **Viewport:** 1280×720 (Playwright `viewport: { width: 1280, height: 720 }`)
- **Camera:** `{ x: 0, y: 0, zoom: 1 }` (no transform)
- **URL:** `http://localhost:8080/index.html?seed=42&t=0`
  - `?seed=42` — engine must read this and feed it to its hash/FBM so
    noise is deterministic. Implement in M4 if not already.
  - `?t=0` — engine must FREEZE its clock at zero. **REQUIRED**; the
    implementer must add this URL param. Without it, shooting-star and
    comet positions are not deterministic.
  - Both params are parsed before `bootGL()` so the first rendered
    frame is already deterministic.
- **UV → pixel mapping** (matches the reference's `uv ∈ [-1, 1]` covering
  the full frame, with the square stretched to the viewport):
  - `px = (uv.x + 1) * 0.5 * 1280`
  - `py = (1 - uv.y) * 0.5 * 720`
  - World: `x ∈ [-1, 1]`, `y ∈ [-1, 1]`
- **Background:** enabled, `spiralSpeed = 0.8`, `starDensity = 1` (defaults)
- **Per-entity defaults:** `scale = 1`, `rotation = 0`, `color = {h:200, s:0.6, b:0.85}` unless the spec overrides.
- **Test driver pattern:**
  ```js
  await page.goto('/index.html?seed=42&t=0');
  await page.waitForFunction(() => window.scene !== undefined);
  await page.evaluate(() => {
    const e = createEntity('galaxy');        // kind per spec
    e.position = { x: 0.3, y: 0.2 };         // per spec
    Object.assign(e.motion, { /* per spec */ });
    Object.assign(e.render, { /* per spec */ });
    scene.addEntity(e);
  });
  await page.waitForTimeout(50);              // one frame
  await page.screenshot({ path: 'tests/golden/<kind>-1.png' });
  ```

## Forbidden globals (apply to every entity spec)

The captured frame MUST NOT be:

- All-black (mean luminance < 0.02)
- All-white (mean luminance > 0.98)
- Identical to the empty-scene frame (the entity must add something
  visible — pixel diff vs. `emptyScene-1.png` ≥ 1%)

The captured frame MUST contain at least 50 pixels with luminance > 0.5
in a 400×400 box around the entity's pixel position. (Anti anti-pattern:
the implementer cannot satisfy the spec by drawing a single white pixel.)

---

### galaxy golden spec
- **Seed:** `?seed=42`
- **Position:** UV `(0.3, 0.2)` → pixel `(832, 288)`
- **Time:** `t = 0` (frozen via `?t=0`)
- **Required signal:** a bright core at `(832, 288)` AND a fainter
  non-circular bright region extending out to ~120px radius (spiral
  arms + FBM dust + scattered stars). Implementation must reuse
  `renderCosmos` shape from the reference (lines 247-280) with
  constants driven by per-entity props.
- **Forbidden signal:**
  - A uniform bright disk (no arm pattern)
  - Brightness confined to ≤40px radius (no arms extending out)
  - A frame that looks like the empty-scene background (galaxy
    didn't render at all)
- **Pixel-region check:**
  - In a 240×240 box centered on `(832, 288)`, the central 40×40
    box has mean luminance ≥ 0.5 (the core)
  - In the same 240×240 box, the annular ring of pixels at radius
    **60-100px** from center has mean luminance in `[0.10, 0.60]`
    (arms are present but dimmer than the core)
  - Luminance stddev across the 240×240 box ≥ 0.10 (arm vs.
    inter-arm contrast)
  - Pixels at radius > 140px from center have mean luminance < 0.10
    (the galaxy doesn't extend infinitely)
- **Visual sanity:** a bright golden core at `(832, 288)` with violet
  spiral arms curving outward, FBM-tinted dust lanes between arms,
  and a few scattered stars in the surrounding box.

---

### planet golden spec
- **Seed:** `?seed=42`
- **Position:** UV `(-0.4, 0.3)` → pixel `(384, 252)`
- **Time:** `t = 0` (frozen via `?t=0`)
- **Required signal:** a roughly circular bright region of radius
  ~50px centered on `(384, 252)` (the planet body) with surface
  banding visible — luminance VARIES across the disk, NOT uniform.
- **Forbidden signal:**
  - A solid-color disk (no banding): stddev < 0.03 fails
  - A point or <20px-radius dot
  - A sharp outline with hollow center (the SDF must fill, not stroke)
- **Pixel-region check:**
  - In a 120×120 box centered on `(384, 252)`, the central 60×60
    box has mean luminance ≥ 0.3 (planet body is bright)
  - In the same 60×60 box, luminance stddev ≥ 0.06 (banding creates
    visible variation)
  - Pixels at radius > 55px from center (i.e. just outside the
    120×120 box) have mean luminance < 0.10 (the planet doesn't
    bleed into the background)
- **Visual sanity:** a Saturn-sized planet with horizontal banding
  in its declared color, distinct from the background spiral.

---

### moon golden spec
- **Seed:** `?seed=42`
- **Position:** UV `(-0.4, -0.3)` → pixel `(384, 468)`
- **Time:** `t = 0` (frozen via `?t=0`)
- **Required signal:** a roughly circular region of radius ~30px
  centered on `(384, 468)` (smaller than the planet spec's 50px)
  with crater-like FBM noise variation across the surface.
- **Forbidden signal:**
  - A solid-color disk (no crater noise): stddev < 0.02 fails
  - A glow with no defined edge
  - The moon rendered larger than 40px radius (must be smaller
    than the planet — the two specs are NOT interchangeable)
- **Pixel-region check:**
  - In an 80×80 box centered on `(384, 468)`, the central 40×40
    box has mean luminance ≥ 0.2 (moon body is visible, dimmer
    than the planet's ≥0.3)
  - In the same 40×40 box, luminance stddev ≥ 0.04 (crater FBM
    creates visible variation)
  - Pixels at radius > 40px from center have mean luminance < 0.05
    (the moon has no halo)
  - The bright-pixel count in the 80×80 box is ≥ 60% of the box
    area (the moon is mostly visible, not a few specks)
- **Visual sanity:** a small dim circle (smaller and dimmer than
  the planet) with bumpy crater texture in a desaturated tone.

---

### shootingStar golden spec
- **Seed:** `?seed=42`
- **Position:** UV `(0.5, 0.0)` → pixel `(960, 360)`
- **Time:** `t = 0` (frozen via `?t=0`)
- **Motion override:** `vx = -0.4`, `vy = 0.0` (the test must set
  these; without them the trail direction is non-deterministic).
  Default `length = 0.3` → trail length in pixels = `0.3 * 640 = 192px`.
- **Required signal:** a bright head at `(960, 360)` AND a linear
  trail of bright pixels extending from the head in the **+x**
  direction (opposite to `vx`), reaching roughly to pixel
  `(1152, 360)`.
- **Forbidden signal:**
  - A single bright point at `(960, 360)` with no trail
  - A trail extending in the -x direction (same as motion, not opposite)
  - A trail in a non-horizontal direction (`vy = 0` is enforced)
  - A streak wider than 10px (it's a thin shooting-star trail,
    not a comet tail — width must come from the default
    `thickness = 0.005` → ~3.2px in pixel space)
- **Pixel-region check:**
  - In a 220×30 box from `(950, 345)` to `(1170, 375)`, at least
    40% of pixels have luminance > 0.15 (head + trail)
  - The pixel at `(960, 360)` is the brightest in this region
    (the head dominates)
  - Pixels at the LEFT edge of this box (around x=950) have mean
    luminance < 0.08 (no trail extending in the -x direction)
  - Pixels at the RIGHT edge (around x=1170) have mean luminance
    > 0.05 (trail reaches its expected end)
  - Pixels directly above/below the trail (e.g. `(1060, 330)`)
    have luminance < 0.05 (trail is thin and horizontal)
- **Visual sanity:** a bright dot at `(960, 360)` with a fading
  horizontal streak extending to the right edge of the test box.

---

### blackHole golden spec
- **Seed:** `?seed=42`
- **Position:** UV `(0.0, 0.4)` → pixel `(640, 216)`
- **Time:** `t = 0` (frozen via `?t=0`)
- **Required signal:** a **DARK** pixel at `(640, 216)` (the event
  horizon, `schwarzschildRadius = 0.05`), surrounded by bright
  **spike** pixels along the x and y axes AND bright **jet** pixels
  extending vertically. Implementation reuses the body of
  `evaluateQuasar` from the reference (lines 291-320) with the
  three global uniforms replaced by per-entity values from the
  data texture: `spikeSharpness` → `e.p0`, `jetReach` → `e.p1`,
  `intensity` → `e.p2`, `accretionSpeed` → `e.p3`.
- **Forbidden signal:**
  - A bright center (event horizon must be DARK)
  - A uniform circular glow (the spike/jet pattern is ANGULAR,
    not radial — a glowing-ball stub fails)
  - Spikes missing along the y-axis (the jets are the dominant
    vertical feature)
- **Pixel-region check:**
  - Pixel at `(640, 216)` has luminance < 0.08 (dark event horizon)
  - Pixel at `(640, 186)` (30px directly above center) has
    luminance > 0.20 (upper jet spike)
  - Pixel at `(640, 246)` (30px directly below center) has
    luminance > 0.20 (lower jet spike)
  - Pixel at `(670, 216)` (30px right of center) has luminance
    > 0.10 (horizontal spike; dimmer than the jets)
  - Pixel at `(610, 216)` (30px left of center) has luminance
    > 0.10 (horizontal spike; dimmer than the jets)
  - Pixel at `(660, 236)` (diagonal, 20px right + 20px down)
    has luminance < 0.08 (between the spikes, dark)
- **Visual sanity:** a dark dot at `(640, 216)` with a white cross
  of spikes through it and bright vertical streaks (jets) extending
  up and down past the cross.

---

### ring golden spec
- **Setup:** a planet MUST be added first at UV `(0.5, 0.0)`
  → pixel `(960, 360)`. Then a ring is added with
  `orbit.enabled = false`, `position = { x: 0.5, y: 0.0 }`,
  and `orbit.parentId = <planet's id>` (the ring is parented).
  Default `innerRadius = 0.12, outerRadius = 0.18` → annulus from
  `0.12 * 640 = 76.8px` to `0.18 * 640 = 115.2px` from center.
- **Seed:** `?seed=42`
- **Position:** UV `(0.5, 0.0)` → pixel `(960, 360)` (same as parent)
- **Time:** `t = 0` (frozen via `?t=0`)
- **Required signal:** a bright **annulus** around `(960, 360)` at
  radii 76-115px from center. The very center (where the planet
  body is) is NOT the brightest region.
- **Forbidden signal:**
  - A solid filled disk (no hole in the middle)
  - The annulus missing (ring rendered as a faint uniform glow)
  - The center brighter than the annulus (the planet's body, not
    the ring, would be at the center)
- **Pixel-region check:**
  - In a 300×300 box centered on `(960, 360)`, the mean luminance
    of pixels in the annulus (76-115px from center) is > 1.5x the
    mean luminance of pixels in the central 30px (the planet body
    is darker than the ring)
  - The annulus contains at least 200 pixels with luminance > 0.20
  - The central 30px contains fewer than 10 pixels with luminance
    > 0.30 (no bright ring at the very center)
  - Luminance stddev across the 300×300 box ≥ 0.10 (clear annulus
    structure: bright ring + dark center)
- **Visual sanity:** a small dim planet body surrounded by a bright
  tilted ring with banding, like Saturn.

---

### nebula golden spec
- **Seed:** `?seed=42`
- **Position:** UV `(-0.3, -0.2)` → pixel `(448, 432)`
- **Time:** `t = 0` (frozen via `?t=0`)
- **Required signal:** a diffuse bright cloud around `(448, 432)`
  with FBM density variation, fading out with Gaussian falloff.
  NOT a sharp circle.
- **Forbidden signal:**
  - A sharp-edged disk (no Gaussian falloff)
  - A uniform bright blob (no FBM variation)
  - The nebula confined to <60px radius (must be diffuse,
    extending to ~150px)
- **Pixel-region check:**
  - In a 320×320 box centered on `(448, 432)`, at least 30% of
    pixels have luminance > 0.10 (the cloud is visible)
  - In the same 320×320 box, luminance stddev ≥ 0.04 (FBM creates
    visible density variation, not a smooth gradient)
  - The mean luminance in a 60×60 box at the center is at least
    1.5x the mean luminance in a 60×60 box at the box's corner
    (Gaussian falloff: brighter at center, dimmer at edge)
  - Pixels at radius > 180px from center have mean luminance < 0.08
    (the cloud doesn't extend infinitely)
- **Visual sanity:** a fuzzy colored cloud (in the entity's HSV
  color) with internal density variation, like a glowing gas pocket.

---

### comet golden spec
- **Setup:** orbit ENABLED, `orbitParent = null` (defaults to the
  world center `(0, 0)` as a virtual sun — the implementer must
  treat `null` parent as world-center). `orbitRadius = 0.5`,
  `orbitPhase = 0`, `orbitSpeed = 0.3`, `tailWobble = 0.0`.
  Default `tailLength = 0.15`.
- **Seed:** `?seed=42`
- **Position at t=0:** derived from orbit. At `t=0`, head is at
  UV `(orbitRadius * cos(phase), orbitRadius * sin(phase))`
  = `(0.5, 0.0)` → pixel `(960, 360)`. Orbit velocity at this
  position is `(0, orbitSpeed) = (0, 0.3)`. The tail points
  OPPOSITE to the velocity, so the tail direction is `(0, -0.3)`
  in UV, which maps to DOWNWARD in the image (UV -y → image +y).
  Tail end: pixel `(960, 360 + 0.15 * 360)` ≈ `(960, 414)`.
- **Time:** `t = 0` (frozen via `?t=0`)
- **Required signal:** a bright head at `(960, 360)` AND an
  elongated tail of bright pixels extending DOWNWARD in the image
  (toward pixel `(960, 414)` approximately). The bright region
  is TALLER than it is WIDE.
- **Forbidden signal:**
  - A circular bright region (no tail; must be elongated, not
    symmetric — a head-only stub fails)
  - A tail extending UPWARD (the spec sets `orbitPhase = 0`, so
    velocity is +y in UV and tail must be -y in UV = +y in image)
  - A horizontal tail (velocity is vertical at phase 0, so the
    tail must be vertical in the image)
  - A tail of zero length (head only)
- **Pixel-region check:**
  - In a 60×80 box from `(930, 360)` to `(990, 440)`, at least
    30% of pixels have luminance > 0.15
  - The bright region's bounding box (within this test box) has
    height/width aspect ratio ≥ 1.5 (tall, not square)
  - The pixel at `(960, 360)` (the head) has luminance > 0.3
  - The pixel at `(960, 410)` (along the tail, 50px below head)
    has luminance > 0.10 (tail is visible, not faded out instantly)
  - The pixel at `(960, 330)` (above the head, opposite to the
    tail) has luminance < 0.08 (no tail in the wrong direction)
  - The pixel at `(990, 360)` (right of head, perpendicular to
    tail) has luminance < 0.08 (tail is vertical, not horizontal)
- **Visual sanity:** a small bright head with a vertical tail
  trailing below it (in the image), like a tiny glowing teardrop.

---

### emptyScene golden spec
- **Setup:** no entities added. Boot the page and wait one frame
  after the engine is ready.
- **Seed:** `?seed=42`
- **Time:** `t = 0` (frozen via `?t=0`)
- **Required signal:** the spiral background is visible — a bright
  golden core near the center of the frame, violet spiral arms
  curving out from it, and a scattering of bright star pixels
  across the field. The frame is NOT black.
- **Forbidden signal:**
  - An all-black frame (mean luminance < 0.02 — the background
    didn't render)
  - An all-white frame (mean luminance > 0.98 — the background
    is broken in a different way)
  - No stars visible (the 3-layer star field is part of the
    background and must be present)
  - Any 100×100 region with luminance stddev < 0.005 (uniform
    region detector — FBM noise and stars must create variation
    everywhere)
- **Pixel-region check:**
  - Mean luminance across the full frame ≥ 0.04 (background is
    present but dim)
  - At least 200 pixels in the frame have luminance > 0.30
    (the bright core + bright stars)
  - The central 200×200 box (centered on `(640, 360)`) has mean
    luminance ≥ 0.10 (the spiral core is the brightest part)
  - The brightest pixel in the frame has luminance > 0.70
    (the core or a bright star is dominant)
  - The mean pixel-diff vs. the test's empty-scene baseline is
    < 1% (the frame is self-consistent — used to detect engine
    non-determinism in the noise)
- **Visual sanity:** a dim blue-purple cosmic swirl with a
  bright golden core near the center and small twinkling stars
    scattered across the field.

---

### spiralSystem golden spec
- **Seed:** `?seed=42`
- **Position:** UV `(0, 0)` → pixel `(640, 360)` (centered at world origin, the default spawn point for style 0)
- **Time:** `t = 0` (frozen via `?t=0`)
- **Style-specific override:** `field.style = 0` (Spiral), `field.particleCount = 64`, `field.spawn = { x: 0, y: 0 }`, `field.speed = 1.0`, `field.spawnRate = 10`, `field.trailLength = 8` (all at design-doc defaults; the spec is deterministic because the seed drives the per-particle phases and radii)
- **Required signal:** 64 particles arranged in a logarithmic spiral structure with visible curved arms extending from a brighter central region outward to ~100-120px radius. The arms emerge from the per-particle trail history under differential rotation (each particle's `ω = k / r`).
- **Forbidden signal:**
  - A uniform bright disk (no arm pattern): stddev < 0.05 across the 240×240 box fails
  - A purely random scatter of 64 dots with no spiral organization (defeats the "logarithmic spiral" requirement — dots must lie on curved arms)
  - A single bright dot (only one particle visible): must have ≥ 40 distinct bright pixels
  - Brightness confined to ≤40px radius (no arms extending out): the annulus at 60-100px must be lit
- **Pixel-region check:**
  - In a 240×240 box centered on `(640, 360)`, the central 40×40 box has mean luminance ≥ 0.3 (the core region is bright due to innermost particles)
  - In the same 240×240 box, the annular ring at 60-100px from center has mean luminance in `[0.05, 0.50]` (arms are present but dimmer than the core)
  - Luminance stddev across the 240×240 box ≥ 0.08 (arm vs inter-arm contrast — a filled disk would be uniform)
  - Pixels at radius > 140px from center have mean luminance < 0.10 (the system doesn't extend infinitely)
  - At least 40 distinct bright pixels (luminance > 0.3) in the 240×240 box (64 particles × trails)
- **Visual sanity:** 64 particles arranged in a spiral pattern with curved arms extending from a brighter central region, like a small spiral galaxy seen from above.

---

### ringSystem golden spec
- **Seed:** `?seed=42`
- **Position:** UV `(0, 0)` → pixel `(640, 360)` (centered at world origin, the default spawn point for style 2)
- **Time:** `t = 0` (frozen via `?t=0`)
- **Style-specific override:** `field.style = 2` (Ring), `field.particleCount = 64`, `field.spawn = { x: 0, y: 0 }`, `field.speed = 1.0`, `field.spawnRate = 10`, `field.trailLength = 8` (all other field defaults; phases are evenly spaced per the design doc)
- **Required signal:** 64 particles arranged on a single elliptical path (ring) centered on `(640, 360)`, with the center of the ring clearly dark (a HOLE in the middle). The ring is the only structure — no spiral arms, no scatter cloud.
- **Forbidden signal:**
  - A filled disk (no hole in the center) — the central 30×30 box must be dim
  - A purely random scatter (no defined elliptical path) — particles must be confined to a ring
  - A single bright dot (only one particle visible) — must have ≥ 40 distinct bright pixels
  - The center brighter than the annulus (the center must be the HOLE, not a bright dot)
- **Pixel-region check:**
  - In a 240×240 box centered on `(640, 360)`, the central 30×30 box has mean luminance < 0.10 (the HOLE in the ring)
  - In the same 240×240 box, the annular ring at 50-90px from center has mean luminance ≥ 0.15 (the ring is visible)
  - The annulus at 50-90px is at least 1.5× brighter than the central 30×30 box (HOLE check — annulus dominates the center)
  - Luminance stddev across the 240×240 box ≥ 0.08 (clear ring + dark center contrast — a filled disk would have lower stddev)
  - Pixels at radius > 120px from center have mean luminance < 0.05 (ring doesn't extend infinitely)
  - At least 40 distinct bright pixels (luminance > 0.3) in the annular ring (50-90px) — 64 particles on a ring, all visible
- **Visual sanity:** 64 particles forming a thin elliptical ring with a clearly dark center, like Saturn's rings seen from above.

---

### scatterSystem golden spec
- **Seed:** `?seed=42`
- **Position:** UV `(0, 0)` → pixel `(640, 360)` (centered at world origin, the default spawn point for style 3)
- **Time:** `t = 0` (frozen via `?t=0`)
- **Style-specific override:** `field.style = 3` (Scatter), `field.particleCount = 64`, `field.spawn = { x: 0, y: 0 }`, `field.speed = 1.0`, `field.spawnRate = 10`, `field.trailLength = 8` (all other field defaults; particles drift in random directions with low velocity)
- **Required signal:** 64 particles distributed in a non-uniform cloud around `(640, 360)`, with visible density variation (some clustering, some empty space) but NO spiral arms and NO defined ring structure. The center is NOT a dark hole (unlike the ring style).
- **Forbidden signal:**
  - A uniform haze (no density variation): stddev < 0.02 across the 240×240 box fails
  - Visible spiral arms (this is scatter, not spiral) — bright pixels must be spread across all angular directions, not concentrated in 2-4 arcs
  - A defined elliptical ring structure (this is scatter, not ring) — the center must NOT be a dark hole
  - A single bright dot (only one particle visible) — must have ≥ 30 distinct bright pixels
- **Pixel-region check:**
  - In a 240×240 box centered on `(640, 360)`, at least 15% of pixels have luminance > 0.05 (particles are distributed, not absent)
  - Luminance stddev across the 240×240 box ≥ 0.04 (non-uniform density — a uniform haze would have lower stddev)
  - The central 60×60 box has mean luminance at least 1.3× the mean luminance of the annulus at 100-120px (Gaussian-like falloff from the spawn center)
  - Pixels at radius > 140px from center have mean luminance < 0.08 (scatter doesn't extend infinitely)
  - At least 30 distinct bright pixels (luminance > 0.2) in the 240×240 box (64 particles, some faded)
  - The central 30×30 box has mean luminance > 0.05 (NOT a dark hole — defeats the "ring structure" stub)
  - The bright-pixel count (luminance > 0.2) is distributed across 8 angular sectors (each 45°) such that no single sector contains > 50% of the bright pixels (no concentration in 1-2 arcs — defeats the "spiral arms" stub)
- **Visual sanity:** 64 particles scattered around the center with some clumping and empty regions, like a sparse dust cloud with no obvious geometric pattern.

---

### Star Field test driver pattern

The 3 Star Field specs share a test driver (the entity kind and config block differ from the existing galaxy/planet/etc. pattern because `field` entities have a `field` sub-object):

```js
await page.goto('/index.html?seed=42&t=0');
await page.waitForFunction(() => window.scene !== undefined);
await page.evaluate(() => {
  const e = createEntity('field');                    // Star Field kind
  e.position = { x: 0, y: 0 };                        // centered at origin (per spec)
  e.field = {
    style: 0,                                         // 0=spiral, 2=ring, 3=scatter per spec
    spawn: { x: 0, y: 0 },
    direction: 0,
    speed: 1.0,
    spawnRate: 10,
    trailLength: 8,
    particleCount: 64                                 // per spec
  };
  scene.addEntity(e);
});
await page.waitForTimeout(50);                        // one frame
await page.screenshot({ path: 'tests/golden/<style>System-1.png' });
```

The golden PNG path is `tests/golden/spiralSystem-1.png`, `tests/golden/ringSystem-1.png`, or `tests/golden/scatterSystem-1.png` depending on the spec.

---

## Anti-tautology summary

These specs are designed so that NONE of the following stubs can pass:

| Stub | Why it fails |
|---|---|
| "Always paint a white disk" | Fails every kind's required-signal check (planets/galaxies need stddev, black holes need a DARK center, rings need a hole) |
| "Always paint a uniform color" | Fails the stddev checks on every kind |
| "Skip the entity, render only the background" | Fails the "frame must differ from empty scene" check AND every kind's "bright pixels around the entity position" check |
| "Render the entity at the wrong position" | Fails the pixel-region checks (all centered on the declared position) |
| "Hardcode the test's expected values" | Fails if the implementer uses different motion/render parameters than the spec — the spec is the source of truth |
| "Render the black hole as a glowing ball" | Fails the event-horizon darkness check AND the angular spike/jet check |
| "Render the ring as a solid disk" | Fails the "center dimmer than annulus" check |
| "Render the comet as a symmetric blob" | Fails the height/width aspect-ratio check |
| "Render the shooting star as a single point" | Fails the trail-direction and trail-length checks |
| "Generate the golden first, then write the code to match" | The checks are STRUCTURAL, not pixel-exact — even a perfect pixel match with the wrong geometry (e.g. ring as a disk) would fail |
| "Always paint a uniform white" | fails the structure check (spiral has arms, ring has hole, scatter has variance) |
| "Render a single dot at center" | fails the particle-count check (≥ N distinct bright pixels in 240×240 box) |
| "Render the wrong style" | fails the style-specific structural check (spiral has arms, ring has hole, scatter is non-uniform but lacks arms) |

The implementer **must run their working code at the spec's seed/position/
time to generate the golden PNG**, then the Playwright test runs the same
structural checks on that PNG. The 1% pixel-diff threshold in the plan is
a secondary safety net (catches engine-level non-determinism in the
shader noise), not the primary correctness signal — the primary signal
is the property assertions above.
