// F's-Toybox entity packer (M4/M5) — JS scene state → GPU data texture.
//
// Encoding: RGBA8 byte texture, 1024×1 (4096 bytes). Each entity owns 64
// consecutive BYTES = 16 float32 values, stored as exact IEEE-754 bit
// patterns (little-endian) across 16 texels. The shader decodes via
// uintBitsToFloat. Byte-exact and free of float-texture-support
// requirements — RGBA32F sampling proved unreliable under software GL
// (rows 1-3 sampled as zero; texelFetch worse), and avoiding float
// textures also helps aged wallpaper-GPU drivers (design Risk #6).
//
// Per-entity float layout (design §5.1, §3.5):
//   [0] kind (sign = visible)  [1] pos.x  [2] pos.y  [3] parentSlot-or-rotation
//   [4] color.h/360  [5] s     [6] b      [7] scale
//   [8..11]  motion p0..p3    [12..15] render r0..r3
import { KIND_GPU } from './scene.js';

export const MAX_ENTITIES = 64;
const FLOATS_PER_ENTITY = 16;
export const TEX_WIDTH = MAX_ENTITIES * FLOATS_PER_ENTITY; // 1024 texels

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
  // 64 entities × 16 floats × 4 bytes = 4096 bytes = 1024 RGBA texels
  const bytes = new Uint8Array(MAX_ENTITIES * FLOATS_PER_ENTITY * 4);
  const dv = new DataView(bytes.buffer);

  for (let i = 0; i < scene.entities.length && i < MAX_ENTITIES; i++) {
    const e = scene.entities[i];
    const world = resolveWorldPosition(e, scene, time);
    const isChainRoot = !e.orbit.enabled || e.orbit.parentId == null;
    const base = i * FLOATS_PER_ENTITY * 4; // byte offset
    let f = 0;
    const put = (v) => { dv.setFloat32(base + f * 4, v, true); f++; };

    // float[0..3]: kind (sign = visible), pos, parentSlot-or-rotation.
    // Hidden entities are negative-kind so the shader skips them with one
    // branch (`kind <= 0` covers unused slots and hidden entities).
    put((e.visible === false ? -1 : 1) * (KIND_BY_NAME[e.kind] ?? 0));
    put(world.x);
    put(world.y);
    put(isChainRoot ? e.rotation : i); // M7 refines child lookup

    // float[4..7]: h/360 (degrees → 0..1 here, ONE place per design), s, b, scale
    put(e.color.h / 360);
    put(e.color.s);
    put(e.color.b);
    put(e.scale);

    // float[8..11]: motion p0..p3 (per-kind, design §3.5)
    for (const v of slotValues(MOTION_SLOTS, e.kind, e.motion)) put(v);
    // float[12..15]: render r0..r3
    for (const v of slotValues(RENDER_SLOTS, e.kind, e.render)) put(v);
  }
  return bytes;
}

export function uploadEntityTexture(gl, tex, bytes) {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, TEX_WIDTH, 1, 0,
                gl.RGBA, gl.UNSIGNED_BYTE, bytes);
}
