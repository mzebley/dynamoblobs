import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

// The module references HTMLElement (class extends) and customElements (registration)
// at import time. Stub them so the module loads in a plain Node environment.
typeof globalThis.HTMLElement === 'undefined' && (globalThis.HTMLElement = class {});

typeof globalThis.customElements === 'undefined' &&
  (globalThis.customElements = {
    registry: new Map(),
    get(name) {
      return this.registry.get(name);
    },
    define(name, ctor) {
      this.registry.set(name, ctor);
    },
  });

let generateBlobPath;
let generateBlobPoints;
let nextMorphShape;
let parseBlobPath;
let interpolateBlob;
let resampleClosed;
let createSeededRandom;
let encodeBlobSeed;
let decodeBlobSeed;

before(async () => {
  ({
    generateBlobPath,
    generateBlobPoints,
    nextMorphShape,
    parseBlobPath,
    interpolateBlob,
    resampleClosed,
    createSeededRandom,
    encodeBlobSeed,
    decodeBlobSeed,
  } = await import('../src/dynamoblobs.js'));
});

describe('generateBlobPoints', () => {
  it('returns the requested number of vertices', () => {
    const pts = generateBlobPoints(8, 10, () => 0.5);
    assert.equal(pts.length, 8);
  });

  it('enforces a minimum of 3 vertices', () => {
    assert.equal(generateBlobPoints(1, 10, () => 0.5).length, 3);
  });

  it('is deterministic for a given RNG', () => {
    const a = generateBlobPoints(6, 12, createSeededRandom('hello'));
    const b = generateBlobPoints(6, 12, createSeededRandom('hello'));
    assert.deepEqual(a, b);
  });
});

describe('generateBlobPath', () => {
  it('produces a closed quadratic path', () => {
    const path = generateBlobPath({ points: 6, variance: 10, random: () => 0.5 });
    assert.ok(path.startsWith('M '));
    assert.ok(path.trimEnd().endsWith('Z'));
    assert.ok(path.includes('Q '));
  });

  it('is reproducible with a seeded RNG', () => {
    const a = generateBlobPath({ points: 10, variance: 8, random: createSeededRandom('abc') });
    const b = generateBlobPath({ points: 10, variance: 8, random: createSeededRandom('abc') });
    assert.equal(a, b);
  });
});

describe('parseBlobPath', () => {
  it('round-trips the vertex count from a generated path', () => {
    const path = generateBlobPath({ points: 9, variance: 6, random: createSeededRandom('x') });
    assert.equal(parseBlobPath(path).length, 9);
  });

  it('recovers the control points from a known path', () => {
    const points = parseBlobPath('M 10,10 Q 20,30 25,35 Q 40,50 5,5 Z');
    assert.deepEqual(points, [
      { x: 20, y: 30 },
      { x: 40, y: 50 },
    ]);
  });
});

describe('resampleClosed', () => {
  it('changes the vertex count while preserving the ring', () => {
    const pts = generateBlobPoints(6, 10, createSeededRandom('seed'));
    assert.equal(resampleClosed(pts, 10).length, 10);
    assert.equal(resampleClosed(pts, 3).length, 3);
  });

  it('returns a copy when the count is unchanged', () => {
    const pts = generateBlobPoints(5, 10, () => 0.5);
    const out = resampleClosed(pts, 5);
    assert.deepEqual(out, pts);
    assert.notEqual(out, pts);
  });
});

describe('interpolateBlob', () => {
  it('returns the exact target path at progress 1', () => {
    const from = generateBlobPoints(8, 10, createSeededRandom('a'));
    const to = generateBlobPoints(8, 10, createSeededRandom('b'));
    const { pointsToPath } = makePointsToPath();
    assert.equal(interpolateBlob(from, to, 1), pointsToPath(to));
  });

  it('handles a mismatched point count via resampling', () => {
    const from = generateBlobPoints(6, 10, createSeededRandom('a'));
    const to = generateBlobPoints(12, 10, createSeededRandom('b'));
    const path = interpolateBlob(from, to, 0.5);
    // 12 Q-commands at the target resolution.
    assert.equal(parseBlobPath(path).length, 12);
  });
});

describe('nextMorphShape', () => {
  const CENTER = 50;
  const radiiOf = (path) =>
    parseBlobPath(path).map((p) => Math.hypot(p.x - CENTER, p.y - CENTER));
  const meanDelta = (a, b) =>
    a.reduce((s, r, i) => s + Math.abs(r - b[i]), 0) / a.length;

  it('preserves the vertex count of the base shape', () => {
    const base = generateBlobPath({ points: 9, variance: 8, random: createSeededRandom('base') });
    const next = nextMorphShape(base, { variance: 8, intensity: 1, random: createSeededRandom('d') });
    assert.equal(parseBlobPath(next).length, 9);
  });

  it('produces a valid closed path', () => {
    const base = generateBlobPath({ points: 7, variance: 8, random: createSeededRandom('base') });
    const next = nextMorphShape(base, { variance: 8, intensity: 0.5, random: () => 0.5 });
    assert.ok(next.startsWith('M '));
    assert.ok(next.trimEnd().endsWith('Z'));
  });

  it('moves the shape more at higher intensity (consistent magnitude)', () => {
    const base = generateBlobPath({ points: 8, variance: 10, random: createSeededRandom('base') });
    const baseR = radiiOf(base);
    // Same RNG sequence for both, so only intensity differs.
    const low = nextMorphShape(base, { variance: 10, intensity: 0.1, random: createSeededRandom('dir') });
    const high = nextMorphShape(base, { variance: 10, intensity: 0.6, random: createSeededRandom('dir') });
    assert.ok(meanDelta(radiiOf(high), baseR) > meanDelta(radiiOf(low), baseR));
  });

  it('keeps radii within the variance band (clamped)', () => {
    const base = generateBlobPath({ points: 12, variance: 8, random: createSeededRandom('base') });
    // Extreme intensity would overshoot without clamping.
    const next = nextMorphShape(base, { variance: 8, intensity: 5, random: createSeededRandom('dir') });
    for (const r of radiiOf(next)) {
      assert.ok(r >= 30 - 8 - 1e-6 && r <= 30 + 8 + 1e-6);
    }
  });
});

describe('blob seed encoding', () => {
  it('round-trips a path through encode/decode', () => {
    const path = generateBlobPath({ points: 7, variance: 9, random: createSeededRandom('z') });
    const decoded = decodeBlobSeed(encodeBlobSeed(path));
    assert.equal(decoded, path.trim().replace(/\s+/g, ' '));
  });

  it('returns null for empty or invalid seeds', () => {
    assert.equal(decodeBlobSeed(''), null);
    assert.equal(decodeBlobSeed('   '), null);
  });
});

describe('createSeededRandom', () => {
  it('produces a stable sequence for the same seed', () => {
    const r1 = createSeededRandom('same');
    const r2 = createSeededRandom('same');
    assert.equal(r1(), r2());
    assert.equal(r1(), r2());
  });

  it('differs across seeds', () => {
    assert.notEqual(createSeededRandom('one')(), createSeededRandom('two')());
  });
});

// Rebuild a path from points the same way the library does, for assertions.
function makePointsToPath() {
  const pointsToPath = (pts) => {
    if (!pts.length) return '';
    let d = '';
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const next = pts[(i + 1) % pts.length];
      d += ` Q ${p.x},${p.y} ${(p.x + next.x) / 2},${(p.y + next.y) / 2}`;
    }
    const startX = (pts[0].x + pts[pts.length - 1].x) / 2;
    const startY = (pts[0].y + pts[pts.length - 1].y) / 2;
    return `M ${startX},${startY}${d} Z`;
  };
  return { pointsToPath };
}
