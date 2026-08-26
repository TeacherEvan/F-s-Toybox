// Regression guard: non-galaxy kinds must affect the frame (not white/break).
import { describe, it, expect } from 'vitest';

describe('M5+ entity render guard', () => {
  it('blackHole kind is defined and non-zero GPU id', () => {
    const { KIND_GPU } = require('../src/scene.js');
    expect(KIND_GPU.BLACK_HOLE).toBe(6);
  });
  it('shader branch covers kinds > 1 (regression: col=vec3(1.0); break removed)', () => {
    // This is a structural doc gate: the shader file must contain the new branches.
    const fs = require('fs');
    const frag = fs.readFileSync('index.html', 'utf8');
    expect(frag).toContain('if (e.kind == 6)');     // blackHole branch exists
    expect(frag).not.toContain('break;');          // old loop-break removed (check near kind line)
    // More precise: the white-blank + break combo must be gone
    expect(frag).not.toMatch(/col = vec3\(1\.0\);\s*break;/);
  });
});
