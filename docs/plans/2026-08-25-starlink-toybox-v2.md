# Starlink Feature v2 — Toybox, not Universe

> Re-grounded after user clarification, 2026-08-25
> Framing: "we're not creating a universe, we're creating a toybox that looks like a universe"
> Previous grounding (`2026-08-25-starlink-physics-grounding.md`) is **superseded** by this document. The 5-regime physics analysis was answering the wrong question.

## What changed

The user's first request mentioned "critically accurate" physics and a 1,000 to 10^14 year range. The second request clarified: **star systems do not have to be accurate, particles playing as stars do not have to be accurate, they just have to be constant and manipulable.**

That is a different success criterion. The new goal is not "compute the real trajectory" but "give the user a system of dots that look like stars, move in patterns that look like orbits, and respond to controls." The math is a *visual* generator, not a *physical* one.

This document is the new ground truth. The earlier physics-regime analysis is preserved in the prior file as a record of the wrong-direction research, not as a design source.

## What "constant" means here

Three things must be **stable across runs** unless the user changes them:

1. **Per-star speed and position** for a given set of user inputs. If the user sets the same spawn point + direction + time-scale, the trajectory must look identical frame-to-frame and run-to-run. This is the existing `?seed=42&t=0` mechanism from the F's-Toybox plan — it carries forward unchanged.
2. **The mathematical relationship** between controls and motion. If the user turns a speed slider, every star in the system responds by the same factor. The motion is governed by a single, shared parametric rule, not by per-star random drift.
3. **The visual style** of the trajectory. A "spiral galaxy look" stays a spiral galaxy look across zoom and time changes; a "comet trail" stays a comet trail. The shader's "personality" is a constant.

## What "manipulable" means here

The user can, from the existing God Panel, change these things without restarting:

- **Spawn point** — where new trajectories originate (UV-space, matches existing entity model)
- **Direction** — initial heading, in degrees
- **Speed multiplier** — global time scale for the system
- **Spawn rate** — how many new stars per second appear at the spawn point
- **Trail length** — how many past positions each star renders as a fading streak
- **Particle count** — total stars in the system
- **Star system style** — 4-6 preset "looks" (spiral, cluster, ring, scatter, double-spiral, fountain). The user picks one; the system generates the matching motion pattern.

These are slider + button controls, integrated into the existing God Panel as a 9th entity kind. No new tooling.

## What the math actually has to be

A "toybox that looks like a universe" needs three families of motion, and **all three are 2020-era shader-art techniques**, not 2020-era orbital mechanics:

### Family 1: Spiral galaxy (logarithmic spiral)
For each particle at angle `θ`, radius is `r(θ) = a × exp(b × θ)`. The constants `a` and `b` are user-tunable, not derived from physics. Each star's `θ` advances at a rate that depends on radius (`ω(r) = k / r` for differential rotation, or `ω = const` for rigid rotation). This is the same parameterization the reference's `renderCosmos` uses (lines 252-256 of `docs/concept/index.html`); the toybox reuses it.

### Family 2: Orbital ring (Kepler-ish)
Each star has a fixed elliptical orbit around a center. `x = cx + a × cos(ωt + φ)`, `y = cy + b × sin(ωt + φ)`. The ellipse axes `a, b` and the per-star phase `φ` are randomized at spawn with the user-supplied seed. `ω` is a function of the ellipse's mean radius (`ω = k / r^(3/2)` for Kepler-like motion, `ω = const` for rigid rotation). The toybox uses the **Kepler-like** form because it looks right; the constant `k` is not a real gravitational parameter.

### Family 3: Scatter / cluster / fountain
Each star has a position offset from a center, plus a slow drift vector. The drift is a low-frequency Perlin or sine-based pseudo-random vector. Clusters: stars stay near the center. Scatter: stars spread outward. Fountain: stars rise from a base, peak, and fall back, fading. These are visual modes, not orbital regimes.

## The shader

The shader is a new GLSL function `renderHypotheticalSat()` that the existing main() loop calls once per pixel, walking the data texture as it already does for the 8 existing entity kinds. The function takes the current pixel's UV, the time, the system style ID, the spawn point, the direction, the speed multiplier, and a per-particle data texture (a small RGBA32F texture with 1 row per particle, holding the particle's initial state and per-particle parameters).

The shader work is **mechanical**, not novel. The novel work is:
1. The 4-6 preset "looks" (the system style enum)
2. The per-particle data texture layout (16 floats per particle: position, velocity, age, color, phase, style-specific params)
3. The God Panel integration (the 7 new sliders/buttons)
4. The acceptance test (the visual-diff specs from `2026-08-25-fs-toybox-golden-specs.md` need 3 new entries: spiralSystem, ringSystem, scatterSystem)

## What I will NOT do

- **No physics regimes.** The 5-regime analysis is deleted as a design input. The toybox has one regime: parametric motion.
- **No real constants.** `μ`, `G`, `J2` are not used. The math is just trig, exponentials, and a per-particle noise lookup. Anything that pretends to be physics is removed.
- **No 10^14 years.** The time-scale slider in the toybox controls *animation speed*, not *simulated years*. A 10^14 setting would just mean "very slow motion." If the user wants to see a 10^14-year timescale dramatized, that's a future feature; the toybox v1 has no timescale concept at all.
- **No physics-accuracy tests.** The acceptance tests are *visual* (the star moves in a spiral; the ring stays a ring; the scatter is non-uniform). They are NOT "the radius matches the Kepler formula to 1%."

## The 6 system styles (v1)

1. **Spiral galaxy** — logarithmic spiral, 2-4 arms, differential rotation. The reference's look, lifted wholesale.
2. **Oval cluster** — elliptical orbits around a center, Kepler-like speed profile. Looks like a globular cluster or a planetary system.
3. **Ring** — single tight ring, all particles on the same orbit. Looks like Saturn's rings.
4. **Scatter** — particles drift slowly in random directions from a center, fade over time. Looks like a nebula or dust cloud.
5. **Double spiral** — two counter-rotating logarithmic spirals, like a colliding galaxy. Visual sugar.
6. **Fountain** — particles rise from a base, peak, and fall back; rendered as a vertical streak. Looks like a geyser or solar prominence.

These are 6 buttons in the God Panel, mutually exclusive (the user picks one). The shader branches on the style ID.

## Integration into the existing plan

The F's-Toybox plan already supports a 9th entity kind trivially — the data texture has 64 rows, only 8 are used. The new entity kind is `hypotheticalSat` (KIND_GPU = 9). The new motion/render slot layout:

| Slot | x | y | z | w |
|---|---|---|---|---|
| vec4[0] | 9 (KIND_GPU) | pos.x (current) | pos.y (current) | age (seconds since spawn) |
| vec4[1] | h/360 | s | b | scale |
| vec4[2] | spawn x | spawn y | direction (rad) | speed multiplier |
| vec4[3] | style (0-5) | phase (rad) | radius / orbit param | period / freq |

The shader reads the style ID, branches to one of the 6 motion functions, computes the particle's position at the current time, and renders a small dot + fading trail at that position.

The data texture gets a **second** binding for per-particle initial-state data (16 floats per particle × 256 particles max). This is a separate `sampler2D` from the existing entity data texture. The packer fills it from the same JS-side scene state.

The God Panel gets a new section "Hypothetical Stars" with:
- 6 style buttons (one per preset)
- Spawn point X / Y sliders
- Direction slider (0-360°)
- Speed multiplier slider
- Spawn rate slider (particles per second)
- Trail length slider
- Particle count slider
- A "Clear" button to wipe all particles

The acceptance tests are 3 new visual-diff specs (spiralSystem, ringSystem, scatterSystem) added to `2026-08-25-fs-toybox-golden-specs.md`. The new tests check **structural visual properties** (a spiral forms a spiral, a ring forms a ring, scatter is non-uniform), not physics accuracy.

## Implementation slice (what I'd plan if you green-light)

A new milestone M13 in the F's-Toybox plan: "Hypothetical Stars toybox." Roughly:

- **M13.1** — Add `hypotheticalSat` to the kind enum + scene.js; add the per-particle data texture and packer; the shader boots and renders one style (spiral) as 64 white dots in the spiral pattern.
- **M13.2** — Add the remaining 5 styles (oval, ring, scatter, double spiral, fountain) as branch points in the shader.
- **M13.3** — God Panel integration: 6 style buttons, 5 sliders, 1 clear button.
- **M13.4** — Add the 3 golden-image specs and Playwright tests for spiralSystem, ringSystem, scatterSystem.
- **M13.5** — Performance check: 256 particles × 60 fps on a typical Linux wallpaper (Intel UHD or similar). If the loop is too slow, fall back to a smaller particle count or instanced rendering (not in v1).

Estimated 5-7 hours of implementation + test, given the existing plan's structure is already in place.

## The single open question

**Is "hypotheticalSat" the right name?** Other options:
- `toybox` (matches your framing literally)
- `particles` (generic; might conflict with WebGL terminology)
- `field` (more poetic; "star field" is the natural reading)
- `simulation` (overpromises; sounds physics-y)
- `dots` (honest; user-facing in the God Panel would be "Dots" or "Particles")

My recommendation: **`field`**, with the God Panel label reading "Star Field" and the 6 styles as buttons like "Spiral," "Oval," "Ring," etc. The "hypothetical" in the entity name is internal; the user sees "Star Field" and thinks "I have a star field that does what I tell it to."

Tell me the name (or accept `field`), and I'll write the v1 design doc and the milestone addition to the plan.
