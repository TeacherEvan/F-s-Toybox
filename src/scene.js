// F's-Toybox scene model — M2.
export const ENTITY_KINDS = ['galaxy','planet','moon','ring','shootingStar','blackHole','nebula','comet'];

// The order in the array is significant: it's the order in which
// +Add buttons appear in the God Panel toolbar (M3.1). Keep stable.

// GLSL-side kind enum (design §3.1). Kind 0 is reserved for "unused slot";
// the packer sign-encodes visibility into the same int (negative = hidden).
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
};

const DEFAULTS = {
  galaxy:        { motion: { spin: 0.4, pulse: 0.2, wobble: 0.0 },
                   render: { armCount: 2, armSharp: 0.7, coreSize: 0.5,
                             coreBright: 1.5, dust: 0.6 } },
  planet:        { motion: { spin: 0.5, wobble: 0.0, tilt: 0.0, bandingSpeed: 0.3 },
                   render: { radius: 0.08, banding: 0.4, atmosphere: 0.0 } },
  moon:          { motion: { spin: 0.3, wobble: 0.0, libration: 0.0 },
                   render: { radius: 0.04, craterDensity: 0.5, albedo: 0.7 } },
  shootingStar:  { motion: { vx: 0.4, vy: 0.2, lifetime: 3.0 },
                   render: { length: 0.3, thickness: 0.005, brightness: 1.5, trailFade: 0.8 } },
  blackHole:     { motion: { spin: 0.3, accretionSpeed: 0.6, lensingPulse: 0.0 },
                   render: { schwarzschildRadius: 0.05, accretionRadius: 0.12,
                             jetReach: 0.32, spikeSharpness: 280 } },
  ring:          { motion: {}, // inherits parent
                   render: { innerRadius: 0.12, outerRadius: 0.18, tilt: 0.3,
                             opacity: 0.6, banding: 0.4 } },
  nebula:        { motion: { drift: 0.02, turbulence: 0.4 },
                   render: { radius: 0.25, density: 0.6, softness: 0.7 } },
  comet:         { motion: { orbitRadius: 0.4, orbitSpeed: 0.3, orbitPhase: 0, tailWobble: 0.05 },
                   render: { nucleusRadius: 0.02, tailLength: 0.15, tailWidth: 0.02, tailFade: 0.7 } },
};

let _idCounter = 0;
function uuid() {
  // RFC 4122 v4 uuid. Crypto.randomUUID is available in Node 22 + modern browsers.
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback (kept for old runtimes): monotonic counter + timestamp.
  _idCounter++;
  return `ent-${Date.now().toString(36)}-${_idCounter.toString(36)}`;
}

function defaultName(kind) {
  const names = { galaxy: 'Galaxy', planet: 'Planet', moon: 'Moon',
                  shootingStar: 'Shooting Star', blackHole: 'Black Hole',
                  ring: 'Ring', nebula: 'Nebula', comet: 'Comet' };
  return names[kind];
}

export function createEntity(kind) {
  if (!ENTITY_KINDS.includes(kind)) throw new Error(`Unknown kind: ${kind}`);
  return {
    id: uuid(),
    kind,
    name: defaultName(kind),
    visible: true,
    position: { x: 0, y: 0 },
    orbit: { enabled: false, parentId: null, radius: 0.2, speed: 0.4, phase: 0 },
    scale: 1,
    rotation: 0,
    color: { h: 200, s: 0.6, b: 0.85 },
    motion: { ...DEFAULTS[kind].motion },
    render: { ...DEFAULTS[kind].render },
  };
}

export class Scene {
  constructor() {
    this.entities = [];
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.globalMotion = { paused: false, timeScale: 1 };
    this.background = { enabled: true, spiralSpeed: 0.8, starDensity: 1 };
    this.schemaVersion = 1;
  }
  addEntity(e) { this.entities.push(e); return e; }
  removeEntity(id) { this.entities = this.entities.filter(e => e.id !== id); }
  updateEntity(id, patch) {
    const e = this.entities.find(e => e.id === id);
    if (!e) return false;
    Object.assign(e, patch);
    return true;
  }
}

export function serialize(scene) {
  return JSON.stringify(scene, null, 2);
}

export function deserialize(str) {
  let s;
  try {
    s = JSON.parse(str);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }
  validateScene(s);
  return s;
}

export function validateScene(s, opts = {}) {
  if (!s || typeof s !== 'object') throw new Error('validateScene: scene must be an object');
  if (s.schemaVersion !== 1) throw new Error(`Unsupported schemaVersion: ${s.schemaVersion} (expected 1)`);
  if (!Array.isArray(s.entities)) throw new Error('validateScene: entities must be an array');
  for (const e of s.entities) {
    if (!e || typeof e !== 'object') throw new Error('validateScene: entity must be an object');
    if (!ENTITY_KINDS.includes(e.kind)) throw new Error(`validateScene: unknown kind "${e.kind}"`);
    for (const k of ['id','name','visible','position','orbit','scale','rotation','color','motion','render']) {
      if (!(k in e)) throw new Error(`validateScene: entity missing field "${k}"`);
    }
  }
  if (opts.resolveOrbits) {
    resolveOrbits(s, opts);
  }
  return s;
}

// Walk the orbit graph. For every entity whose orbit is enabled, follow
// parentId links until we hit a non-orbiting entity (the chain root) or
// cycle back to one already visited. Throw on cycle or on chain length
// exceeding maxDepth (default 8 — design §3.3).
export function resolveOrbits(scene, opts = {}) {
  const maxDepth = opts.maxDepth ?? 8;
  const byId = new Map(scene.entities.map(e => [e.id, e]));
  // Re-iterate a few times to find fixed points — but for the M2 tests, a
  // single pass is enough since the chain length is bounded by maxDepth.
  for (const e of scene.entities) {
    if (!e.orbit || !e.orbit.enabled) continue;
    const chain = [e];
    const seen = new Set([e.id]);
    let cur = e;
    while (cur.orbit && cur.orbit.enabled && cur.orbit.parentId != null) {
      const next = byId.get(cur.orbit.parentId);
      if (!next) break; // dangling parentId is allowed at this stage (a real
                       // pack-time concern in M4); resolveOrbits only
                       // rejects cycles and depth overflow.
      if (seen.has(next.id)) {
        const cycle = [...chain, next].map(c => c.name || c.id).join(' → ');
        throw new Error(`Orbit cycle detected: ${cycle}`);
      }
      chain.push(next);
      seen.add(next.id);
      cur = next;
      if (chain.length > maxDepth) {
        const path = chain.map(c => c.name || c.id).join(' → ');
        throw new Error(`Orbit depth > ${maxDepth}: ${path}`);
      }
    }
  }
  return scene;
}
