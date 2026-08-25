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
let parseBlobPath;
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

  // Minimal IntersectionObserver mock (jsdom has none) — records its config and
  // whether it was disconnected, so the data-blob-observe tests can assert the
  // observer lifecycle without a real viewport.
  class MockIntersectionObserver {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.observed = [];
      this.disconnected = false;
    }
    observe(target) {
      this.observed.push(target);
    }
    disconnect() {
      this.disconnected = true;
    }
  }
  window.IntersectionObserver = MockIntersectionObserver;
  globalThis.IntersectionObserver = MockIntersectionObserver;

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

  ({ DynamoBlob, parseBlobPath } = await import('../src/dynamoblobs.js'));
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
  delete globalThis.IntersectionObserver;
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

  it('keeps drift positioning when a framework rewrites the authored class', () => {
    const el = makeBlob();
    el.className = 'demo-blob';

    el.startDrift();

    assert.ok(el.classList.contains('dynamo-blob--drift'));
    assert.equal(window.getComputedStyle(el).position, 'absolute');
  });

  it('adopts an SSR snapshot without replacing framework hydration nodes', () => {
    const el = document.createElement('dynamo-blob');
    el.innerHTML = '<div class="dynamo-blob__turn"><svg class="dynamo-blob__skew"><g class="dynamo-blob__scale"><path class="dynamo-blob__path"></path></g></svg></div>';
    const snapshotPath = el.querySelector('path');

    document.body.appendChild(el);

    assert.equal(el.path, snapshotPath);
    assert.equal(el.querySelector('path'), snapshotPath);
    assert.ok(snapshotPath.getAttribute('d'));
  });

  it('exposes click deflection as a named keyboard-operable button', () => {
    const el = makeBlob({ 'data-blob-drift-click': 'true' });
    let deflections = 0;
    el.deflect = () => {
      deflections++;
      return el;
    };

    assert.equal(el.hasAttribute('aria-hidden'), false);
    assert.equal(el.getAttribute('role'), 'button');
    assert.equal(el.tabIndex, 0);
    assert.equal(el.getAttribute('aria-label'), 'Deflect blob');

    el.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    el.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    assert.equal(deflections, 1, 'Space activated before keyup');
    el.dispatchEvent(new window.KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    el.click();
    assert.equal(deflections, 3);
  });

  it('preserves an authored accessible name and removes only generated control defaults', () => {
    const el = makeBlob({
      'data-blob-drift-click': 'true',
      'aria-label': 'Move the background blob',
    });

    assert.equal(el.getAttribute('aria-label'), 'Move the background blob');
    el.setAttribute('data-blob-drift-click', 'false');

    assert.equal(el.getAttribute('aria-label'), 'Move the background blob');
    assert.equal(el.hasAttribute('role'), false);
    assert.equal(el.hasAttribute('tabindex'), false);
    assert.equal(el.getAttribute('aria-hidden'), 'true');
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

  it('drift autoplay still starts when morph autoplay is also on', () => {
    // Regression: starting morph stamps data-blob-is-drifting="false", which used
    // to read back as an explicit "off" and suppress drift's own autoplay.
    const el = makeBlob({
      'data-blob-morph-autoplay': 'true',
      'data-blob-drift-autoplay': 'true',
    });
    assert.equal(el.isMorphing, true);
    assert.equal(el.isDrifting, true);
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

describe('data-blob-observe is reactive', () => {
  it('creates the observer when the attribute is set after connect', () => {
    const el = makeBlob();
    assert.equal(el.intersectionObserver, null);

    el.setAttribute('data-blob-observe', 'continuous:32px');
    assert.ok(el.intersectionObserver, 'observer was not created');
    assert.equal(el.intersectionObserver.options.rootMargin, '32px');
    assert.deepEqual(el.intersectionObserver.observed, [el]);
  });

  it('removing the attribute disconnects the observer', () => {
    const el = makeBlob({ 'data-blob-observe': 'continuous:0px' });
    const observer = el.intersectionObserver;
    assert.ok(observer);

    el.removeAttribute('data-blob-observe');
    assert.equal(observer.disconnected, true);
    assert.equal(el.intersectionObserver, null);
  });

  it('changing the config replaces the observer', () => {
    const el = makeBlob({ 'data-blob-observe': 'once:0px' });
    const first = el.intersectionObserver;

    el.setAttribute('data-blob-observe', 'continuous:64px');
    assert.equal(first.disconnected, true);
    assert.notEqual(el.intersectionObserver, first);
    assert.equal(el.intersectionObserver.options.rootMargin, '64px');
  });
});

describe('control methods chain', () => {
  it('every control method returns the element', () => {
    const el = makeBlob();
    for (const method of [
      'play', 'pause',
      'playWobble', 'pauseWobble',
      'playMorph', 'pauseMorph',
      'playDrift', 'pauseDrift',
      'startDrift', 'stopDrift',
      'generateNewBlob', 'deflect',
    ]) {
      assert.equal(el[method](), el, `${method}() did not return the element`);
    }
  });

  it('a chained sequence lands on the expected combined state', () => {
    const el = makeBlob();
    el.pauseWobble().playMorph().playDrift(2);
    assert.equal(el.isWobbling, false);
    assert.equal(el.isMorphing, true);
    assert.equal(el.isDrifting, true);
  });
});

describe('generation concurrency', () => {
  it('retargets a live morph from the rendered frame and continues morphing', () => {
    const el = makeBlob({ 'data-blob-morph-autoplay': 'true' });
    const displayedPath = el.nextMorphTarget(el.currentPath);
    const generatedPath = el.nextMorphTarget(displayedPath);
    el.path.setAttribute('d', displayedPath);
    el.generatePathString = () => generatedPath;

    const originalRAF = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    let frameCallback = null;
    let nextId = 100;
    globalThis.requestAnimationFrame = (callback) => {
      frameCallback = callback;
      return ++nextId;
    };
    globalThis.cancelAnimationFrame = () => {};

    try {
      el.generateNewBlob(500);

      assert.equal(el.isMorphing, true);
      assert.equal(el.isGeneratingBlob, true);
      assert.equal(el.currentPath, displayedPath);
      assert.equal(el.targetPath, generatedPath);

      const firstFrame = frameCallback;
      firstFrame(1000);
      assert.deepEqual(parseBlobPath(el.path.getAttribute('d')), parseBlobPath(displayedPath));

      const completionFrame = frameCallback;
      completionFrame(1501);

      assert.equal(el.currentPath, generatedPath);
      assert.equal(el.isGeneratingBlob, false);
      assert.equal(el.isMorphing, true);
      assert.notEqual(el.targetPath, generatedPath);
      assert.equal(typeof frameCallback, 'function');
      assert.ok(el.animationFrameId != null, 'continuous morph did not schedule its next frame');
    } finally {
      globalThis.requestAnimationFrame = originalRAF;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  });

  it('pausing during a generated morph freezes the displayed silhouette cleanly', () => {
    const el = makeBlob({ 'data-blob-morph-autoplay': 'true' });
    el.generateNewBlob(500);
    const displayedPath = el.path.getAttribute('d');

    el.pauseMorph();

    assert.equal(el.isMorphing, false);
    assert.equal(el.isGeneratingBlob, false);
    assert.equal(el.animationFrameId, null);
    assert.equal(el.currentPath, displayedPath);
    assert.equal(el.targetPath, displayedPath);
  });
});

describe('seed handling', () => {
  it('reproduces an exact shape from an encoded path seed', () => {
    const first = makeBlob();
    const d = first.path.getAttribute('d');
    const seed = first.getAttribute('data-blob-seed'); // auto-written encoding
    const clone = makeBlob({ 'data-blob-seed': seed });
    assert.equal(clone.path.getAttribute('d'), d);
  });

  it('regenerates when data-blob-points changes (the auto-written seed is not a shape lock)', () => {
    // Regression: the element's own seed write-back was read back as a user
    // seed, so every retune targeted the shape already on screen and the
    // reactive shape attributes did nothing.
    const el = makeBlob({ 'data-blob-morph-tween': '0' });
    assert.equal(parseBlobPath(el.path.getAttribute('d')).length, 10);

    el.setAttribute('data-blob-points', '5');
    assert.equal(parseBlobPath(el.path.getAttribute('d')).length, 5);
  });

  it('never parses a hostile decoded seed as markup', () => {
    const payload = 'M 1,1"><img id="pwn" src=x onerror=alert(1)>';
    const seed = Buffer.from(payload, 'utf8').toString('base64').replace(/=+$/, '');
    const el = makeBlob({ 'data-blob-seed': seed });
    assert.equal(el.querySelector('img'), null);
    // Falls back to treating the attribute as a plain string seed.
    assert.ok(parseBlobPath(el.path.getAttribute('d')).length >= 3);
  });

  it('treats a decodable-but-not-a-path seed as a plain string seed', () => {
    // "TWFyaw" is valid base64 for "Mark" — it must drive generation, not be
    // rendered as the (broken) literal path d="Mark".
    const el = makeBlob({ 'data-blob-seed': 'TWFyaw' });
    const d = el.path.getAttribute('d');
    assert.notEqual(d, 'Mark');
    assert.ok(parseBlobPath(d).length >= 3);
  });
});

describe('moving the element in the DOM (disconnect + reconnect)', () => {
  it('keeps playing layers playing across a re-parent', () => {
    // Regression: disconnect paused morph/drift and reflected is-*="false",
    // which the reconnect then read as an explicit user "off".
    const el = makeBlob({
      'data-blob-morph-autoplay': 'true',
      'data-blob-drift-autoplay': 'true',
    });
    assert.equal(el.isMorphing, true);
    assert.equal(el.isDrifting, true);

    const div = document.createElement('div');
    document.body.appendChild(div);
    div.appendChild(el); // disconnect + reconnect

    assert.equal(el.isWobbling, true);
    assert.equal(el.isMorphing, true);
    assert.equal(el.isDrifting, true);
  });

  it('keeps a deliberately paused layer paused across a re-parent', () => {
    const el = makeBlob({ 'data-blob-morph-autoplay': 'true' });
    el.pauseMorph();

    const div = document.createElement('div');
    document.body.appendChild(div);
    div.appendChild(el);

    assert.equal(el.isMorphing, false);
    assert.equal(el.isWobbling, true); // untouched layer still resumes
  });

  it('keeps the same silhouette across a re-parent', () => {
    const el = makeBlob();
    const d = el.path.getAttribute('d');

    const div = document.createElement('div');
    document.body.appendChild(div);
    div.appendChild(el);

    assert.equal(el.path.getAttribute('d'), d);
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
