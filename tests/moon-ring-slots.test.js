import { describe, it, expect } from 'vitest';
import { Scene, createEntity } from '../src/scene.js';
import { packEntitiesToDataTexture } from '../src/pack.js';

// M7 Task 7.1 (RED) — slot alignment for Moon & Ring kinds.
// Design §3.5: the shader sees a uniform motion:vec4 / render:vec4 per kind.
//   Moon: motion [spin, wobble, libration, null]  render [radius, craterDensity, albedo, null]
//   Ring: motion [null, null, null, null]           render [innerRadius, outerRadius, tilt, opacity]
const f32 = (bytes, floatIdx) =>
  new DataView(bytes.buffer, bytes.byteOffset).getFloat32(floatIdx * 4, true);

describe('M7 moon & ring slot alignment (design §3.5)', () => {
  it('maps moon motion slots p0..p3 = spin, wobble, libration, 0', () => {
    const s = new Scene();
    const m = s.addEntity(createEntity('moon'));
    m.motion = { spin: 0.3, wobble: 0.1, libration: 0.7 };
    const d = packEntitiesToDataTexture(s, 0);
    // Moon is entity 0 -> floats 0..15; motion lives at 8..11.
    expect(f32(d, 8)).toBeCloseTo(0.3);   // p0 = spin
    expect(f32(d, 9)).toBeCloseTo(0.1);   // p1 = wobble
    expect(f32(d, 10)).toBeCloseTo(0.7);  // p2 = libration
    expect(f32(d, 11)).toBe(0.0);         // p3 = null -> 0
  });

  it('maps moon render slots r0..r3 = radius, craterDensity, albedo, 0', () => {
    const s = new Scene();
    const m = s.addEntity(createEntity('moon'));
    m.render = { radius: 0.04, craterDensity: 0.5, albedo: 0.7 };
    const d = packEntitiesToDataTexture(s, 0);
    // render lives at 12..15.
    expect(f32(d, 12)).toBeCloseTo(0.04);         // r0 = radius
    expect(f32(d, 13)).toBeCloseTo(0.5);          // r1 = craterDensity
    expect(f32(d, 14)).toBeCloseTo(0.7);          // r2 = albedo
    expect(f32(d, 15)).toBe(0.0);                  // r3 = null -> 0
  });

  it('maps ring motion slots all-null (inherits parent)', () => {
    const s = new Scene();
    const r = s.addEntity(createEntity('ring'));
    r.motion = {}; // ring has no own motion - inherits parent transform
    const d = packEntitiesToDataTexture(s, 0);
    expect(f32(d, 8)).toBe(0.0);
    expect(f32(d, 9)).toBe(0.0);
    expect(f32(d, 10)).toBe(0.0);
    expect(f32(d, 11)).toBe(0.0);
  });

  it('maps ring render slots r0..r3 = innerRadius, outerRadius, tilt, opacity', () => {
    const s = new Scene();
    const r = s.addEntity(createEntity('ring'));
    r.render = { innerRadius: 0.12, outerRadius: 0.18, tilt: 0.3, opacity: 0.6 };
    const d = packEntitiesToDataTexture(s, 0);
    expect(f32(d, 12)).toBeCloseTo(0.12);   // r0 = innerRadius
    expect(f32(d, 13)).toBeCloseTo(0.18);   // r1 = outerRadius
    expect(f32(d, 14)).toBeCloseTo(0.3);    // r2 = tilt
    expect(f32(d, 15)).toBeCloseTo(0.6);    // r3 = opacity
  });

  it('resolves moon world position via planet parent (Y-up, CCW)', () => {
    const s = new Scene();
    const p = s.addEntity(createEntity('planet'));
    const m = s.addEntity(createEntity('moon'));
    m.orbit = { enabled: true, parentId: p.id, radius: 0.5, speed: Math.PI / 2, phase: 0 };
    // Moon is entity index 1 -> floats 16..31.
    const atT0 = packEntitiesToDataTexture(s, 0);
    expect(f32(atT0, 17)).toBeCloseTo(0.5);  // moon world.x at t=0
    expect(f32(atT0, 18)).toBeCloseTo(0.0);  // moon world.y at t=0
    const atQuarter = packEntitiesToDataTexture(s, 1); // theta = pi/2
    expect(f32(atQuarter, 17)).toBeCloseTo(0, 5);
    expect(f32(atQuarter, 18)).toBeCloseTo(0.5);
  });
});
