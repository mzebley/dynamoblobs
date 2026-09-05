import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { measureDriftGeometry, subscribeDriftGeometry } from '../src/driftGeometry.js';

function fixture({ resizeObserver = true } = {}) {
  const dom = new JSDOM('<!doctype html><body><section><div></div><div></div></section><aside></aside></body>');
  const { window } = dom;
  let time = 0;
  Object.defineProperty(window.performance, 'now', { value: () => time });
  const observers = [];
  if (resizeObserver) window.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.nodes = new Set(); observers.push(this); }
    observe(node) { this.nodes.add(node); }
    unobserve(node) { this.nodes.delete(node); }
    disconnect() { this.nodes.clear(); }
  };
  const parent = window.document.querySelector('section');
  const other = window.document.querySelector('aside');
  const [a, b] = parent.children;
  const counts = new Map();
  const sizes = new Map();
  for (const [node, width, height] of [[parent, 1000, 800], [other, 400, 300], [a, 100, 90], [b, 80, 70]]) {
    sizes.set(node, { width, height });
    counts.set(node, 0);
    for (const [property, dimension] of [['offsetWidth', 'width'], ['offsetHeight', 'height']]) {
      Object.defineProperty(node, property, { configurable: true, get() { counts.set(node, counts.get(node) + 1); return sizes.get(node)[dimension]; } });
    }
  }
  let relation = parent;
  for (const node of [a, b]) Object.defineProperty(node, 'offsetParent', { get: () => relation });
  return {
    dom, window, parent, other, a, b, counts, sizes, observers,
    advance: ms => { time += ms; }, relation: node => { relation = node; },
    resize: (...nodes) => observers[0].callback(nodes.map(target => ({ target }))),
  };
}

const microtasks = () => new Promise(resolve => queueMicrotask(resolve));

test('shares container reads, batches resize invalidation, and avoids steady dimension reads', () => {
  const f = fixture();
  const a = subscribeDriftGeometry(f.a);
  const b = subscribeDriftGeometry(f.b);
  assert.deepEqual(a.read(), { w: 100, h: 90, pw: 1000, ph: 800 });
  assert.equal(f.counts.get(f.parent), 2);
  const initial = [...f.counts.values()];
  for (let frame = 0; frame < 120; frame++) { f.advance(16); a.read(); b.read(); }
  assert.deepEqual([...f.counts.values()], initial);
  f.sizes.get(f.parent).width = 1200;
  f.sizes.get(f.b).height = 75;
  f.resize(f.parent, f.b);
  assert.equal(a.read().pw, 1200);
  const afterFlush = [...f.counts.values()];
  assert.equal(b.read().h, 75);
  assert.deepEqual([...f.counts.values()], afterFlush);
  a.release(); b.release();
  assert.equal(f.observers[0].nodes.size, 0);
  f.dom.window.close();
});

test('invalidates ancestor and stylesheet changes but ignores per-frame host transforms', async () => {
  const f = fixture();
  const handle = subscribeDriftGeometry(f.a);
  const initial = [...f.counts.values()];
  f.a.style.transform = 'translate3d(2px, 3px, 0)';
  await microtasks();
  handle.read();
  assert.deepEqual([...f.counts.values()], initial);
  f.relation(f.other);
  f.parent.className = 'static';
  await microtasks();
  assert.equal(handle.read().pw, 400);
  f.sizes.get(f.other).width = 500;
  const style = f.window.document.createElement('style');
  style.textContent = 'aside { width: 500px; }';
  f.window.document.head.append(style);
  await microtasks();
  assert.equal(handle.read().pw, 500);
  handle.release();
  f.dom.window.close();
});

test('checks silent containing-block changes and throttles full sampling only without ResizeObserver', () => {
  for (const resizeObserver of [true, false]) {
    const f = fixture({ resizeObserver });
    const handle = subscribeDriftGeometry(f.a);
    f.relation(f.other);
    f.advance(251);
    assert.equal(handle.read().pw, 400);
    f.sizes.get(f.other).width = 600;
    f.advance(251);
    assert.equal(handle.read().pw, resizeObserver ? 400 : 600);
    assert.equal(handle.refresh().pw, 600);
    handle.release();
    f.dom.window.close();
  }
});

test('observes composed ancestors and releases roots and node references after the final subscriber', async () => {
  const f = fixture();
  const root = f.parent.attachShadow({ mode: 'open' });
  root.append(f.a);
  const handle = subscribeDriftGeometry(f.a);
  f.relation(f.other);
  f.parent.style.position = 'static';
  await microtasks();
  assert.equal(handle.read().pw, 400);
  handle.release(); handle.release();
  assert.equal(f.observers[0].nodes.size, 0);
  const reads = [...f.counts.values()];
  f.window.dispatchEvent(new f.window.Event('resize'));
  f.parent.className = 'changed';
  await microtasks();
  handle.read();
  assert.deepEqual([...f.counts.values()], reads);
  const next = subscribeDriftGeometry(f.a);
  assert.equal(f.observers.length, 2, 'last release discarded the service');
  next.release();
  f.dom.window.close();
});

test('provides synchronous one-off measurements without observers', () => {
  const f = fixture();
  assert.deepEqual(measureDriftGeometry(f.a), { w: 100, h: 90, pw: 1000, ph: 800 });
  assert.equal(f.observers.length, 0);
  f.dom.window.close();
});
