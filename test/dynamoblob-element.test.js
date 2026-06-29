import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { JSDOM } from 'jsdom';

// These tests exercise the <dynamo-blob> custom element itself (the two-way
// state logic added in the 2.0.0 attribute refactor), so they need a real DOM.
// The pure geometry helpers are covered separately in dynamoblobs.test.js.
//
// `node --test` runs each file in its own process, so the globals wired up here
// don't leak into the helper-only suite.

// Flipped per test to drive prefers-reduced-motion through the matchMedia mock.
let reducedMotion = false;
let DynamoBlob;
let document;

before(async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
  });
  const { window } = dom;

  // The module reads HTMLElement (class extends) and window.customElements
  // (registration) at import time, so these must exist before the import below.
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.customElements = window.customElements;
  globalThis.CustomEvent = window.CustomEvent;

  // Controlled rAF: hand back a non-null id but never invoke the callback, so
  // the morph/drift loops schedule a frame without recursing. These tests only
  // assert play/pause *state*, never the interpolated animation output.
  let rafId = 0;
  globalThis.requestAnimationFrame = () => ++rafId;
  globalThis.cancelAnimationFrame = () => {};

  // Configurable prefers-reduced-motion (jsdom has no matchMedia by default).
  window.matchMedia = (query) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });

  ({ DynamoBlob } = await import('../src/dynamoblobs.js'));
  document = window.document;
});

afterEach(() => {
  // Disconnect every blob (tears down loops) and reset the motion preference.
  document.body.replaceChildren();
  reducedMotion = false;
});

after(() => {
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.HTMLElement;
  delete globalThis.customElements;
  delete globalThis.CustomEvent;
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
});

// Create a connected <dynamo-blob> with the given attributes applied before
// connection, so connectedCallback reads them as the initial config.
function makeBlob(attrs = {}) {
  const el = document.createElement('dynamo-blob');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.appendChild(el);
  return el;
}

describe('DynamoBlob is upgraded', () => {
  it('registers the custom element', () => {
    assert.equal(customElements.get('dynamo-blob'), DynamoBlob);
  });

  it('instantiates as a real element with the host class', () => {
    const el = makeBlob();
    assert.ok(el instanceof DynamoBlob);
    assert.ok(el.classList.contains('dynamo-blob-host'));
    assert.equal(el.getAttribute('aria-hidden'), 'true');
    assert.ok(el.querySelector('svg path'));
  });
});

describe('state getters mirror the data-blob-is-* attributes', () => {
  it('reflects the initial state to attributes on connect', () => {
    const el = makeBlob();
    // Wobble auto-plays by default; morph/drift do not.
    assert.equal(el.isWobbling, true);
    assert.equal(el.isMorphing, false);
    assert.equal(el.isDrifting, false);
    assert.equal(el.isAnimating, true);

    assert.equal(el.getAttribute('data-blob-is-wobbling'), 'true');
    assert.equal(el.getAttribute('data-blob-is-morphing'), 'false');
    assert.equal(el.getAttribute('data-blob-is-drifting'), 'false');
    assert.equal(el.getAttribute('data-blob-is-animating'), 'true');
  });

  it('isWobbling tracks play/pause and writes the attribute', () => {
    const el = makeBlob();
    el.pauseWobble();
    assert.equal(el.isWobbling, false);
    assert.equal(el.getAttribute('data-blob-is-wobbling'), 'false');

    el.playWobble();
    assert.equal(el.isWobbling, true);
    assert.equal(el.getAttribute('data-blob-is-wobbling'), 'true');
  });

  it('isMorphing tracks play/pause and writes the attribute', () => {
    const el = makeBlob();
    assert.equal(el.isMorphing, false);

    el.playMorph();
    assert.equal(el.isMorphing, true);
    assert.equal(el.getAttribute('data-blob-is-morphing'), 'true');

    el.pauseMorph();
    assert.equal(el.isMorphing, false);
    assert.equal(el.getAttribute('data-blob-is-morphing'), 'false');
  });

  it('isDrifting tracks start/stop and writes the attribute', () => {
    const el = makeBlob();
    assert.equal(el.isDrifting, false);

    el.startDrift();
    assert.equal(el.isDrifting, true);
    assert.equal(el.getAttribute('data-blob-is-drifting'), 'true');

    el.stopDrift();
    assert.equal(el.isDrifting, false);
    assert.equal(el.getAttribute('data-blob-is-drifting'), 'false');
  });

  it('isAnimating is the OR of the three layers and is reflected', () => {
    const el = makeBlob();
    // Start from fully idle.
    el.pause();
    assert.equal(el.isAnimating, false);
    assert.equal(el.getAttribute('data-blob-is-animating'), 'false');

    el.playMorph();
    assert.equal(el.isAnimating, true);
    assert.equal(el.getAttribute('data-blob-is-animating'), 'true');

    el.pauseMorph();
    assert.equal(el.isAnimating, false);
    assert.equal(el.getAttribute('data-blob-is-animating'), 'false');
  });

  it('drives play/pause from the data-blob-is-* attributes (two-way)', () => {
    const el = makeBlob();

    el.setAttribute('data-blob-is-wobbling', 'false');
    assert.equal(el.isWobbling, false);

    el.setAttribute('data-blob-is-morphing', 'true');
    assert.equal(el.isMorphing, true);

    el.setAttribute('data-blob-is-drifting', 'true');
    assert.equal(el.isDrifting, true);
  });
});

describe('auto-play gating', () => {
  it('auto-plays wobble by default, but not morph or drift', () => {
    const el = makeBlob();
    assert.equal(el.isWobbling, true);
    assert.equal(el.isMorphing, false);
    assert.equal(el.isDrifting, false);
  });

  it('honors explicit autoplay flags', () => {
    const wobbleOff = makeBlob({ 'data-blob-wobble-autoplay': 'false' });
    assert.equal(wobbleOff.isWobbling, false);

    const morphOn = makeBlob({ 'data-blob-morph-autoplay': 'true' });
    assert.equal(morphOn.isMorphing, true);

    const driftOn = makeBlob({ 'data-blob-drift-autoplay': 'true' });
    assert.equal(driftOn.isDrifting, true);
  });

  it('prefers-reduced-motion suppresses all auto-play', () => {
    reducedMotion = true;
    const el = makeBlob({
      'data-blob-morph-autoplay': 'true',
      'data-blob-drift-autoplay': 'true',
    });
    assert.equal(el.isWobbling, false);
    assert.equal(el.isMorphing, false);
    assert.equal(el.isDrifting, false);
    assert.equal(el.isAnimating, false);
  });

  it('reduced motion still honors an explicit data-blob-is-* request', () => {
    reducedMotion = true;
    const el = makeBlob({
      'data-blob-is-wobbling': 'true',
      'data-blob-is-morphing': 'true',
    });
    assert.equal(el.isWobbling, true);
    assert.equal(el.isMorphing, true);
  });

  it('reduced motion does not gate the imperative play*() methods', () => {
    reducedMotion = true;
    const el = makeBlob();
    assert.equal(el.isWobbling, false); // auto-play suppressed

    el.playWobble();
    el.playMorph();
    el.playDrift();
    assert.equal(el.isWobbling, true);
    assert.equal(el.isMorphing, true);
    assert.equal(el.isDrifting, true);
  });
});

describe('the data-blob-is-animating master switch', () => {
  it('freezes every layer when set to false on connect', () => {
    const el = makeBlob({
      'data-blob-is-animating': 'false',
      'data-blob-morph-autoplay': 'true',
      'data-blob-drift-autoplay': 'true',
    });
    assert.equal(el.isWobbling, false);
    assert.equal(el.isMorphing, false);
    assert.equal(el.isDrifting, false);
    assert.equal(el.isAnimating, false);
  });

  it('freezes a running blob when toggled to false', () => {
    const el = makeBlob({
      'data-blob-morph-autoplay': 'true',
      'data-blob-drift-autoplay': 'true',
    });
    assert.equal(el.isAnimating, true);

    el.setAttribute('data-blob-is-animating', 'false');
    assert.equal(el.isWobbling, false);
    assert.equal(el.isMorphing, false);
    assert.equal(el.isDrifting, false);
    assert.equal(el.isAnimating, false);
  });

  it('resumes the auto-play layers when toggled back to true', () => {
    const el = makeBlob({
      'data-blob-is-animating': 'false',
      'data-blob-morph-autoplay': 'true',
      'data-blob-drift-autoplay': 'true',
    });

    el.setAttribute('data-blob-is-animating', 'true');
    // wobble (default true), morph + drift (explicitly enabled) all resume.
    assert.equal(el.isWobbling, true);
    assert.equal(el.isMorphing, true);
    assert.equal(el.isDrifting, true);
    assert.equal(el.isAnimating, true);
  });

  it('only resumes layers whose autoplay is enabled', () => {
    const el = makeBlob({ 'data-blob-is-animating': 'false' });

    el.setAttribute('data-blob-is-animating', 'true');
    // Only wobble auto-plays; morph and drift stay put.
    assert.equal(el.isWobbling, true);
    assert.equal(el.isMorphing, false);
    assert.equal(el.isDrifting, false);
  });

  it('reflects is-animating="true" when any layer is kicked off', () => {
    const el = makeBlob({ 'data-blob-is-animating': 'false' });
    assert.equal(el.getAttribute('data-blob-is-animating'), 'false');

    el.playDrift();
    assert.equal(el.isAnimating, true);
    assert.equal(el.getAttribute('data-blob-is-animating'), 'true');
  });
});

describe('write-back guard (no attributeChangedCallback feedback loop)', () => {
  it('a self-reflected attribute does not re-enter the change handler', () => {
    // On a frozen blob (master off) the wobble layer still has autoplay=true by
    // default. Kicking off morph reflects is-animating -> "true". If the reflect
    // write looped back through attributeChangedCallback, the is-animating="true"
    // branch would resume the wobble auto-play layer. The _writingState guard
    // suppresses that, so wobble must stay off.
    const el = makeBlob({ 'data-blob-is-animating': 'false' });
    assert.equal(el.isWobbling, false);

    el.playMorph();

    assert.equal(el.isMorphing, true);
    assert.equal(el.isWobbling, false); // would be true without the guard
    assert.equal(el.getAttribute('data-blob-is-animating'), 'true');
  });

  it('leaves _writingState empty after reflection (entries are cleaned up)', () => {
    const el = makeBlob();
    el.pause();
    el.play();
    el.playMorph();
    el.startDrift();
    assert.equal(el._writingState.size, 0);
  });

  it('does not recurse when an is-* attribute is set to its current value', () => {
    const el = makeBlob();
    // Wobble is already on and reflected as "true"; re-asserting it is a no-op
    // that must settle synchronously without flipping other layers.
    el.setAttribute('data-blob-is-wobbling', 'true');
    assert.equal(el.isWobbling, true);
    assert.equal(el.isMorphing, false);
    assert.equal(el.isDrifting, false);
    assert.equal(el._writingState.size, 0);
  });
});

describe('drift collision boundary', () => {
  // A square ring of vertices at radius R from the centre (50,50). The endpoint
  // numbers after each control point are irrelevant to parsing. The vertices are
  // Bezier control points, so the rendered curve passes through the edge
  // midpoints and sits *inside* this ring — the measured radius is < R.
  const ringPath = (r) =>
    `M 0,0 Q ${50 + r},50 0,0 Q 50,${50 + r} 0,0 Q ${50 - r},50 0,0 Q 50,${50 - r} 0,0 Z`;

  // Recover the collision radius (viewBox units) from a square-host inset.
  const VIEW_UNITS = 100;
  const CENTER = 50;
  const radiusFromInset = (inset, box) => CENTER - inset.x / (box / VIEW_UNITS);

  it('samples the rendered curve, not the vertex ring', () => {
    const el = makeBlob();
    el.path.setAttribute('d', ringPath(30));
    // The curve passes through the edge midpoints and bulges only partway to the
    // vertices, so the true radius is strictly inside the 30-unit vertex ring and
    // outside the midpoint floor (30*cos45). Measuring the vertices is what made
    // it bounce short.
    const r = el._driftCollisionRadius();
    assert.ok(r < 30, `expected curve radius < 30, got ${r}`);
    assert.ok(r > 30 * Math.cos(Math.PI / 4), `radius below midpoint floor: ${r}`);
  });

  it('shrinks the boundary by the default 0.9 bias (carries slightly past)', () => {
    const el = makeBlob();
    assert.equal(el.driftBias, 0.9);
    el.path.setAttribute('d', ringPath(30));
    const raw = el._driftCollisionRadius();
    const inset = el.measureDriftInset(200, 200);

    assert.equal(inset.x, inset.y); // symmetric ring
    const effective = radiusFromInset(inset, 200);
    assert.ok(Math.abs(effective - raw * 0.9) < 1e-9, `effective ${effective} != 0.9*${raw}`);
    assert.ok(effective < raw); // smaller boundary -> box travels further before bouncing
  });

  it('data-blob-drift-bias overrides the boundary scale', () => {
    const el = makeBlob({ 'data-blob-drift-bias': '0.75' });
    assert.equal(el.driftBias, 0.75);
    el.path.setAttribute('d', ringPath(30));
    const raw = el._driftCollisionRadius();
    const effective = radiusFromInset(el.measureDriftInset(200, 200), 200);
    assert.ok(Math.abs(effective - raw * 0.75) < 1e-9, `effective ${effective} != 0.75*${raw}`);
  });

  it('clamps an out-of-range bias to the supported window', () => {
    assert.equal(makeBlob({ 'data-blob-drift-bias': '9' }).driftBias, 1.5);
    assert.equal(makeBlob({ 'data-blob-drift-bias': '0' }).driftBias, 0.5);
  });

  it('accounts for letterboxing on a non-square host', () => {
    const el = makeBlob();
    el.path.setAttribute('d', ringPath(30));
    // 300x200: scale 2 (meet), same radial ring on both axes; x picks up the
    // extra (300 - 200)/2 = 50 of horizontal letterbox.
    const inset = el.measureDriftInset(300, 200);
    assert.ok(Math.abs(inset.x - inset.y - 50) < 1e-9);
  });

  it('is invariant to the CSS wobble transform (uses geometry, not the rect)', () => {
    const el = makeBlob();
    el.path.setAttribute('d', ringPath(30));
    const before = el.measureDriftInset(200, 200);
    // The wobble lives on this ancestor; the geometric measure must ignore it.
    el.querySelector('.dynamo-blob__turn').style.transform = 'rotate(37deg) scale(0.8)';
    assert.deepEqual(el.measureDriftInset(200, 200), before);
  });
});
