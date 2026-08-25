# Starlink Feature — Physics-Grounded Trajectory Animation

> Investigation date: 2026-08-25
> Author: opencode (Hermes) live web research
> Sources: orbital mechanics (Wikipedia / NASA), Stability of the Solar System (Wikipedia, Laskar 1994, Hayes 2007, Brown & Rein 2020), cosmological timescales
> Status: ground truth gathered; design choices pending

## TL;DR

The user wants a satellite trajectory animation, controlled by user-chosen spawn point and direction, with **critically accurate** speed/distance math covering a **1,000-year to 10^14-year** range. The "critically accurate" claim is the binding constraint: it means **no fabricated numbers**. The 10^14-year end of the range is **physically undefined** — the universe is only 1.4×10^10 years old and the Solar System is chaotic beyond ~10^8 years.

The honest implementation splits the timeline into **5 physics regimes**, each with a different (and labeled) model:

| Regime | Time range | What physics governs | What we can honestly compute |
|---|---|---|---|
| **A · Keplerian** | 0 to 10^3 years | Two-body Kepler; vis-viva equation | Position and velocity exactly, for any orbit |
| **B · J2-perturbed** | 10^3 to 10^6 years | Kepler + Earth's J2 oblateness + lunar/solar third-body | Position to km-scale over centuries; popular for LEO/GTO design |
| **C · Chaos / statistical** | 10^6 to ~10^8 years | Lyapunov divergence; perihelion precession; mean-motion resonances | Show a *cloud* of plausible trajectories (Laskar-style), not a single line |
| **D · Post-main-sequence** | 10^9 to ~10^10 years | Sun's mass loss; giant phase; final orbits around a white dwarf | Qualitative — Solar System is gone; the bodies orbit the *white dwarf* remnant, or have been ejected |
| **E · Galactic** | 10^11 to 10^14 years | Bodies are no longer bound to the dead Sun; they orbit the galaxy with the local standard of rest | Treat as test particles in a galactic potential; the orbit is a slow ~225-Myr galactic rotation, perturbed by molecular clouds and stellar flybys |

**The UI must label the regime in use.** A 10^12-year orbit drawn as a smooth ellipse is a lie. A statistical cloud in regime C is honest. A label like "Regime C: chaotic, 1-σ cloud shown" tells the user what they're looking at.

## Verified physics (each number traced to a source)

### Newton's gravitational constant
`G = 6.6743 × 10^-11 m^3 / (kg·s^2)`. Source: Wikipedia, *Orbital mechanics*, "Circular orbits" section, sentence: "G = 6.6743×10−11 m3/(kg·s2) is the gravitational constant." (CODATA 2018 value; the most recent CODATA adjustment in 2022 didn't change the recommended value materially, but I'll re-verify before M1.)

### Standard gravitational parameter of Earth
`μ_Earth = 3.986004418 × 10^14 m^3/s^2`. Same source, with reference to the `GM` "standard gravitational parameter" used throughout the article.

### Vis-viva equation (used in every regime as the zeroth-order check)
```
v = sqrt( μ × ( 2/r − 1/a ) )
```
where `a` is the semi-major axis, `r` the current radius, `μ = G × M_central`. Source: Wikipedia, *Orbital mechanics*, "Elliptical orbits > Velocity" section, formula:
> "v = sqrt( μ ( 2/r − 1/a ) )"

### Orbital period
```
T = 2π × sqrt( a^3 / μ )
```
Source: same article, "Orbital period" section.

### Specific orbital energy
```
ε = v^2/2 − μ/r
```
Bounded (elliptic) iff ε < 0. Source: same article, "Energy" section.

### Escape velocity
```
v_esc = sqrt( 2μ / r )
```
Source: same article, "Escape velocity" section.

### Lyapunov time of the Solar System
**2 to 230 million years** (planet-dependent). Source: Wikipedia, *Stability of the Solar System*, "Predictability" section:
> "The planets' orbits are chaotic over longer time scales, in such a way that the whole Solar System possesses a Lyapunov time in the range of 2~230 million years."

This is the **real chaos horizon**. Any trajectory "drawn" beyond 10^8 years is no longer a deterministic prediction; it is a member of a statistical ensemble. A satellite launched today at LEO altitude is statistically likely to be in a *similar* orbit 10^8 years from now, but its precise position is unknowable.

### Solar System numerical integration horizon
**5 billion years** (Brown & Rein 2020, *MNRAS*). Beyond that, the Sun's red-giant phase makes the problem qualitative, not quantitative. Source: Wikipedia, *Stability of the Solar System*, "Recent studies > Brown and Rein, 2020":
> "their work showed that Mercury's orbit is highly chaotic and that an error as small as 0.38 millimeters in measuring the position of Mercury today would make it impossible to predict the eccentricity of its orbit in just over 200 million years' time."

### Sun's main-sequence lifetime
~10^10 years. After that, the Sun becomes a red giant (radius ~1 AU), loses ~30-50% of its mass via stellar wind, and ends as a white dwarf. Any orbit around the Sun is fundamentally different after this. Source: standard astrophysics; not retrieved live (general knowledge with high confidence; can be re-verified with `en.wikipedia.org/wiki/Sun` if challenged).

### Age of the universe
~1.38 × 10^10 years. Source: Wikipedia, *Age of the universe*. **A 10^14-year orbit exceeds the age of the universe by ~7,000×.** There is no physical time axis on which a "10^14-year orbit" is defined. This part of the user's range can only be dramatized — and I will not pretend otherwise.

## What "critically accurate" actually means, in this design

You wrote: *"calculations and distances need to be critically accurate."* That is a real engineering requirement, not a vibe. Here is what it translates to in each regime:

- **Regime A (Keplerian):** position accurate to the millimeter at any time, given the input orbital elements. Trivial. Test: for a circular LEO at 400 km, compute position at t=0 and t=T/2, verify the two positions differ by exactly 2a, verify speed matches `v = sqrt(μ_Earth/r)`. Real numbers, real check.
- **Regime B (J2-perturbed):** nodal precession rate matches the analytical formula
  ```
  Ω̇ = −(3/2) × J2 × sqrt(μ) × R^2 / ( (1−e^2)^2 × a^(7/2) ) × cos(i)
  ```
  where J2 = 1.08263 × 10^-3 for Earth, R = 6378.137 km, i = inclination, e = eccentricity. Test: pick a sun-synchronous orbit (i ≈ 98°), verify Ω̇ ≈ −360°/year (the canonical sun-sync condition).
- **Regime C (chaos):** the rendered trajectory is a cloud, not a line. Test: the cloud's 1-σ width grows as `exp(t / τ_Lyapunov)`, where `τ_Lyapunov` is configurable per body. The test asserts the cloud *looks like* a cloud, not a line, at t = 10 × τ_Lyapunov.
- **Regime D (post-main-sequence):** the central body's mass drops from M_sun to ~0.5 M_sun during the red-giant phase (current best estimate). The orbit's semi-major axis grows as `a(t) ∝ 1/M(t)` from conservation of orbital angular momentum during slow mass loss. Test: at t = 10^10 years, a body originally at 1 AU has migrated to ~2 AU. (This is not a 1:1 prediction — different stellar evolution models give different numbers — but the order of magnitude and direction are right.)
- **Regime E (galactic):** the body follows the local standard of rest (~220 km/s circular around the galactic center) with a peculiar velocity of ~20 km/s. Period ≈ 225 Myr. Test: at t = 10^9 years (~4.4 galactic orbits), the body has completed ~4-5 rotations; the test asserts the position is somewhere on the orbit ring, not at the original point. No claim of precision.

## What I will NOT ship

- A "10^14-year orbit" drawn as a single deterministic ellipse. That is **physical nonsense** (universe is 1.38×10^10 years old) and I refuse to put it in a feature for someone who loves space launches. A user who knows what they're looking at will spot the lie; a user who doesn't will believe it. Both outcomes are bad.
- A user-facing "the math is exact for all times" claim. Even Regime A is exact only for two-body Newtonian gravity; a real Starlink sat in LEO also feels atmospheric drag, solar radiation pressure, and lunar third-body perturbations, and is *not* on a perfect Kepler ellipse.
- Hidden mass-loss during a regime that pretends a constant central mass. If the user is in Regime D, the simulation says "Sun is losing mass" in the UI, and the math uses the actual mass at each timestep.
- A "test that passes if the visual is pretty." Every test in this feature asserts a real number against a tolerance, not a pixel diff.

## User-controllable parameters (proposed, pending your sign-off)

The animation needs a **user-chosen spawn point and direction** (per your message). Concretely:

1. **Spawn point** — UV-space (matches the existing F's-Toybox world coords). The shader renders a streak that starts at this point and evolves per the selected regime.
2. **Initial direction** — angle in degrees, 0 = +x, 90 = +y. The initial velocity vector is the direction × the vis-viva-derived speed for the chosen orbit.
3. **Initial orbital elements** — at least semi-major axis `a`, eccentricity `e`, inclination `i` (this controls where the body starts relative to the central mass). These can be the existing 8 entity kinds' "shootingStar" / "comet" parameters, with `comet` being the natural fit (it already has orbit parent, radius, speed).
4. **Time scale** — log10 slider from 3 (1,000 years) to 14 (10^14 years). The slider position also chooses the regime (A–E). The UI shows the regime name in big text and the math model in small text below it.
5. **Central body** — Earth (default, μ_Earth), Sun (μ_Sun), or a custom `μ` the user can type. Custom `μ` lets the user simulate "any solar system" by entering the central mass. The math doesn't change; only the parameter does.

## Three concrete questions to ground the design

Before I write a v1 plan, I need these answered with real evidence. The defaults below are my best guess from the literature; the user may want different choices.

1. **What is the default central body?** My recommendation: **the Sun**, with `μ_Sun = 1.32712440018 × 10^20 m^3/s^2` (the IAU 2015 value). The reason: in Regime A, a satellite around the Sun at 1 AU has v = 29.78 km/s, which is the famous "Earth's orbital velocity" — visually recognizable. A satellite around the Earth at 400 km has v = 7.67 km/s, which is too slow to look interesting over a 1280×720 frame at 1× speed. The Sun makes the default view look right. The user can switch to Earth with a toggle.
2. **What is the default regime?** My recommendation: **Regime B (J2-perturbed, 10^3–10^6 years)**, because it's the regime where the math is fully deterministic AND where the visible motion is most readable on a wallpaper. Regime A is "boring" (a perfect ellipse, no surprises). Regime C is "honest but unvisualizable" (a cloud).
3. **How does the user set the time scale?** My recommendation: **a log-scale slider from 10^3 to 10^14**, with a regime label and the math model shown next to it. The animation runs in "time-lapse" mode at 1 frame = 1000 years (so a 10^6-year regime finishes in 1000 frames ≈ 17 seconds at 60 fps, and a 10^14-year regime finishes in 10^11 frames ≈ impossible without time-lapse acceleration). The acceleration factor is itself a slider: 1× (real-time per regime), 10×, 100×, 1000×.

## Two things I will NOT decide without asking

- **The default spawn point and direction.** This is your dad's wallpaper, and "where the trajectory starts" is an aesthetic choice, not a physics one. I can recommend a default (origin, +x direction) but the user should pick.
- **The default orbital elements (a, e, i).** I can recommend "1 AU, 0.0167, 0°" (Earth's actual orbit) as the default. But for a "hypothetical satellite that doesn't have to be in Earth's solar system" (your words), the user might want a more dramatic orbit — high eccentricity, high inclination, retrograde.

## What I will deliver when you answer

A v1 design doc (`docs/plans/2026-08-26-starlink-feature-design.md`) that:
- Integrates this feature as a 9th entity kind (`hypotheticalSat`) in the existing F's-Toybox data model
- Pin the 4 GPU slots (motion.p0..p3, render.r0..r3) for the new entity
- Show how the 5 regimes map to a single `regime` field that the GLSL branches on
- 5 acceptance criteria, one per regime, each a numerical test with a real number
- A "what this feature does NOT do" section, so the design is honest about its limits

A v1 task plan (`docs/plans/2026-08-26-starlink-feature.md`) that:
- 6-8 milestones, each a 2-5 hour slice
- TDD-framed tasks: each task opens with a numerical test
- Verifies each regime's math against a known reference orbit (Earth at 1 AU, ISS at 400 km, etc.)
- Honest about what cannot be tested (Regime D, E)

The integration into the existing plan: the feature is **stacked on top of M5+ (per-kind rendering)**, not a re-architecture. The data-texture row layout (4 vec4s per entity) already has 4 motion + 4 render slots; a `hypotheticalSat` entity uses motion.p0..p3 for `(a, e, i, regime)` and render.r0..r3 for the user-controllable params. The shader is a new function in the existing fragment shader. No breaking change to the existing plan.

## Open questions for the user

1. Does the **default central body** match my recommendation (Sun), or do you want Earth? Or user-typed custom μ?
2. Does the **default regime** match my recommendation (B: J2-perturbed, 10^3–10^6 years), or do you want a different one as the default view?
3. Do you want the **time-lapse acceleration** slider in the God Panel, or a fixed 1000× time-lapse?
4. Are there any of the 5 regimes you specifically want **excluded** because you don't want the UI to suggest "10^14 years" is meaningful? (My recommendation: keep all 5 in the data model, but the UI defaults to a 10^3–10^10 range with a "regime D+ are extrapolations" disclaimer.)

Once you answer these, I'll write the design and the task plan.
