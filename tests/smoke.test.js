import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('project skeleton', () => {
  it('has a README', () => {
    expect(fs.existsSync(path.resolve('README.md'))).toBe(true);
  });
  it('has a scene.json', () => {
    expect(fs.existsSync(path.resolve('scene.json'))).toBe(true);
  });
  it('has an index.html', () => {
    expect(fs.existsSync(path.resolve('index.html'))).toBe(true);
  });
});
