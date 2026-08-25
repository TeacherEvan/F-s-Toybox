# F's-Toybox

A WebGL2 browser-rendered animated desktop wallpaper with a master God Panel that controls per-element motion, save/load to `scene.json`, and nine entity kinds (galaxy, planet, moon, shooting star, black hole, ring, nebula, comet, star field) — all on a per-element scene graph. Designed for Linux desktops via xwinwrap, KDE Plasma 6, or Hyprland/Sway.

## Status

**Planning phase complete. No code written yet.**

This repository currently holds the design docs, the implementation plan, and the historical reference. The first implementation milestone (M1 — repo skeleton + Vitest harness) is the next step.

## Layout

```
.
├── docs/
│   ├── concept/                                          ← historical reference (Cosmic Penguin v3)
│   │   ├── concept.txt                                   ← the original brief
│   │   └── index.html                                    ← the WebGL2 reference shader
│   └── plans/                                            ← design + implementation plan
│       ├── 2026-08-25-fs-toybox-design.md                ← design doc (data model, shaders, God Panel)
│       ├── 2026-08-25-fs-toybox.md                       ← 13-milestone task plan
│       ├── 2026-08-25-fs-toybox-golden-specs.md          ← 12 visual-diff acceptance specs
│       ├── 2026-08-25-star-field-design.md               ← M13 design source
│       ├── 2026-08-25-starlink-research.md               ← Starlink API investigation
│       ├── 2026-08-25-starlink-toybox-v2.md              ← v1 → v2 reframe (toybox, not physics)
│       └── 2026-08-25-starlink-physics-grounding.md      ← wrong-direction research, kept as record
└── .gitignore
```

## Reading order

1. **`docs/plans/2026-08-25-fs-toybox-design.md`** — the design. Read this first.
2. **`docs/plans/2026-08-25-fs-toybox.md`** — the 13-milestone task plan. TDD-framed, every task has a GATE.
3. **`docs/plans/2026-08-25-fs-toybox-golden-specs.md`** — the 12 visual-diff acceptance specs. Each spec catches specific stub strategies.
4. **`docs/plans/2026-08-25-star-field-design.md`** — the M13 (Star Field) design. The "toybox" framing for the new entity kind.
5. **`docs/concept/index.html`** — the historical WebGL2 reference. The fragment-shader pipeline is carried forward unchanged (minus the penguin).
6. **`docs/concept/concept.txt`** — the original brief, verbatim.

## Tech stack

- **Render:** WebGL2 fragment shader, single `index.html`, no build step.
- **Tests:** Vitest (JS units) + Playwright (E2E + visual diff).
- **Save format:** `scene.json` (download + autosave in localStorage).
- **Linux wallpaper:** xwinwrap + Firefox/Chromium kiosk (X11), `plasma6-wallpapers-webengine` (KDE 6), Chromium `--window-type=desktop` (Hyprland/Sway). Documented in M11 of the plan.

## License

To be decided. The reference WebGL2 pipeline is taken from `docs/concept/index.html`; the original brief did not specify a license. Suggest MIT for the new code, with attribution to the reference where the shader code is carried forward.
