import { describe, it, expect } from 'vitest';
import { Scene, createEntity, ENTITY_KINDS,
         serialize, deserialize, validateScene } from '../src/scene.js';

describe('Scene', () => {
  it('starts empty', () => {
    const s = new Scene();
    expect(s.entities).toEqual([]);
  });
  it('adds an entity and assigns an id', () => {
    const s = new Scene();
    const e = s.addEntity(createEntity('galaxy'));
    expect(s.entities.length).toBe(1);
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('rejects unknown kinds', () => {
    expect(() => createEntity('unicorn')).toThrow();
  });
  it('exposes all 8 entity kinds', () => {
    expect(ENTITY_KINDS.slice().sort()).toEqual(
      ['blackHole','comet','galaxy','moon','nebula','planet','ring','shootingStar'].slice().sort()
    );
  });
});

describe('serialize / deserialize', () => {
  it('round-trips an empty scene', () => {
    const s = new Scene();
    const json = serialize(s);
    const back = deserialize(json);
    expect(back.entities.length).toBe(0);
    expect(back.schemaVersion).toBe(1);
  });
  it('round-trips 3 entities', () => {
    const s = new Scene();
    s.addEntity(createEntity('galaxy'));
    s.addEntity(createEntity('planet'));
    s.addEntity(createEntity('moon'));
    const back = deserialize(serialize(s));
    expect(back.entities.length).toBe(3);
    expect(back.entities[0].kind).toBe('galaxy');
  });
  it('rejects unknown schemaVersion', () => {
    expect(() => deserialize('{"schemaVersion": 999}')).toThrow(/schema/);
  });
  it('rejects malformed JSON', () => {
    expect(() => deserialize('not json')).toThrow();
  });
  it('rejects unknown entity kind', () => {
    expect(() => deserialize('{"schemaVersion":1,"entities":[{"kind":"unicorn"}]}')).toThrow();
  });
});

describe('orbit graph', () => {
  it('detects direct cycle A → B → A', () => {
    const s = new Scene();
    const a = s.addEntity(createEntity('planet'));
    const b = s.addEntity(createEntity('planet'));
    a.orbit.enabled = true; a.orbit.parentId = b.id;
    b.orbit.enabled = true; b.orbit.parentId = a.id;
    expect(() => validateScene(s, { resolveOrbits: true })).toThrow(/cycle/);
  });
  it('rejects depth > 8', () => {
    const s = new Scene();
    let prev = null;
    for (let i = 0; i < 10; i++) {
      const e = s.addEntity(createEntity('planet'));
      if (prev) { e.orbit.enabled = true; e.orbit.parentId = prev.id; }
      prev = e;
    }
    expect(() => validateScene(s, { resolveOrbits: true, maxDepth: 8 })).toThrow(/depth/);
  });
});
