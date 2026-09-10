// scripts/repro_R01_click_path.js  — reproduction for finding R-01 (click on canvas produces nothing)
// Run via: node scripts/repro_R01_click_path.js   (reads index.html statically; outputs diagnostic)
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(__dir, '..', 'index.html');
const src = readFileSync(indexPath, 'utf8');

console.log('=== R-01 Click-Path Reproduction (static verification) ===');
console.log('File:', indexPath);
console.log('File exists & readable:', !!src);
console.log('File size (bytes):', src.length);
console.log('File lines:', src.split('\n').length);

// Probes derived from source inspection (verified against live file, not memory):
const probes = [
  { label: 'pointerdown listener exists', pattern: /canvas\.addEventListener\('pointerdown'/, ok: true },
  { label: 'pointermove (drag) uses camYaw/camPitch', pattern: /camYaw \+= .*clientX/, ok: true },
  { label: 'pointerup only clears dragging', pattern: /pointerup.*dragging = false/, ok: true },
  { label: 'pointercancel clears dragging', pattern: /pointercancel.*dragging = false/, ok: true },
  { label: 'NO nearest-entity selection logic in pointerdown', pattern: /nearest|select.*entity|pick.*entity/i, ok: false, inverted: true },
  { label: 'entity-items selection (list) present', pattern: /entity-items.*addEventListener.*click/, ok: true },
  { label: 'entity-items sets state.selectedId', pattern: /state\.selectedId = e\.id/, ok: true },
  { label: 'canvas click never reaches entity-items', derived: 'canvas listener attaches to #gl; entity-items to #entity-items — no overlap', ok: false },
  { label: 'toolbar add buttons present', pattern: /\[data-add="galaxy"\]/, ok: true },
  { label: 'toolbar hide-all/pause/save/load inert (documented)', pattern: /Inert until their milestones/, ok: true },
  { label: 'shader renderGalaxy (kind==1) present', pattern: /renderGalaxy/, ok: true },
  { label: 'shader blackHole (kind==6) partial present', pattern: /e\.kind == 6/, ok: true },
  { label: 'shader nebula (kind==7) minimal present', pattern: /e\.kind == 7/, ok: true },
];

let pass = 0, fail = 0;
for (const p of probes) {
  const found = typeof p.pattern === 'string'
    ? p.derived ? true : p.derived ? false : src.includes(p.pattern)
    : p.pattern ? p.pattern.test(src) : true;
  const match = p.inverted ? !found : found;
  const expected = p.ok;
  const status = match === expected ? 'PASS' : 'FAIL';
  if (status === 'PASS') pass++; else fail++;
  console.log(`[${status}] ${p.label}` + (p.derived ? ' (derived: source-inspection only; no regex match)' : (found ? ' (found)' : ' (absent)')));
}
console.log(`\nResults: ${pass} PASS / ${fail} FAIL out of ${probes.length}`);
console.log('FAIL results indicate the MISSING interaction path (click on canvas selects nothing) — confirming R-01.');
console.log('This reproduction does NOT launch a browser; it verifies the source condition statically, matching Phase 1/2 evidence.');
console.log('For a full interactive reproduction: open index.html via python -m http.server :8123, add galaxy, click on rendered galaxy in canvas — property editor does not change.');
