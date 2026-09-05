import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { JSDOM } from 'jsdom';

// These tests drive the morph loop with a controllable clock + rAF pump (unlike
// dynamoblob-element.test.js, which stubs rAF to never fire and only asserts
// play/pause state). They cover two regressions:
//   1. changing variance/points mid-morph must never blank the blob, and
//   2. pause -> resume must continue the exact same tween (no jump), with no
//      progress drift across repeated pause/resume.

let DynamoBlob;
let document;
let now = 0;
let rafQueue = new Map();
let rafId = 0;

before(async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
  });
  const { window } = dom;

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.customElements = window.customElements;
  globalThis.CustomEvent = window.CustomEvent;

  // Controllable clock so progress is deterministic and pauses can be "long".
  globalThis.performance = { now: () => now };

  // rAF pump: hold callbacks until frame() flushes them with the current clock.
  globalThis.requestAnimationFrame = (cb) => {
    const id = ++rafId;
    rafQueue.set(id, cb);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    rafQueue.delete(id);
  };

  window.matchMedia = (query) => ({
    matches: false,
    media: query,
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

beforeEach(() => {
  now = 0;
  rafQueue = new Map();
  rafId = 0;
});

afterEach(() => {
  document.body.replaceChildren();
});

after(() => {
  for (const k of [
    'window', 'document', 'HTMLElement', 'customElements', 'CustomEvent',
    'performance', 'requestAnimationFrame', 'cancelAnimationFrame',
  ]) delete globalThis[k];
});

// Advance the clock by `ms` and run every frame currently queued. Callbacks the
// morph loop re-schedules land in a fresh queue, so they run on the next frame()
// (mirroring how the browser drives one rAF per paint).
function frame(ms) {
  now += ms;
  const cbs = [...rafQueue.values()];
  rafQueue = new Map();
  for (const cb of cbs) cb(now);
}

function makeBlob(attrs = {}) {
  const el = document.createElement('dynamo-blob');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.appendChild(el);
  return el;
}

const countPts = (d) => (typeof d === 'string' ? (d.match(/Q/g) || []).length : 0);

describe('retuning shape mid-morph', () => {
  it('never blanks the blob when variance changes while morphing', () => {
    const el = makeBlob({
      'data-blob-seed': '123456',
      'data-blob-points': '10',
      'data-blob-variance': '8',
    });
    el.playMorph(1000);
    frame(16);
    frame(400); // mid-tween

    el.setAttribute('data-blob-variance', '3'); // triggers _retuneShape

    // Drive several full morph cycles; the path must always stay a real shape.
    for (let i = 0; i < 40; i++) {
      frame(200);
      const d = el.path.getAttribute('d');
      assert.ok(d && d.trim() !== '', `frame ${i}: path d is empty`);
      assert.ok(countPts(d) >= 3, `frame ${i}: degenerate path (${countPts(d)} pts)`);
    }
  });

  it('never blanks the blob when point count changes while morphing', () => {
    const el = makeBlob({
      'data-blob-seed': 'abcdef',
      'data-blob-points': '10',
      'data-blob-variance': '8',
    });
    el.playMorph(1000);
    frame(16);
    frame(400);

    el.setAttribute('data-blob-points', '5');

    for (let i = 0; i < 40; i++) {
      frame(200);
      const d = el.path.getAttribute('d');
      assert.ok(d && d.trim() !== '', `frame ${i}: path d is empty`);
      assert.ok(countPts(d) >= 3, `frame ${i}: degenerate path`);
    }
  });
});

describe('tween lifecycle bookkeeping', () => {
  it('changing data-blob-points morphs to the new vertex count', () => {
    // Regression: the auto-written data-blob-seed was read back as a user seed,
    // so the retune targeted the on-screen shape and points changes were no-ops.
    const el = makeBlob({ 'data-blob-points': '10' });
    assert.equal(countPts(el.path.getAttribute('d')), 10);

    el.setAttribute('data-blob-points', '5');
    for (let i = 0; i < 60; i++) frame(16); // complete the 600ms retune tween
    assert.equal(countPts(el.path.getAttribute('d')), 5);
  });

  it('generateNewBlob still works after a retune tween completes', () => {
    // Regression: animateBlob left a stale animationFrameId behind on
    // completion, which generateNewBlob read as "tween in flight" forever.
    const el = makeBlob();
    el.setAttribute('data-blob-variance', '4'); // retune tween (600ms)
    for (let i = 0; i < 60; i++) frame(16);
    assert.equal(el.animationFrameId, null);

    const before = el.path.getAttribute('d');
    el.generateNewBlob(100);
    assert.ok(el.isGeneratingBlob, 'generateNewBlob was blocked by a stale frame id');
    for (let i = 0; i < 20; i++) frame(16);
    assert.equal(el.isGeneratingBlob, false);
    // ...and it must be a *visible* shuffle, not a tween to the same shape
    // (a completed retune leaves currentPath === targetPath).
    assert.notEqual(el.path.getAttribute('d'), before);
  });

  it('a retune superseding an in-flight generateNewBlob does not wedge it', () => {
    const el = makeBlob();
    el.generateNewBlob(500);
    frame(16); // mid-tween
    el.setAttribute('data-blob-variance', '3'); // supersedes the tween
    assert.equal(el.isGeneratingBlob, false);

    for (let i = 0; i < 60; i++) frame(16); // let the retune tween finish
    el.generateNewBlob(100);
    assert.ok(el.isGeneratingBlob, 'generateNewBlob stayed wedged after being superseded');
    for (let i = 0; i < 20; i++) frame(16);
  });

  it('clamps a non-positive morph duration instead of looping forever', () => {
    const el = makeBlob();
    el.playMorph(-100);
    // Each 1ms (clamped) cycle takes two frames: one to establish startTime,
    // one to complete. A negative duration used to make progress never reach 1,
    // so the loop would spin without ever advancing the shape.
    frame(16);
    frame(16); // first cycle completes
    assert.ok(el.isMorphing);
    const d1 = el.path.getAttribute('d');
    frame(16);
    frame(16); // second cycle completes -> a new silhouette
    assert.notEqual(el.path.getAttribute('d'), d1);
  });
});

describe('pause / resume continuity', () => {
  it('resumes the exact frozen frame regardless of pause duration', () => {
    const el = makeBlob({
      'data-blob-seed': '777',
      'data-blob-points': '10',
      'data-blob-variance': '8',
    });
    el.playMorph(1000);
    frame(16);
    frame(384); // now 40% through the 1000ms tween

    const frozen = el.path.getAttribute('d');
    el.pauseMorph();

    now += 100000; // a long pause must not advance the morph
    el.playMorph(1000);
    frame(16); // first frame back

    assert.equal(
      el.path.getAttribute('d'),
      frozen,
      'resume jumped instead of continuing the frozen tween',
    );
  });

  it('does not drift progress across repeated pause/resume', () => {
    const el = makeBlob({
      'data-blob-seed': '777',
      'data-blob-points': '10',
      'data-blob-variance': '8',
    });
    el.playMorph(1000);
    frame(16);
    frame(384); // 40%
    const frozen = el.path.getAttribute('d');

    // Toggle several times without ever completing the tween. The old code's
    // elapsedTime += ... double-counted, ballooning progress toward completion.
    for (let i = 0; i < 5; i++) {
      el.pauseMorph();
      now += 5000;
      el.playMorph(1000);
      frame(0); // re-establish startTime at the same progress, no time passes
    }

    assert.equal(
      el.path.getAttribute('d'),
      frozen,
      'progress drifted across repeated pause/resume',
    );
  });
});

describe('runtime transition regressions', () => {
  it('freezes standalone generation and retunes, and reports transient motion', () => {
    const el = makeBlob({ 'data-blob-wobble-autoplay': 'false' });
    for (const start of [() => el.generateNewBlob(1000), () => el.setAttribute('data-blob-variance', '12')]) {
      start();
      assert.equal(el.isMorphing, true);
      assert.equal(el.isAnimating, true);
      frame(16); frame(200);
      const frozen = el.path.getAttribute('d');
      el.pause();
      frame(500);
      assert.equal(el.path.getAttribute('d'), frozen);
      assert.equal(el.isAnimating, false);
      assert.equal(rafQueue.size, 0);
    }
  });

  it('does not schedule after removal and reconnects without resetting the frame', () => {
    const el = makeBlob();
    el.playMorph(1000);
    frame(16); frame(300);
    const visible = el.path.getAttribute('d');
    el.remove();
    el.playMorph().playDrift().generateNewBlob();
    assert.equal(rafQueue.size, 0);
    document.body.append(el);
    assert.equal(el.path.getAttribute('d'), visible);
    frame(0);
    assert.equal(el.path.getAttribute('d'), visible);
  });

  it('takes over a standalone tween and retimes a live morph without jumping', () => {
    const el = makeBlob();
    el.generateNewBlob(1000);
    frame(16); frame(300);
    const visible = el.path.getAttribute('d');
    el.playMorph(1000);
    frame(0);
    assert.equal(el.path.getAttribute('d'), visible);
    frame(200);
    const retimed = el.path.getAttribute('d');
    el.playMorph(200);
    frame(0);
    assert.equal(el.path.getAttribute('d'), retimed);
    assert.equal(el._morphDuration, 200);
    el.playMorph(Infinity);
    assert.ok(Number.isFinite(el._morphDuration));
  });

  it('keeps independent imperative settings and restores zero or paused drift speed', () => {
    const el = makeBlob();
    el.playWobble(1234).playDrift(4);
    el.setAttribute('data-blob-morph-intensity', '2');
    assert.equal(el.style.getPropertyValue('--dynamo-blob-time'), '1234ms');
    assert.equal(el.driftSpeed, 4);
    el.playDrift(0).playDrift(2);
    assert.ok(Math.hypot(el.driftVelX, el.driftVelY) > 0);
    el.pauseDrift();
    el.setAttribute('data-blob-drift-speed', '5');
    el.playDrift();
    assert.ok(Math.abs(Math.hypot(el.driftVelX, el.driftVelY) - Math.SQRT2 * 0.5) < 1e-12);
  });

  it('moves the same distance over the same elapsed time at different frame rates', () => {
    const distance = (fps) => {
      const el = makeBlob();
      el.driftBounds = () => ({ w: 100, h: 100, pw: 10000, ph: 10000 });
      el.setAttribute('data-blob-drift-start-position', 'center');
      el.playDrift(1);
      const start = el.driftPosX;
      for (let i = 0; i < fps; i++) frame(1000 / fps);
      const result = Math.abs(el.driftPosX - start);
      el.remove();
      return result;
    };
    assert.ok(Math.abs(distance(60) - distance(120)) < 1e-8);
  });

  it('repositions initialized drift live and keeps current position when requested', () => {
    const el = makeBlob();
    el.driftBounds = () => ({ w: 100, h: 100, pw: 1000, ph: 800 });
    el.playDrift();
    el.setAttribute('data-blob-drift-start-position', 'center');
    assert.equal(el.driftPosX, 450);
    assert.equal(el.driftPosY, 350);
    el.setAttribute('data-blob-drift-start-position', 'current');
    assert.equal(el.driftPosX, 450);
    assert.equal(el.driftPosY, 350);
  });

  it('gates live automatic motion, follows preference changes, and preserves explicit overrides', () => {
    const listeners = new Set();
    const query = { matches: true, addEventListener: (_, cb) => listeners.add(cb), removeEventListener: (_, cb) => listeners.delete(cb) };
    const previous = window.matchMedia;
    window.matchMedia = () => query;
    try {
      const el = makeBlob({ 'data-blob-wobble-autoplay': 'false' });
      el.setAttribute('data-blob-morph-autoplay', 'true');
      el.setAttribute('data-blob-drift-autoplay', 'true');
      assert.equal(el.isAnimating, false);
      query.matches = false;
      for (const cb of listeners) cb();
      assert.equal(el.isMorphing, true);
      assert.equal(el.isDrifting, true);
      el.setAttribute('data-blob-morph-speed', '250');
      query.matches = true;
      for (const cb of listeners) cb();
      assert.equal(el.isMorphing, false);
      query.matches = false;
      for (const cb of listeners) cb();
      assert.equal(el.isMorphing, true);
      el.pauseMorph();
      el.playDrift();
      query.matches = true;
      for (const cb of listeners) cb();
      assert.equal(el.isMorphing, false);
      assert.equal(el.isDrifting, true);
      query.matches = false;
      for (const cb of listeners) cb();
      assert.equal(el.isMorphing, false);
      el.pause();
      el.setAttribute('data-blob-wobble-autoplay', 'true');
      assert.equal(el.isAnimating, false);
      el.play();
      assert.equal(el.isWobbling, true);
      el.remove();
      assert.equal(listeners.size, 0);
    } finally { window.matchMedia = previous; }
  });

  it('installs one stylesheet in each containing shadow root', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    root.append(document.createElement('dynamo-blob'), document.createElement('dynamo-blob'));
    assert.equal(root.querySelectorAll('#dynamoblobs-styles').length, 1);
  });

  it('requires Space keydown and cancels activation on blur', () => {
    const el = makeBlob({ 'data-blob-drift-click': 'true' });
    let clicks = 0;
    el.addEventListener('click', () => clicks++);
    const key = (type) => el.dispatchEvent(new window.KeyboardEvent(type, { key: ' ', bubbles: true }));
    key('keyup');
    assert.equal(clicks, 0);
    key('keydown');
    el.dispatchEvent(new window.Event('blur'));
    key('keyup');
    assert.equal(clicks, 0);
    key('keydown'); key('keyup');
    assert.equal(clicks, 1);
  });
});


describe('motion ownership across configuration and disconnection', () => {
  it('keeps a standalone tween standalone after reconnect and applies only detached edits', () => {
    const el = makeBlob({ 'data-blob-wobble-autoplay': 'false' });
    el.playWobble(1234).pauseWobble().generateNewBlob(1000);
    frame(16); frame(200);
    el.remove();
    el.setAttribute('data-blob-points', '5');
    document.body.append(el);
    assert.equal(el._morphing, false);
    assert.equal(el.points, 5);
    assert.equal(el.style.getPropertyValue('--dynamo-blob-time'), '1234ms');
    frame(16); frame(1000);
    assert.equal(rafQueue.size, 0);
    el.playMorph();
    el.remove();
    el.pause();
    document.body.append(el);
    assert.equal(el.isAnimating, false);
  });

  it('keeps pause idempotent and unrelated autoplay edits independent', () => {
    const el = makeBlob({ 'data-blob-wobble-autoplay': 'false' });
    el.generateNewBlob(1000);
    frame(16); frame(200);
    el.setAttribute('data-blob-drift-autoplay', 'true');
    assert.equal(el.isGeneratingBlob, true);
    el.playMorph(1000);
    frame(16); frame(200);
    el.pauseMorph();
    const fraction = el._morphProgress;
    el.pauseMorph();
    assert.equal(el._morphProgress, fraction);
    el.pause();
    el.setAttribute('data-blob-is-animating', 'false');
    el.setAttribute('data-blob-morph-autoplay', 'true');
    assert.equal(el.isAnimating, false);
  });
});


it('preserves detached seed edits and rebuilds removed internal nodes with the visible shape', () => {
  const el = makeBlob({ 'data-blob-wobble-autoplay': 'false' });
  el.generateNewBlob(1000);
  frame(16); frame(200);
  const visible = el.path.getAttribute('d');
  el.remove();
  el.replaceChildren();
  document.body.append(el);
  assert.equal(el.path.getAttribute('d'), visible);
  el.remove();
  el.setAttribute('data-blob-seed', 'new-authored-seed');
  document.body.append(el);
  assert.equal(el.getAttribute('data-blob-seed'), 'new-authored-seed');
  assert.equal(el.seedString, 'new-authored-seed');
});
