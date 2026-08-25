# Star Field — Design Doc

> Companion to `2026-08-25-fs-toybox-design.md`. Read that first.
> Status: design approved, awaiting integration into the main implementation plan.
> Source concept: `docs/plans/2026-08-25-starlink-toybox-v2.md` (the v1 → v2 reframe).
> Supersedes the 5-regime physics analysis (the user clarified: "we're not creating a universe, we're creating a toybox that looks like a universe").

## 1. Identity

| Field | Value |
|---|---|
| Feature name | **Star Field** |
| Internal kind | `field` (KIND_GPU = 9) |
| God Panel label | "Star Field" |
| Type | A 9th entity kind in the existing F's-Toybox data model |
| Goal | A system of dots that look like stars, move in 6 selectable patterns, respond to 7 user controls, and stay constant + manipulable |
| Render target | Same WebGL2 fragment shader; new GLSL function `renderStarField()` in the existing FRAG string |
| Save format | Same `scene.json` (no new schema version) — `field` entities are part of the existing `entities[]` array |
| Performance budget | 256 particles × 60 fps on Intel UHD 620 (the integrated GPU in most 2020-era Linux laptops) |

## 2. What "Star Field" is NOT

To make the scope honest, the design explicitly excludes:

- **No physics.** No `G`, no `μ`, no real gravitational constants. The math is trig + exponentials + a per-particle noise lookup, decorative only.
- **No time-scale concept.** A "10^14-year" setting is meaningless in a toybox. The speed multiplier controls animation speed, not simulated time.
- **No real star data.** The user does not type a satellite ID; they pick a style and tune sliders.
- **No claim to accuracy.** The God Panel does not say "1:1 scale" or "real orbit." It says "Spiral" and renders a spiral.
- **No physics-based acceptance tests.** The tests check **structural visual properties** (does it look like a spiral?), not numerical ones.

## 3. The 6 styles

The shader branches on a `style` integer (0-5) read from the per-particle data texture. Each style is a closed-form math function evaluated per pixel; the pixel's color is the result of evaluating the function at `(uv, time, particleData)`.

| ID | Name | Math (simplified) | Visual |
|---|---|---|---|
| 0 | **Spiral galaxy** | Logarithmic spiral `r = a × exp(b × θ)`; differential rotation `ω = k / r` | 2-4 arms, stars at fixed phases, slow central rotation |
| 1 | **Oval cluster** | Kepler-ish elliptical orbits: `x = cx + a cos(ωt + φ)`, `y = cy + b sin(ωt + φ)`, `ω = k / r^(3/2)` | Globular-cluster or planetary-system look |
| 2 | **Ring** | All particles on the same ellipse; phases evenly spaced | Saturn's-rings look |
| 3 | **Scatter** | Random direction drift from a center, low-velocity, fading | Nebula or dust-cloud look |
| 4 | **Double spiral** | Two counter-rotating logarithmic spirals | Colliding-galaxy look |
| 5 | **Fountain** | Particles rise from a base, peak, fall; rendered as a vertical streak | Geyser or solar-prominence look |

The shader pseudocode for the dispatch:

```glsl
vec3 renderStarField(vec2 uv, float time, sampler2D particleData) {
  vec3 col = vec3(0.0);
  for (int i = 0; i < MAX_PARTICLES; i++) {
    Particle p = readParticle(particleData, i);
    if (p.style == 0) col = blendSpiral(col, uv, time, p);
    else if (p.style == 1) col = blendOval(col, uv, time, p);
    // ... 4 more
  }
  return col;
}
```

The `blend*` functions compute the particle's position at `time` using its per-particle params, then additively blend a small bright dot + fading trail at that position. The trail is a fixed number of past positions (e.g. 16) computed by re-evaluating the position at `time - n × trailStep`.

## 4. The 7 user controls

| Control | God Panel widget | Range | Default | Effect |
|---|---|---|---|---|
| **Style** | 6-button picker | one of 6 | 0 (Spiral) | Which motion function the shader dispatches to |
| **Spawn X** | slider | -1.0 to 1.0 | 0.0 | World-space X where new particles originate |
| **Spawn Y** | slider | -1.0 to 1.0 | 0.0 | World-space Y where new particles originate |
| **Direction** | slider | 0° to 360° | 0° | Initial heading in degrees (0 = +x, 90 = +y) |
| **Speed** | slider | 0.1 to 10.0 (multiplier) | 1.0 | Global time multiplier; affects all particles |
| **Spawn rate** | slider | 0 to 50 per second | 10 | How many new particles appear at the spawn point per second |
| **Trail length** | slider | 0 to 32 past positions | 8 | How many historical positions each particle renders as a fading streak |
| **Particle count** | slider | 16 to 256 | 64 | Total particles in the system (also bounds `MAX_PARTICLES` in the shader) |
| **Clear** | button | — | — | Wipes all particles; the system re-spawns from empty |

The user can have **multiple Star Field entities** in a scene (e.g. one Spiral at top-left, one Ring at bottom-right). Each entity is independent. The God Panel shows the 9 controls for the selected entity, and the 6 style buttons are the only control shared across styles (selecting a style replaces the entity's style, not adds one).

## 5. Data model

### 5.1 Entity on the JS side

```ts
type StarFieldEntity = {
  ...EntityBase,        // id, kind='field', name, visible, position, orbit, scale,
                         // rotation, color, schemaVersion (inherited)
  field: {
    style: 0 | 1 | 2 | 3 | 4 | 5;     // which shader branch
    spawn: { x: number; y: number };  // where new particles appear
    direction: number;                // degrees, 0..360
    speed: number;                   // multiplier, 0.1..10
    spawnRate: number;               // particles per second, 0..50
    trailLength: number;             // 0..32
    particleCount: number;           // 16..256
  };
  particles: ParticleState[];        // length === particleCount; per-particle state
};

type ParticleState = {
  age: number;          // seconds since spawn (drives the trail)
  phase: number;        // initial random phase for the per-particle function
  radius: number;       // per-particle radius for spiral/ring/fountain
  speed: number;        // per-particle speed jitter (× the global speed)
  brightness: number;   // 0..1
};
```

The `particles[]` array is **scene state** — it's saved in `scene.json` (yes, this is a chunky JSON; see §8). It's also rebuilt from the spawn point + rate every frame, so a "Clear" button + new spawn config regenerates the array from scratch.

### 5.2 GPU data layout (per-entity row in the existing 64×4 data texture)

This is the row in the **same** `RGBA32F` 64×4 data texture that the existing plan defines. Star Field is the 9th row (one row per entity, no change to the texture size).

| Slot | x | y | z | w |
|---|---|---|---|---|
| vec4[0] | 9 (KIND_GPU.FIELD) | spawn.x | spawn.y | direction (rad) |
| vec4[1] | h/360 | s | b | speed (multiplier) |
| vec4[2] | style (0..5) | spawn rate (particles/s) | trail length (0..32) | particle count (16..256) |
| vec4[3] | reserved (0) | reserved (0) | reserved (0) | scale |

### 5.3 Per-particle data texture (NEW, separate from the entity data texture)

A second `sampler2D` holds per-particle state. The texture is `256 × 1` (max 256 particles) of `RGBA32F` (16 bytes per particle). Each row holds one particle's state.

| Slot | x | y | z | w |
|---|---|---|---|---|
| vec4[0] | age (seconds) | phase (rad) | radius | speed jitter |
| vec4[1] | brightness | reserved (0) | reserved (0) | reserved (0) |

The packer writes the array of `ParticleState[]` to this texture every frame. The shader reads `i` particles in the style's loop.

The second texture is **only** allocated when at least one Star Field entity is in the scene. If there are no Star Field entities, no second texture is created. (This matters because every texture the GL context allocates is a few KB of driver state; the existing 64×4 entity texture is already the main one.)

## 6. Shader design

The new GLSL function is added to the existing FRAG string. It runs **after** the 8 existing entity kinds' rendering, so Star Field particles overlay (additively) on top of the scene. The function takes the world UV, the time, and the per-particle data texture.

```glsl
#define MAX_PARTICLES 256

uniform sampler2D uParticleData;
uniform int uParticleCount;

struct Particle {
  float age; float phase; float radius; float speedJitter;
  float brightness; float pad1; float pad2; float pad3;
};

Particle readParticle(int i) {
  float u = (float(i) + 0.5) / float(MAX_PARTICLES);
  vec4 v0 = texture(uParticleData, vec2(u, 0.25));
  vec4 v1 = texture(uParticleData, vec2(u, 0.75));
  Particle p;
  p.age = v0.x; p.phase = v0.y; p.radius = v0.z; p.speedJitter = v0.w;
  p.brightness = v1.x;
  return p;
}

// Per-style functions: each returns the additive color contribution at uv.
vec3 styleSpiral(Particle p, vec2 uv, float time, float speed) {
  float theta = p.phase + time * speed * p.speedJitter;
  float r = p.radius;
  vec2 center = vec2(0.0, 0.0);
  float omega = 0.5 / max(r, 0.01);   // differential rotation
  float a = theta + omega * time;
  vec2 pos = center + vec2(cos(a), sin(a)) * r;
  return renderDotWithTrail(uv, pos, p, time, speed);
}

// ... 5 more style functions
```

Each style is ~20-30 lines of GLSL. Total new shader code: ~200 lines. The existing FRAG is already 300+ lines, so this brings it to ~500-550 lines — still well under the 1024-line limit for ES 3.0 shaders.

### 6.1 Trail rendering

A trail of length `N` is rendered by evaluating the position at `t`, `t − trailStep`, `t − 2*trailStep`, ..., `t − (N-1)*trailStep` and drawing each with a fading alpha. The trail step is `1 / spawnRate` (so a star spawns a new trail point at the same rate new stars spawn). This gives a smooth streak without needing a per-frame position history buffer (which would require yet another texture).

## 7. God Panel integration

The God Panel adds a "Star Field" section when a `field` entity is selected. The section has:

```
┌─ STAR FIELD ──────────────────────────────────────┐
│ STYLE                                              │
│  [Spiral][Oval][Ring][Scatter][Dbl-Spirl][Fountn] │
│                                                    │
│ SPAWN POINT                                        │
│  X  [────●] 0.00                                   │
│  Y  [●────] 0.00                                   │
│                                                    │
│ MOTION                                             │
│  Direction  [────●] 0°                             │
│  Speed      [──●──] 1.0                           │
│                                                    │
│ DENSITY                                            │
│  Spawn rate  [──●──] 10/s                          │
│  Particle ct [──●──] 64                           │
│                                                    │
│ TRAIL                                              │
│  Length      [●────] 8                             │
│                                                    │
│  [ Clear particles ]                               │
└────────────────────────────────────────────────────┘
```

The toolbar gets one new button: **+ Star Field**, between `+ Comet` and the Hide All toggle.

## 8. Save / load

The Star Field entity is part of `scene.json` like any other entity. The `particles[]` array is **also** saved, so a saved scene is exactly reproducible.

**Honest cost:** with 256 particles × 16 floats per particle, the per-entity `particles[]` array is ~16 KB of JSON. A scene with 5 Star Field entities is ~80 KB. This is fine for `scene.json` but it's not tiny. The save/load round-trip test in M10 of the existing plan needs an update: assert scene.json size for a "5 Star Fields, 256 particles each" scene is < 1 MB.

If scene size becomes a problem in practice (user feedback), a v2 optimization is to **not** save `particles[]` — instead, save only the spawn config, and re-derive particles at load time using the seed. This is a future change, not v1.

## 9. Performance

The hot loop is per-pixel:

```
for each pixel:
  for each particle (up to 256):
    evaluate style function (1-3 sin/cos + a couple muls)
    compute distance from pixel to particle position
    add small additive contribution
```

At 1280×720 = 921,600 pixels × 256 particles = 235 million evaluations per frame. At 60 fps, that's 14 billion evaluations per second.

**Realistic estimate:** a modern integrated GPU (Intel UHD 620) does ~500 GFLOPS. Each particle evaluation is ~10 FLOPS. 235M evals × 10 FLOPS = 2.35 GFLOPS per frame, 141 GFLOPS per second at 60 fps. **Headroom is ~3.5×.** This is comfortable.

If the headroom is eaten by something else (high-DPI display, multiple Star Field entities), the fallback is `MAX_PARTICLES = 128` (the user-facing slider cap becomes 128, not 256). The performance test in M13.5 asserts a 60 fps target on a 1280×720 viewport with 256 particles.

## 10. Integration with existing plan

This design adds a new milestone M13 to the existing plan at `docs/plans/2026-08-25-fs-toybox.md`. The new milestone comes **after M12** (the docs audit milestone). M13 has 5 sub-tasks:

- **M13.1** — `field` kind in the enum + scene model + per-particle data texture; shader boots and renders 64 spiral particles
- **M13.2** — 5 more styles (oval, ring, scatter, double spiral, fountain) as shader branches
- **M13.3** — God Panel integration (6 style buttons + 7 sliders + Clear button)
- **M13.4** — Golden-image specs for 3 styles (spiralSystem, ringSystem, scatterSystem) + Playwright tests
- **M13.5** — Performance check at 256 particles × 60 fps; fallback to 128 if needed

M13 is sized to slot into the existing plan without re-architecting anything. The data texture, the entity data model, the God Panel, the save/load, the test harness — all reuse the existing infrastructure.

## 11. Acceptance criteria

The Star Field feature is acceptable when:

1. **M13.1 gate:** Vitest test `KIND_GPU.FIELD === 9` passes; Playwright captures `tests/golden/spiralSystem-1.png` and asserts the frame has a visible spiral structure (not a uniform glow, not a random scatter).
2. **M13.2 gate:** Manual visual check that all 6 styles render distinctly different patterns at the default settings.
3. **M13.3 gate:** Playwright clicks each of the 6 style buttons, asserts the style ID in the data texture changes; clicks each slider, asserts the corresponding slot in the data texture changes; clicks Clear, asserts the particle data texture is all zeros.
4. **M13.4 gate:** All 3 golden-image tests green.
5. **M13.5 gate:** Playwright performance test asserts 60 fps average over 5 seconds with 256 particles at 1280×720.
6. **Save/load round-trip:** A scene with 3 Star Field entities (different styles) saves to JSON, loads back, and the rendered output is identical to the pre-save output (pixel diff < 1%).

## 12. Open questions (none)

The design is complete pending only the integration work in §10. No further design questions; the math is decorative and the controls are user-tested in the God Panel.

## 13. What was deleted (transparency)

This feature was originally drafted as a physics-accurate satellite propagation system (5 physics regimes, real G, μ, J2 constants, Lyapunov time analysis). The user clarified they want a toybox, not a universe. The physics analysis is preserved at `docs/plans/2026-08-25-starlink-physics-grounding.md` as a record of the wrong-direction research, but it is **not a design input** for this feature. The user is right: a physics-accurate model would have been slower to build, harder to test, and visually less interesting than a 6-style toybox.
