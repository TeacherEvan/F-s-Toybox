import { describe, it, expect } from 'vitest';
import { Scene, createEntity } from '../src/scene.js';
import { packEntitiesToDataTexture } from '../src/pack.js';

// Layout contract: 64×4 RGBA32F (Risk #13 — NOT 64×1). One column per entity,
// four vec4 rows: [kind,pos.x,pos.y,parentOrRot] [h/360,s,b,scale] [m0..m3] [r0..r2,r3].
describe('64×4 data texture packing', () => {
  it('returns 1024 floats (64 entities × 4 slots × 4 components)', () => {
    expect(packEntitiesToDataTexture(new Scene(), 0).length).toBe(1024);
  });

  it('writes kind, position, hsv/360 and scale into column 0', () => {
    const s = new Scene();
    const g = createEntity('galaxy');
    g.position = { x: 0.25, y: -0.5 };
    g.color = { h: 90, s: 0.5, b: 0.8 };
    g.scale = 2;
    s.addEntity(g);
    const d = packEntitiesToDataTexture(s, 0);
    expect(d[0]).toBe(1);              // KIND_GPU.GALAXY
    expect(d[1]).toBeCloseTo(0.25);
    expect(d[2]).toBeCloseTo(-0.5);
    expect(d[4]).toBeCloseTo(90 / 360);
    expect(d[5]).toBeCloseTo(0.5);
    expect(d[6]).toBeCloseTo(0.8);
    expect(d[7]).toBe(2);
  });

  it('encodes hidden entities as negative kind (visible = sign of kind)', () => {
    const s = new Scene();
    const g = createEntity('galaxy');
    g.visible = false;
    s.addEntity(g);
    const d = packEntitiesToDataTexture(s, 0);
    expect(d[0]).toBe(-1);
  });

  it('maps galaxy fields to slots per design §3.5 (motion p0..p3, render r0..r3)', () => {
    const s = new Scene();
    const g = createEntity('galaxy'); // spin .4 pulse .2 wobble 0 | coreBright 1.5 dust .6 armSharp .7 coreSize .5
    s.addEntity(g);
    const d = packEntitiesToDataTexture(s, 0);
    expect(d[8]).toBeCloseTo(0.4);     // motion.p0 = spin
    expect(d[9]).toBeCloseTo(0.2);     // motion.p1 = pulse
    expect(d[10]).toBeCloseTo(0.0);    // motion.p2 = wobble
    expect(d[12]).toBeCloseTo(1.5);    // render.r0 = coreBright
    expect(d[13]).toBeCloseTo(0.6);    // render.r1 = dust
    expect(d[14]).toBeCloseTo(0.7);    // render.r2 = armSharp
    expect(d[15]).toBeCloseTo(0.5);    // render.r3 = coreSize
  });

  it('resolves child orbit positions (Y-up, positive speed = counter-clockwise)', () => {
    const s = new Scene();
    const p = s.addEntity(createEntity('planet'));
    const m = s.addEntity(createEntity('moon'));
    m.orbit = { enabled: true, parentId: p.id, radius: 0.5, speed: Math.PI / 2, phase: 0 };
    const atT0 = packEntitiesToDataTexture(s, 0);
    expect(atT0[1]).toBeCloseTo(0.5);  // moon column 1, pos.x
    expect(atT0[2]).toBeCloseTo(0.0);
    const atQuarter = packEntitiesToDataTexture(s, 1); // theta = π/2
    expect(atQuarter[1]).toBeCloseTo(0, 5);
    expect(atQuarter[2]).toBeCloseTo(0.5);
  });
});
