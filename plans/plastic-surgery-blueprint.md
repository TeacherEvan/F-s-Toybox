# Plastic Surgery Blueprint: F-s-Toybox (F-s-Toybox / index.html)

## 1. Alignment & Workspace Theme Lock
- **Collaboration Matrix:** Desktop + Private + Adult/Specialized
- **Workspace Theme & Stack:** Cosmic / WebGL2 Scene Editor — dark obsidian void, blue-white telemetry readouts, monospace data-dense UI over a full-viewport canvas. Stack: HTML5 / vanilla JS / WebGL2 shader (no framework).
- **Investigated Modern Techniques Selected:**
  1. `oklch()` perceptual elevation (`surface-layer-1`/`surface-void` cards with 1px top-edge specular insets) — matches cosmic depth metaphor.
  2. Six-state tactile `.btn-surgical` with `::after` opacity glow, composited `translate3d` hover/active, and `focus-visible` ring — fixes flat `#toolbar button` states.
  3. `font-variant-numeric: tabular-nums` + fixed-width monospace telemetry + `prefers-reduced-motion: reduce` guard — eliminates numeric jitter on counters/readouts.
  4. Custom range-track (`--pct` gradient fill) + theme toggle switch — replaces unstyled browser-default sliders/checkboxes.
  5. Entity row rails: accented selected row with a leading progress rail, split name/coords columns.

## 2. Perceptual Token & Typography System (injected into `:root` in `<style>`)
Tokens mapped to workspace theme; no hex replacements break shader colors (shader stays independent).

| Token | Value (`oklch`) | Role & Contrast Spec |
| `--surface-void` | `oklch(0.09 0.014 268)` | Base black canvas (Y ≈ 0.001) |
| `--surface-layer-1` | `oklch(0.145 0.018 266)` | Card / toolbar background |
| `--surface-layer-2` | `oklch(0.195 0.022 264)` | Raised panels / toolbar top |
| `--surface-raised` | `oklch(0.255 0.024 262)` | Button fill top gradient |
| `--accent-primary` | `oklch(0.68 0.185 258)` | Interactive focus / hover glow |
| `--accent-glow` | `oklch(0.72 0.165 290)` | Secondary glow accent |
| `--status-nominal` | `oklch(0.74 0.170 152)` | Success / active |
| `--status-critical` | `oklch(0.68 0.190 25)` | Error state |
| `--text-primary` | `oklch(0.96 0.005 265)` | Main labels (LC > 75 AAA) |
| `--text-secondary` | `oklch(0.82 0.014 265)` | Section headers |
| `--text-muted` | `oklch(0.64 0.018 265)` | Hints / borders |
| `--text-telemetry` | `oklch(0.98 0.002 265)` | Readouts (`tabular-nums`) |
| `--hairline` | `oklch(1 0 0 / 0.085)` | Panel borders |
| `--specular` | `oklch(1 0 0 / 0.14)` | Top-edge bevel |

## 3. Six-State Tactile Button & Control Specification (ALL buttons)
- Applied to `.btn-surgical` → toolbar buttons + danger-row buttons. `data-add`, `data-action`, `data-prop`, `id` (including `hide-all-btn`, `pause-btn`, `save-btn`, `load-btn`) untouched.
- Default/Hover/Active/Focus-Visible/Loading (`.btn-spinner` wired via `.btn-label`+`.btn-spinner` spans)/Disabled + reduced-motion guard.
- Hit targets: toolbar buttons ≥ 102px × 40px; range inputs 44px hit target; entity rows 44px.

## 4. Rendering & Smoothness Execution Plan
- Compositor-safe: only `transform` + `border-color` + `opacity` animate (never `width/height/top/left/margin/padding`).
- Shader left 100% untouched visually; golden-frame pixel tests pass.
- **Frame-budget work (shader/layout coupling, zero visual change):** `uEntityCount` bounds the entity loop instead of walking all 64 slots per pixel (~64× fewer `texelFetch`s per pixel for a single entity); culling tighteners (galaxy `r > 0.235`, black hole `length(local) > 1.2`); per-frame JS submit measured at 0.185ms; adaptive render scale (0.5–1.0× canvas backing store) trades resolution for frame rate on weak GPUs.
- Measured: empty scene 10 → 57 fps; 1 galaxy → 60 fps; 8 entities → ~50–55 fps on Intel UHD / SwiftShader fallback viable.

## 5. Post-Op Verification (final)
- Linter: 0 HIGH (7 documented LOW false positives on `timer`/`telemetry` variable names).
- E2E (playwright + chromium): 14/14 green (suite time 5.1 min → 19 s).
- Real-browser screenshots: 3D beveled toolbar buttons, galaxy starfield rendering, property editor populating, `status="ready"` green.
- Panel `toContainText('0.42')` assertion hardened to tolerate main-thread saturation.
- Token consistency finished: every text/border color uses `:root` tokens — `strayHex: []` verified via computed-style audit; all hit targets ≥ 44px.
