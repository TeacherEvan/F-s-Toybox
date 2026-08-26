import { describe, it, expect } from 'vitest';
import { Scene, createEntity } from '../src/scene.js';
import { packEntitiesToDataTexture, TEX_WIDTH } from '../src/pack.js';

// Encoding: RGBA8 byte texture, 4096×1. Entity i owns bytes [i*64, i*64+64)
// = 16 little-endian float32 values (design §5.1, §3.5).
const f32 = (bytes, floatIdx) =>
  new DataView(bytes.buffer, bytes.byteOffset).getFloat32(floatIdx * 4, true);

describe('entity data texture packing (RGBA8, float32-bit exact)', () => {
  it('returns 4096 bytes (64 entities × 16 floats × 4) = 1024 texels', () => {
    const d = packEntitiesToDataTexture(new Scene(), 0);
    expect(d.length).toBe(4096);
    expect(TEX_WIDTH).toBe(1024);
  });

  it('writes kind, position, hsv/360 and scale into entity 0', () => {
    const s = new Scene();
    const g = createEntity('galaxy');
    g.position = { x: 0.25, y: -0.5 };
    g.color = { h: 90, s: 0.5, b: 0.8 };
    g.scale = 2;
    s.addEntity(g);
    const d = packEntitiesToDataTexture(s, 0);
    expect(f32(d, 0)).toBe(1);              // KIND_GPU.GALAXY
    expect(f32(d, 1)).toBeCloseTo(0.25);
    expect(f32(d, 2)).toBeCloseTo(-0.5);
    expect(f32(d, 4)).toBeCloseTo(90 / 360);
    expect(f32(d, 5)).toBeCloseTo(0.5);
    expect(f32(d, 6)).toBeCloseTo(0.8);
    expect(f32(d, 7)).toBe(2);
  });

  it('encodes hidden entities as negative kind (visible = sign of kind)', () => {
    const s = new Scene();
    const g = createEntity('galaxy');
    g.visible = false;
    s.addEntity(g);
    expect(f32(packEntitiesToDataTexture(s, 0), 0)).toBe(-1);
  });

  it('maps galaxy fields to slots per design §3.5 (motion p0..p3, render r0..r3)', () => {
    const s = new Scene();
    const g = createEntity('galaxy'); // spin .4 pulse .2 wobble 0 | coreBright 1.5 dust .6 armSharp .7 coreSize .5
    s.addEntity(g);
    const d = packEntitiesToDataTexture(s, 0);
    expect(f32(d, 8)).toBeCloseTo(0.4);     // motion.p0 = spin
    expect(f32(d, 9)).toBeCloseTo(0.2);     // motion.p1 = pulse
    expect(f32(d, 10)).toBeCloseTo(0.0);    // motion.p2 = wobble
    expect(f32(d, 12)).toBeCloseTo(1.5);    // render.r0 = coreBright
    expect(f32(d, 13)).toBeCloseTo(0.6);    // render.r1 = dust
    expect(f32(d, 14)).toBeCloseTo(0.7);    // render.r2 = armSharp
    expect(f32(d, 15)).toBeCloseTo(0.5);    // render.r3 = coreSize
  });

  it('resolves child orbit positions (Y-up, positive speed = counter-clockwise)', () => {
    const s = new Scene();
    const p = s.addEntity(createEntity('planet'));
    const m = s.addEntity(createEntity('moon'));
    m.orbit = { enabled: true, parentId: p.id, radius: 0.5, speed: Math.PI / 2, phase: 0 };
    // Moon is entity index 1 → floats 16..31.
    const atT0 = packEntitiesToDataTexture(s, 0);
    expect(f32(atT0, 17)).toBeCloseTo(0.5); // moon world.x
    expect(f32(atT0, 18)).toBeCloseTo(0.0); // moon world.y
    const atQuarter = packEntitiesToDataTexture(s, 1); // theta = π/2
    expect(f32(atQuarter, 17)).toBeCloseTo(0, 5);
    expect(f32(atQuarter, 18)).toBeCloseTo(0.5);
  });
});
