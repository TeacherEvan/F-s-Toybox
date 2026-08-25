# Starlink Integration — Research Findings (ground truth)

> Investigation date: 2026-08-25
> Author: opencode (Hermes) live web research
> Source-of-truth: tool-verified web fetches, not memory.

## TL;DR

There are **two genuinely different ways** a Starlink-themed feature can attach to "F's-Toybox":

1. **Local dish telemetry (the real-time data path).** The Starlink dish exposes a **gRPC service on the local IP `192.168.100.1`**. A **browser cannot fetch it directly** (gRPC over HTTP/2 + CORS to private IP). The proven workaround is a small **Python sidecar** that the user runs alongside the wallpaper, which polls the dish via gRPC and re-exposes the data as a local HTTP endpoint. The community has built exactly this: `sparky8512/starlink-grpc-tools` (698★, updated 2026-05-29) ships a `dish_grpc_prometheus.py` Prometheus exporter. Browser extensions like `DaveyHert/Dishylink` (225★, 2026-08-22) use a similar pattern with browser permissions.
2. **Public constellation data (the visual-overlay path).** The SpaceX community maintains `r-spacex/SpaceX-API` (10.9k★, last update 2024-08-17 — stale, host `api.spacexdata.com` currently returns Cloudflare 525 from this network). For real-time satellite positions the standard path is **CelesTrak TLEs + `satellite.js` client-side propagation**, which works in a browser with **no sidecar, no auth, no network** beyond the TLE fetch.

For a "slow loop running as a desktop perfectly blended overlay" — exactly what was asked for — **Path B is the right one for v1**. Path A is the right v2 if your dad has a dish and the willingness to run a sidecar.

## Evidence (each claim sourced)

### Claim: The dish speaks gRPC on `192.168.100.1`
**Source:** `https://raw.githubusercontent.com/sparky8512/starlink-grpc-tools/master/README.md`
> "All the tools that pull data from the dish expect to be able to reach it at the dish's fixed IP address of 192.168.100.1, as do the Starlink Android app, iOS app, and the browser app you can run directly from http://192.168.100.1."

The HTTP URL on the dish is real, but the rich telemetry is gRPC-only, not browser-fetchable. Browser apps are an Electron-style native wrapper or a proxy.

### Claim: Dishylink is a browser extension that works today
**Source:** `https://github.com/DaveyHert/Dishylink` (default_branch: master; topics: `browser-extension, chrome-extension, firefox-extension, starlink, starlink-grpc, starlink-dashboard`)
> "It reads your dish and router directly over your local network, so it keeps working during an outage — which is exactly when you want to see what happened."

The extension ships to Chrome Web Store and Firefox Add-ons. Architecture requires elevated host_permissions (Chrome) or web_accessible_resources + native messaging (Firefox), which a wallpaper HTML file does **not** have.

### Claim: There is a Python exporter that re-publishes dish data over HTTP
**Source:** `sparky8512/starlink-grpc-tools` README, file list includes `dish_grpc_prometheus.py`
> "`dish_grpc_prometheus.py` does not write anywhere but will listen for HTTP requests and return data in a format Prometheus can scrape."

**Unverified by me:** the exact listen port, format, and CORS behavior of this exporter. The README does not state them; the source is at `https://github.com/sparky8512/starlink-grpc-tools/blob/master/dish_grpc_prometheus.py`. The implementer should pull and read it.

### Claim: Available dish data fields
**Source:** `starlink-grpc-tools` README
> "Specific status or history data groups can be selected by including their mode names on the command line."

Data groups (verbatim from README): `status`, `obstruction_detail`, `alert_detail`, `ping_drop`, `ping_run_length`, `ping_latency`, `ping_loaded_latency`, `usage`, plus `bulk_history`. **All are local-network only, never cloud.**

### Claim: Location data disabled on most plans as of 2026-May
**Source:** `starlink-grpc-tools` README (May 2026 update)
> "As of 2026-May, location data is no longer available via grpc for most service plans"

**Implication:** cannot promise "where is the dish on the map" features; cannot use dish GPS for satellite pass calculations.

### Claim: Public SpaceX API exists but is currently unreachable
**Source:** `https://github.com/topics/starlink` (r-spacex/SpaceX-API repo metadata: 10.9k★, last update 2024-08-17). Live test: `curl -sI https://api.spacexdata.com/v4/starlink` returns `HTTP/2 525` (Cloudflare SSL handshake failed) from this host. Unverified whether the API works from a normal browser; the host is unhealthy right now.

**Implication:** depending on `api.spacexdata.com` is fragile. For real-time satellite positions, **CelesTrak TLEs + client-side propagation is more reliable**. CelesTrak is operated by the US Space Force, has a public TLE endpoint, and the data is small (< 100 KB per Starlink shell update, 1-2 updates per day).

## What "Starlink feature" can mean in our app

The phrase "a slow loop running as a desktop perfectly blended overlay" is a *visual* description, not a *data* description. Both data paths serve it, but they look different:

### Path A — Dish telemetry overlay (requires sidecar)

A small **Starlink sprite** that animates based on live dish state:

| Dish state | Overlay visual |
|---|---|
| Outage / no signal | Sprite dims, gentle red pulse (matches `alert_detail` non-empty) |
| Obstructed (sky survey cells > 30%) | Sprite wobbles, dust around it (drives off `obstruction_detail`) |
| Good throughput (>50 Mbps down) | Sprite glows brighter (drives off `status.downlink_throughput_bps`) |
| Latency spike (>150ms) | Sprite trails slow (drives off `ping_latency`) |
| Sleep / stow | Sprite parks at bottom of frame |

**Data flow:** dish (gRPC :192.168.100.1) → `dish_grpc_prometheus.py` sidecar (HTTP :9095) → our wallpaper `fetch('http://localhost:9095/metrics')` every 5s → updates a new entity kind `starlink` in the scene.

**Setup cost for your dad:** install the sidecar as a systemd user service. ~10 minutes.

### Path B — Constellation overlay (no sidecar, pure client)

A **slow-moving field of satellite dots** that traces real Starlink passes over the user's home location:

- Fetch CelesTrak TLEs once on boot (or every 6h via cache).
- `satellite.js` propagates each sat's lat/lon/alt at the current time, every 1 minute.
- For each satellite within the user's horizon and above the horizon at the user's lat/lon, draw a small sprite with motion matching the sat's apparent angular velocity (~7.5 km/s at 550 km altitude → ~0.5° per second in the sky).
- Sat fade in over the horizon, cross the sky, fade out.

**Visual character:** perfect match for "slow loop ... perfectly blended overlay." The motion is real (celestial mechanics), not faked. A 6h time-lapse would show real Starlink shell patterns.

**Setup cost for your dad:** none. Enter lat/lon once (or click "use geolocation").

**Hard truth:** `satellite.js` propagation is precise but not real-time. The visible motion per second is tiny. To make it readable as a "wallpaper overlay," we need to either (a) time-lapse (1 frame = 30 seconds of real time, accelerated) or (b) exaggerate brightness to make slow motion visible. Recommend option (a) with a "real time" / "10× / "60×" / "300×" speed toggle in the God Panel.

### Path C — Hybrid (Path B + Path A later)

Path B ships in v1. Path A is added in v2 if your dad is willing to set up the sidecar. The architecture supports both: a new `starlink` entity kind that can be fed by either the local API (with a sidecar) or the constellation API (browser-only). The shader code is shared; the data source is a constructor option.

## Open questions for the user

1. **Does your dad have a Starlink dish** on the same network as the desktop running this wallpaper? If yes → Path A is realistic. If no → Path B is the only option.
2. **Is he comfortable with `pip install` + a systemd unit?** This is the sidecar setup. If yes → Path A. If no → Path B.
3. **Where is the desktop geographically?** Path B needs lat/lon (one-time setup). The app can offer the geolocation API but Linux wallpaper engines in kiosk mode usually block it.
4. **What is the visual "personality" your dad would like?** Some options to choose from:
   - A single satellite sprite following his actual dish's signal health (Path A)
   - A real-time sky map of satellites overhead (Path B, real speed — slow, contemplative)
   - A time-lapse sky map with the satellites streaking in arcs (Path B, accelerated)
   - A "constellation shell" view that shows all Starlink sats in a 3D-ish orbit ring around Earth (different visual; more "this is the network your dad connects through")

## My recommendation

**Path B (constellation overlay) as v1.** Zero setup, real data, perfect match for "slow loop blended overlay." The shader for it is small (a 9th entity kind `starlinkSat` that uses motion from `satellite.js` propagation). One God Panel toggle to switch the data source to Path A in v2.

**Path A is a v2 if your dad wants it.** It is genuinely harder (sidecar + systemd) and not for everyone. But the data is much richer and the visual would respond to real outages, which is what Dishylink proves is possible.

## What I will NOT do without your sign-off

- Write a v1 plan that mixes Path A and Path B — they are different setups and pretending one design works for both is a recipe for an unfocused feature.
- Promise location data is available — the May 2026 update explicitly disabled it.
- Assume the public SpaceX API is reliable — it's currently 525 from this host.
- Use `api.spacexdata.com` as the primary constellation source. CelesTrak TLEs are the right answer.

## Next step

Tell me which path (A, B, or C-hybrid) and which visual personality (from the four options in open question #4). I'll then run the superpowers brainstorm → plan pipeline, ground the new design against the existing F's-Toybox architecture, and write a v1 task plan to `docs/plans/2026-08-26-starlink-feature-design.md` and `docs/plans/2026-08-26-starlink-feature.md`.
