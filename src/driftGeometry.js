// Active drift instances share geometry reads. Observers only invalidate; the
// first drift read flushes every dirty box before that frame's transform writes.
const services = new WeakMap();
const RELATION_CHECK_MS = 250;

function composedParent(node) {
  return node.assignedSlot || node.parentElement || node.getRootNode?.().host || null;
}

function containingBlock(element) {
  return element.offsetParent || composedParent(element);
}

function dimensions(node) {
  if (!node) return { w: 0, h: 0 };
  return { w: node.offsetWidth || node.clientWidth || 0, h: node.offsetHeight || node.clientHeight || 0 };
}

export function measureDriftGeometry(element) {
  const host = dimensions(element);
  const parent = dimensions(containingBlock(element));
  return { w: host.w, h: host.h, pw: parent.w, ph: parent.h };
}

function ancestors(element) {
  const result = new Set();
  for (let node = element; node; node = composedParent(node)) result.add(node);
  return result;
}

function withoutTransform(style) {
  return (style || '').replace(/(?:^|;)\s*transform\s*:[^;]*(?=;|$)/gi, '').replace(/^;|;$/g, '').trim();
}

function createService(document) {
  const view = document.defaultView;
  const entries = new Map();
  const boxes = new Map();
  let nextRelationCheck = 0;
  let dirty = true;
  let observedRoots = new Set();
  const now = () => view?.performance?.now() ?? Date.now();
  const resizeObserver = view?.ResizeObserver ? new view.ResizeObserver(records => {
    for (const record of records) {
      const box = boxes.get(record.target);
      if (box) { box.dirty = true; dirty = true; }
    }
  }) : null;

  function invalidateAll() {
    dirty = true;
    for (const entry of entries.values()) entry.relationDirty = true;
    for (const box of boxes.values()) box.dirty = true;
  }

  function onStyleLoad(event) {
    if (event.target?.matches?.('link[rel="stylesheet"]')) invalidateAll();
  }

  const mutationObserver = view?.MutationObserver ? new view.MutationObserver(records => {
    for (const record of records) {
      // Drift owns only transform. Its per-frame writes cannot invalidate the
      // cached layout, but an authored width/position/style change still does.
      if (record.type === 'attributes' && record.attributeName === 'style' && entries.has(record.target) &&
          withoutTransform(record.oldValue) === withoutTransform(record.target.getAttribute('style'))) continue;
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      const stylesheet = target?.closest?.('style,link[rel="stylesheet"]') ||
        [...(record.addedNodes || []), ...(record.removedNodes || [])].some(node =>
          node.nodeType === 1 && (node.matches('style,link[rel="stylesheet"]') || node.querySelector('style,link[rel="stylesheet"]')));
      for (const entry of entries.values()) {
        if (stylesheet || entry.ancestors.has(target)) {
          dirty = true;
          entry.relationDirty = true;
          boxes.get(entry.element).dirty = true;
          if (entry.parent) boxes.get(entry.parent).dirty = true;
        }
      }
    }
  }) : null;

  function retainBox(node) {
    if (!node) return;
    let box = boxes.get(node);
    if (!box) {
      box = { users: 0, dirty: true, w: 0, h: 0 };
      boxes.set(node, box);
      resizeObserver?.observe(node, { box: 'border-box' });
    }
    box.users++;
  }

  function releaseBox(node) {
    const box = boxes.get(node);
    if (!box || --box.users) return;
    resizeObserver?.unobserve(node);
    boxes.delete(node);
  }

  function observeRoots() {
    if (!mutationObserver) return;
    const roots = new Set([document]);
    for (const entry of entries.values()) {
      for (const node of entry.ancestors) roots.add(node.getRootNode());
    }
    if (roots.size === observedRoots.size && [...roots].every(root => observedRoots.has(root))) return;
    mutationObserver.disconnect();
    for (const root of observedRoots) if (!roots.has(root)) root.removeEventListener('load', onStyleLoad, true);
    for (const root of roots) if (!observedRoots.has(root)) root.addEventListener('load', onStyleLoad, true);
    for (const root of roots) mutationObserver.observe(root, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeOldValue: true,
      attributeFilter: ['class', 'style', 'hidden', 'href', 'rel', 'media', 'disabled', 'slot'],
    });
    observedRoots = roots;
  }

  function updateRelation(entry) {
    const parent = containingBlock(entry.element);
    if (parent !== entry.parent) {
      releaseBox(entry.parent);
      entry.parent = parent;
      retainBox(parent);
      boxes.get(entry.element).dirty = true;
    }
    entry.ancestors = ancestors(entry.element);
    entry.relationDirty = false;
  }

  function flush() {
    const timestamp = now();
    if (!dirty && timestamp < nextRelationCheck) return;
    if (timestamp >= nextRelationCheck) {
      // CSSOM insertRule/adoptedStyleSheets changes produce no DOM mutation.
      // Check the relation at a bounded shared cadence, without re-reading
      // dimensions when ResizeObserver reports no size changes.
      for (const entry of entries.values()) entry.relationDirty = true;
      if (!resizeObserver) for (const box of boxes.values()) box.dirty = true;
      nextRelationCheck = timestamp + RELATION_CHECK_MS;
    }
    let relationsChanged = false;
    for (const entry of entries.values()) {
      if (!entry.relationDirty) continue;
      updateRelation(entry);
      relationsChanged = true;
    }
    if (relationsChanged) observeRoots();
    for (const [node, box] of boxes) {
      if (!box.dirty) continue;
      Object.assign(box, dimensions(node), { dirty: false });
    }
    for (const entry of entries.values()) {
      const host = boxes.get(entry.element);
      const parent = boxes.get(entry.parent);
      entry.bounds = { w: host.w, h: host.h, pw: parent?.w || 0, ph: parent?.h || 0 };
    }
    dirty = false;
  }

  view?.addEventListener('resize', invalidateAll);

  return {
    subscribe(element) {
      let entry = entries.get(element);
      if (!entry) {
        entry = { element, parent: null, relationDirty: true, ancestors: new Set(), users: 0, bounds: null };
        entries.set(element, entry);
        dirty = true;
        retainBox(element);
      }
      entry.users++;
      flush();
      let released = false;
      return {
        read() {
          if (!released) flush();
          return entry.bounds;
        },
        refresh() {
          if (!released) {
            dirty = true;
            entry.relationDirty = true;
            boxes.get(element).dirty = true;
            if (entry.parent) boxes.get(entry.parent).dirty = true;
            flush();
          }
          return entry.bounds;
        },
        release() {
          if (released) return;
          released = true;
          if (--entry.users) return;
          entries.delete(element);
          releaseBox(element);
          releaseBox(entry.parent);
          if (entries.size) observeRoots();
          else {
            resizeObserver?.disconnect();
            mutationObserver?.disconnect();
            view?.removeEventListener('resize', invalidateAll);
            for (const root of observedRoots) root.removeEventListener('load', onStyleLoad, true);
            boxes.clear();
            observedRoots.clear();
            services.delete(document);
          }
        },
      };
    },
  };
}

export function subscribeDriftGeometry(element) {
  const document = element.ownerDocument;
  let service = services.get(document);
  if (!service) {
    service = createService(document);
    services.set(document, service);
  }
  return service.subscribe(element);
}
