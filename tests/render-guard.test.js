// Regression guard: non-galaxy kinds must affect the frame (not white/break).
import { describe, it, expect } from 'vitest';

import fs from 'node:fs';
import { KIND_GPU } from '../src/scene.js';

describe('M5+ entity render guard', () => {
  it('blackHole kind is defined and non-zero GPU id', () => {
    expect(KIND_GPU.BLACK_HOLE).toBe(6);
  });
  it('shader branch covers kinds > 1 (regression: col=vec3(1.0); break removed)', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const fragMatch = html.match(/const FRAG = `([\s\S]*?)`;/);
    expect(fragMatch).not.toBeNull();
    const frag = fragMatch[1];
    expect(frag).toContain('if (e.kind == 6)');     // blackHole branch exists
    expect(frag).not.toContain('break;');          // old entity loop-break removed
    // More precise: the white-blank + break combo must be gone
    expect(frag).not.toMatch(/col\s*=\s*vec3\(1\.0\);\s*break;/);
  });
});
