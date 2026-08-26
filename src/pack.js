// F's-Toybox entity packer (M4) — JS scene state → 64×4 RGBA32F data texture.
// Layout contract (design §5.1, Risk #13): width=64 columns (one per entity),
// height=4 rows (four vec4 slots). A 1-tall texture would return border color
// for rows 2/3/4 — do NOT change back to 64×1.
import { KIND_GPU } from './scene.js';

export const MAX_ENTITIES = 64;
const SLOTS_PER_ENTITY = 4;

// Per-kind named-field → slot map (design §3.5). The shader sees a uniform
// motion:vec4 / render:vec4 regardless of kind; null leaves the slot at 0.
const MOTION_SLOTS = {
  galaxy:        ['spin', 'pulse', 'wobble', null],
  planet:        ['spin', 'wobble', 'tilt', 'bandingSpeed'],
  moon:          ['spin', 'wobble', 'libration', null],
  shootingStar:  ['vx', 'vy', 'lifetime', null],
  blackHole:     ['spin', 'accretionSpeed', 'lensingPulse', null],
  ring:          [null, null, null, null],
  nebula:        ['drift', 'turbulence', null, null],
  comet:         ['orbitSpeed', 'orbitPhase', 'tailWobble', null],
};

const RENDER_SLOTS = {
  galaxy:        ['coreBright', 'dust', 'armSharp', 'coreSize'],
  planet:        ['radius', 'banding', 'atmosphere', null],
  moon:          ['radius', 'craterDensity', 'albedo', null],
  ring:          ['innerRadius', 'outerRadius', 'tilt', 'opacity'],
  shootingStar:  ['length', 'thickness', 'brightness', 'trailFade'],
  blackHole:     ['schwarzschildRadius', 'accretionRadius', 'jetReach', 'spikeSharpness'],
  nebula:        ['radius', 'density', 'softness', null],
  comet:         ['nucleusRadius', 'tailLength', 'tailWidth', 'tailFade'],
};

// JS string kind → GPU int (design §3.1).
const KIND_BY_NAME = {
  galaxy:       KIND_GPU.GALAXY,
  planet:       KIND_GPU.PLANET,
  moon:         KIND_GPU.MOON,
  ring:         KIND_GPU.RING,
  shootingStar: KIND_GPU.SHOOTING_STAR,
  blackHole:    KIND_GPU.BLACK_HOLE,
  nebula:       KIND_GPU.NEBULA,
  comet:        KIND_GPU.COMET,
};

function slotValues(map, kind, obj) {
  const keys = map[kind] || [null, null, null, null];
  return keys.map((k) => (k != null && k in obj ? obj[k] : 0));
}

export function resolveWorldPosition(entity, scene, time) {
  if (!entity.orbit || !entity.orbit.enabled || entity.orbit.parentId == null) {
    return entity.position;
  }
  const parent = scene.entities.find((e) => e.id === entity.orbit.parentId);
  if (!parent) return entity.position; // dangling parent mid-frame: safe fallback
  const parentWorld = resolveWorldPosition(parent, scene, time);
  // Y-up convention: positive speed = counter-clockwise on screen (design §3.3).
  const theta = entity.orbit.phase + time * entity.orbit.speed;
  return {
    x: parentWorld.x + Math.cos(theta) * entity.orbit.radius,
    y: parentWorld.y + Math.sin(theta) * entity.orbit.radius,
  };
}

export function packEntitiesToDataTexture(scene, time) {
  // 64 columns × 4 rows × 4 floats = 1024 floats
  const data = new Float32Array(MAX_ENTITIES * SLOTS_PER_ENTITY * 4);

  for (let i = 0; i < scene.entities.length && i < MAX_ENTITIES; i++) {
    const e = scene.entities[i];
    const world = resolveWorldPosition(e, scene, time);
    const isChainRoot = !e.orbit.enabled || e.orbit.parentId == null;
    const base = i * SLOTS_PER_ENTITY * 4;

    // vec4[0]: kind (sign = visible), pos.x, pos.y, parentSlot-or-rotation
    // Hidden entities are negative-kind so the shader skips them with one
    // branch (`kind <= 0` covers both unused slots and hidden entities).
    data[base + 0] = (e.visible === false ? -1 : 1) * (KIND_BY_NAME[e.kind] ?? 0);
    data[base + 1] = world.x;
    data[base + 2] = world.y;
    data[base + 3] = isChainRoot ? e.rotation : i; // M7 refines child lookup

    // vec4[1]: h/360, s, b, scale (h stored as degrees in JSON; packer divides)
    data[base + 4] = e.color.h / 360;
    data[base + 5] = e.color.s;
    data[base + 6] = e.color.b;
    data[base + 7] = e.scale;

    // vec4[2]: motion.p0..p3 (per-kind, design §3.5)
    const m = slotValues(MOTION_SLOTS, e.kind, e.motion);
    data[base + 8]  = m[0];
    data[base + 9]  = m[1];
    data[base + 10] = m[2];
    data[base + 11] = m[3];

    // vec4[3]: render.r0..r2 (+ r3 for kinds that use all four)
    const r = slotValues(RENDER_SLOTS, e.kind, e.render);
    data[base + 12] = r[0];
    data[base + 13] = r[1];
    data[base + 14] = r[2];
    data[base + 15] = r[3];
  }
  return data;
}

export function uploadEntityTexture(gl, tex, data) {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, MAX_ENTITIES, SLOTS_PER_ENTITY, 0,
                gl.RGBA, gl.FLOAT, data);
}
