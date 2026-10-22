// ESM facade for the scene model + entity packer.
//
// src/scene.js and src/pack.js are classic scripts (not ES modules) so that
// index.html also works when it is opened directly from disk (file://) — the
// documented wallpaper deployment. ES module imports of local files are
// CORS-blocked on the opaque file:// origin, which killed the whole module
// script: the "+ Add" buttons had no handlers and spawned nothing.
//
// The browser loads the two classic scripts and reads their namespaces
// (globalThis.FsToyboxScene / globalThis.FsToyboxPack). Node/Vitest imports
// THIS file, which pulls the classic scripts in as side-effect modules and
// re-exports their public API as named ESM exports.
import './scene.js';
import './pack.js';

const scene = globalThis.FsToyboxScene;
const pack = globalThis.FsToyboxPack;

if (!scene || !pack) {
  throw new Error('src/index.js: classic scripts did not register their namespaces');
}

export const {
  ENTITY_KINDS,
  KIND_GPU,
  createEntity,
  Scene,
  serialize,
  deserialize,
  validateScene,
  resolveOrbits,
} = scene;

export const {
  MAX_ENTITIES,
  TEX_WIDTH,
  resolveWorldPosition,
  packEntitiesToDataTexture,
  uploadEntityTexture,
} = pack;
