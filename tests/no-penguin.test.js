import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

const html = fs.readFileSync('index.html', 'utf8');

describe('no penguin references in index.html', () => {
  // These are the eight penguin-era global uniforms and the penguin-specific
  // GLSL functions / state. uChroma and uGrain are INTENTIONALLY retained
  // (they are global post-FX, not penguin-specific — verified by reading
  // reference main() lines 411-415 and 421-425). Do not add them here.
  const banned = [
    'mapPenguin', 'Cosmic Penguin', 'cosmic-penguin', 'penguin',
    'uPeriod', 'uIntensity', 'uBloom', 'uSpikes', 'uJet', 'uSpin',
    'eyeSock', 'eyePos', 'leftEyePos', 'rightEyePos',
    'matID', 'cycleIndex', 'cycleProgress', 'isLeftEye',
  ];
  for (const word of banned) {
    it(`does not contain "${word}"`, () => {
      expect(html).not.toContain(word);
    });
  }
});
