(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Dynamoblobs = {}));
})(this, (function (exports) { 'use strict';

  // dynamoblobs — dependency-free generative SVG blobs as a custom element.
  //
  // <dynamo-blob> renders a closed, organic SVG path that:
  //   • generates a fresh silhouette every render (seedable for reproducibility),
  //   • wobbles continuously via CSS (turn / skew / scale),
  //   • can morph between silhouettes on a loop via JS path interpolation,
  //   • can drift around a positioned parent ("DVD"-style) and deflect on click.
  //
  // It lives in the light DOM, inherits `fill` from your CSS, is `aria-hidden`,
  // honors `prefers-reduced-motion`, and is SSR-safe (everything DOM-y is guarded).

  // ---------------------------------------------------------------------------
  // Internal geometry. The blob is drawn in a fixed coordinate space and scaled
  // to the host element, so `variance` is resolution-independent and the host
  // controls size purely with CSS.
  // ---------------------------------------------------------------------------
  const VIEW = 100;
  const CENTER = VIEW / 2;
  const BASE_RADIUS = 30; // leaves headroom for variance + wobble inside 0..100

  const STYLE_ID = "dynamoblobs-styles";

  const BLOB_CSS = `
.dynamo-blob-host {
  display: block;
  overflow: visible;
  pointer-events: none;
}
.dynamo-blob-host[data-blob-clickable] { pointer-events: auto; cursor: pointer; }
.dynamo-blob-host[data-blob-drifting] {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
}
.dynamo-blob__turn {
  display: block;
  width: 100%;
  height: 100%;
  transform-origin: center;
  will-change: transform;
  animation: dynamo-blob-turn var(--dynamo-blob-time, 30s) linear infinite;
}
.dynamo-blob__skew {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  transform-origin: center;
  transform-box: fill-box;
  will-change: transform;
  animation: dynamo-blob-skew calc(var(--dynamo-blob-time, 30s) * 0.5) linear infinite;
}
.dynamo-blob__scale {
  transform-origin: center;
  transform-box: fill-box;
  will-change: transform;
  animation: dynamo-blob-scale calc(var(--dynamo-blob-time, 30s) * 0.5) ease-in-out infinite;
}
.dynamo-blob__path { fill: inherit; }
.dynamo-blob-host[data-blob-wobble="false"] .dynamo-blob__turn,
.dynamo-blob-host[data-blob-wobble="false"] .dynamo-blob__skew,
.dynamo-blob-host[data-blob-wobble="false"] .dynamo-blob__scale { animation: none; }
.dynamo-blob-host[data-blob-paused] .dynamo-blob__turn,
.dynamo-blob-host[data-blob-paused] .dynamo-blob__skew,
.dynamo-blob-host[data-blob-paused] .dynamo-blob__scale { animation-play-state: paused; }
@keyframes dynamo-blob-turn { to { transform: rotate(360deg); } }
@keyframes dynamo-blob-skew {
  0%   { transform: skewY(0deg); }
  13%  { transform: skewY(calc(1.8deg * var(--dynamo-blob-amount, 2))); }
  18%  { transform: skewY(calc(2.2deg * var(--dynamo-blob-amount, 2))); }
  24%  { transform: skewY(calc(2.48deg * var(--dynamo-blob-amount, 2))); }
  25%  { transform: skewY(calc(2.5deg * var(--dynamo-blob-amount, 2))); }
  26%  { transform: skewY(calc(2.48deg * var(--dynamo-blob-amount, 2))); }
  32%  { transform: skewY(calc(2.2deg * var(--dynamo-blob-amount, 2))); }
  37%  { transform: skewY(calc(1.8deg * var(--dynamo-blob-amount, 2))); }
  50%  { transform: skewY(0deg); }
  63%  { transform: skewY(calc(-1.8deg * var(--dynamo-blob-amount, 2))); }
  68%  { transform: skewY(calc(-2.2deg * var(--dynamo-blob-amount, 2))); }
  74%  { transform: skewY(calc(-2.48deg * var(--dynamo-blob-amount, 2))); }
  75%  { transform: skewY(calc(-2.5deg * var(--dynamo-blob-amount, 2))); }
  76%  { transform: skewY(calc(-2.48deg * var(--dynamo-blob-amount, 2))); }
  82%  { transform: skewY(calc(-2.2deg * var(--dynamo-blob-amount, 2))); }
  87%  { transform: skewY(calc(-1.8deg * var(--dynamo-blob-amount, 2))); }
  100% { transform: skewY(0deg); }
}
@keyframes dynamo-blob-scale {
  0%   { transform: scaleX(0.9) scaleY(1); }
  25%  { transform: scaleX(0.9) scaleY(0.9); }
  50%  { transform: scaleX(1) scaleY(0.9); }
  75%  { transform: scaleX(0.9) scaleY(0.9); }
  100% { transform: scaleX(0.9) scaleY(1); }
}
@media (prefers-reduced-motion: reduce) {
  .dynamo-blob__turn,
  .dynamo-blob__skew,
  .dynamo-blob__scale { animation: none; }
}
`;

  function ensureBlobStyles() {
    if (typeof document === "undefined" || !document.head) return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = BLOB_CSS;
    document.head.appendChild(style);
  }

  function prefersReducedMotion() {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function isTruthyAttr(value) {
    return (
      typeof value === "string" &&
      ["", "true", "1", "yes", "on"].includes(value.trim().toLowerCase())
    );
  }

  class DynamoBlob extends HTMLElement {
    static get observedAttributes() {
      return [
        "data-blob-points",
        "data-blob-variance",
        "data-blob-seed",
        "data-blob-morph",
        "data-blob-speed",
        "data-blob-animate",
        "data-blob-wobble-speed",
        "data-blob-wobble-amount",
        "data-blob-drift",
        "data-blob-drift-speed",
        "data-blob-click",
        "data-blob-paused",
      ];
    }

    constructor() {
      super();

      // Morph state
      this.isAnimating = false;
      this.animationFrameId = null;
      this.elapsedTime = 0;
      this.startTime = null;
      this.isGeneratingBlob = false;
      this.currentPath = null;
      this.targetPath = null;
      this.pendingPath = null;

      // Drift state
      this.driftFrameId = null;
      this.driftPosX = 0;
      this.driftPosY = 0;
      this.driftVelX = 0;
      this.driftVelY = 0;
      this.driftInitialized = false;

      this.intersectionObserver = null;
      this.random = Math.random;
      this.seedString = null;
      this.driftSpeed = 1.25;
      this.morphMs = 600;
      this._connected = false;
      this._hasUserSeed = false;
      this._writingSeed = null;
      this._seedPath = null;

      this.play = this.play.bind(this);
      this.pause = this.pause.bind(this);
      this.generateNewBlob = this.generateNewBlob.bind(this);
      this.deflect = this.deflect.bind(this);
      this._onClick = () => this.deflect();
    }

    connectedCallback() {
      ensureBlobStyles();
      this.classList.add("dynamo-blob-host");
      this.setAttribute("aria-hidden", "true");

      const id = this.id || Math.random().toString(36).slice(2, 8);

      this._readConfig();

      // Initial silhouettes
      this.currentPath = this._seedPath || this.generatePathString();
      this.updateSeedAttribute(this.currentPath);
      this.targetPath = this.generatePathString();

      this.innerHTML = `
      <div class="dynamo-blob__turn">
        <svg
          class="dynamo-blob__skew"
          viewBox="0 0 ${VIEW} ${VIEW}"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          role="presentation"
          id="${id}"
        >
          <g class="dynamo-blob__scale">
            <path class="dynamo-blob__path" d="${this.currentPath}"></path>
          </g>
        </svg>
      </div>
    `;
      this.svg = this.querySelector("svg");
      this.path = this.querySelector("path");

      this._applyClick();

      // Viewport-triggered regeneration
      const observeAttr = this.getAttribute("data-blob-observe");
      if (observeAttr) this.setupIntersectionObserver(observeAttr);

      // Drift
      if (isTruthyAttr(this.getAttribute("data-blob-drift")) && !prefersReducedMotion()) {
        this.startDrift();
      }

      // Auto-animate the morph loop
      if (this.getAttribute("data-blob-animate") === "true" && !prefersReducedMotion()) {
        this.play();
      }

      this._connected = true;
    }

    // Attributes are reactive: change one and the element re-tunes in place.
    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue || !this._connected) return;
      switch (name) {
        case "data-blob-points":
        case "data-blob-variance":
          this._readConfig();
          this._retuneShape();
          break;
        case "data-blob-seed":
          if (newValue === this._writingSeed) return; // ignore our own write-back
          this._readConfig();
          this._retuneShape();
          break;
        case "data-blob-morph":
          this._readConfig();
          break;
        case "data-blob-drift-speed": {
          const prev = this.driftSpeed;
          this._readConfig();
          if (this.driftFrameId && prev) {
            const ratio = this.driftSpeed / prev;
            this.driftVelX *= ratio;
            this.driftVelY *= ratio;
          }
          break;
        }
        case "data-blob-wobble-speed":
        case "data-blob-wobble-amount":
          this._applyWobbleVars();
          break;
        case "data-blob-speed":
          this._readConfig();
          if (this.isAnimating) {
            this.pause();
            this.play();
          }
          break;
        case "data-blob-animate":
          if (newValue === "true" && !prefersReducedMotion()) this.play();
          else this.pause();
          break;
        case "data-blob-drift":
          if (isTruthyAttr(newValue) && !prefersReducedMotion()) this.startDrift();
          else this.stopDrift();
          break;
        case "data-blob-click":
          this._applyClick();
          break;
        case "data-blob-paused":
          if (newValue !== null && newValue !== "false") {
            this.stopDrift();
            this.pause();
          } else {
            if (isTruthyAttr(this.getAttribute("data-blob-drift")) && !prefersReducedMotion())
              this.startDrift();
            if (this.getAttribute("data-blob-animate") === "true" && !prefersReducedMotion())
              this.play();
          }
          break;
      }
    }

    _readConfig() {
      const pointsAttr = parseInt(this.getAttribute("data-blob-points"), 10);
      this.points = Number.isFinite(pointsAttr) ? Math.max(3, pointsAttr) : 10;

      const varianceAttr = parseFloat(this.getAttribute("data-blob-variance"));
      this.variance = Number.isFinite(varianceAttr) ? varianceAttr : 8;

      this.speed = parseFloat(this.getAttribute("data-blob-speed")) || 7500;

      const morphAttr = parseFloat(this.getAttribute("data-blob-morph"));
      this.morphMs = Number.isFinite(morphAttr) ? morphAttr : 600;

      const driftAttr = parseFloat(this.getAttribute("data-blob-drift-speed"));
      this.driftSpeed = Number.isFinite(driftAttr) ? driftAttr : 1.25;

      // Seed: a decodable path reproduces an exact shape; any other non-empty
      // string deterministically drives generation; otherwise it's random.
      const seedAttr = this.getAttribute("data-blob-seed");
      const hasSeed = typeof seedAttr === "string" && seedAttr.trim() !== "";
      this._hasUserSeed = hasSeed && seedAttr !== this._writingSeed;
      if (hasSeed) {
        const decoded = decodeBlobSeed(seedAttr);
        if (decoded && decoded.trim().startsWith("M")) {
          this._seedPath = decoded;
          this.seedString = null;
        } else {
          this._seedPath = null;
          this.seedString = seedAttr;
        }
      } else {
        this._seedPath = null;
        this.seedString = null;
      }

      this._applyWobbleVars();
    }

    _applyWobbleVars() {
      const wobbleSpeed = parseFloat(this.getAttribute("data-blob-wobble-speed"));
      this.style.setProperty(
        "--dynamo-blob-time",
        `${Number.isFinite(wobbleSpeed) ? wobbleSpeed : 30}s`,
      );
      const wobbleAmount = parseFloat(this.getAttribute("data-blob-wobble-amount"));
      this.style.setProperty(
        "--dynamo-blob-amount",
        String(Number.isFinite(wobbleAmount) ? wobbleAmount : 2),
      );
    }

    _applyClick() {
      if (isTruthyAttr(this.getAttribute("data-blob-click"))) {
        this.setAttribute("data-blob-clickable", "");
        this.addEventListener("click", this._onClick);
      } else {
        this.removeAttribute("data-blob-clickable");
        this.removeEventListener("click", this._onClick);
      }
    }

    _makeRandom() {
      return this.seedString != null ? createSeededRandom(this.seedString) : Math.random;
    }

    // Morph the displayed shape toward the current attributes (live retuning).
    // Baselines from what's on screen so rapid changes redirect smoothly.
    _retuneShape() {
      if (!this.path) return;
      const target = this._seedPath || this.generatePathString();
      if (this.isAnimating) {
        this.targetPath = target;
        this.pendingPath = null;
        return;
      }
      this.currentPath = this.path.getAttribute("d") || this.currentPath;
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      this.elapsedTime = 0;
      this.startTime = null;
      this.targetPath = target;
      const dur = prefersReducedMotion() ? 0 : this.morphMs;
      if (dur <= 0) {
        this.currentPath = target;
        this.path.setAttribute("d", target);
        this.updateSeedAttribute(target);
      } else {
        this.animateBlob(dur, () => {
          this.currentPath = this.targetPath;
          this.updateSeedAttribute(this.currentPath);
        });
      }
    }

    disconnectedCallback() {
      this.pause();
      this.stopDrift();
      this.removeEventListener("click", this._onClick);
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
        this.intersectionObserver = null;
      }
    }

    generatePathString() {
      return generateBlobPath({
        points: this.points,
        variance: this.variance,
        random: this._makeRandom(),
      });
    }

    // --- morph loop ---------------------------------------------------------
    play(customDuration = null) {
      if (this.isAnimating) return;
      this.isAnimating = true;
      const duration = customDuration || this.speed;

      const loop = () => {
        if (!this.pendingPath) this.pendingPath = this.generatePathString();
        this.animateBlob(duration, () => {
          this.currentPath = this.targetPath;
          this.updateSeedAttribute(this.currentPath);
          this.targetPath = this.pendingPath;
          this.pendingPath = this.generatePathString();
          if (this.isAnimating) loop();
        });
      };

      loop();
    }

    pause() {
      if (!this.isAnimating) return;
      this.isAnimating = false;
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      this.elapsedTime += performance.now() - (this.startTime || performance.now());
      this.startTime = null;
    }

    // One-shot regenerate + morph (analogous to a manual shuffle).
    generateNewBlob(duration = 800) {
      if (this.isGeneratingBlob || this.animationFrameId) return;
      if (duration < 1) duration = 1;
      this.isGeneratingBlob = true;
      this.pendingPath = this.generatePathString();
      this.animateBlob(duration, () => {
        this.currentPath = this.targetPath;
        this.targetPath = this.pendingPath;
        this.pendingPath = null;
        this.updateSeedAttribute(this.currentPath);
        this.isGeneratingBlob = false;
        this.animationFrameId = null;
      });
    }

    animateBlob(duration, onComplete = null) {
      const startPoints = parseBlobPath(this.currentPath);
      const endPoints = parseBlobPath(this.targetPath);

      const animate = (timestamp) => {
        if (!this.startTime) this.startTime = timestamp - this.elapsedTime;
        const elapsed = timestamp - this.startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (this.path) {
          this.path.setAttribute(
            "d",
            interpolateBlob(startPoints, endPoints, easeInOutCubic(progress)),
          );
        }

        if (progress < 1) {
          this.animationFrameId = requestAnimationFrame(animate);
        } else {
          this.elapsedTime = 0;
          this.startTime = null;
          if (onComplete) onComplete();
          if (typeof CustomEvent === "function") {
            this.dispatchEvent(
              new CustomEvent("dynamo-blob-complete", { detail: { duration } }),
            );
          }
        }
      };

      this.animationFrameId = requestAnimationFrame(animate);
    }

    updateSeedAttribute(pathString) {
      // Respect a user-provided seed; only auto-populate when none was set.
      if (this._hasUserSeed) return;
      const encoded = encodeBlobSeed(pathString);
      if (encoded && this.getAttribute("data-blob-seed") !== encoded) {
        this._writingSeed = encoded;
        this.setAttribute("data-blob-seed", encoded);
      }
    }

    setupIntersectionObserver(observeConfig) {
      const [mode, rootMargin = "0px"] = observeConfig.split(":");
      const isOneTime = mode === "once";

      if (
        typeof window === "undefined" ||
        typeof window.IntersectionObserver === "undefined"
      ) {
        return;
      }

      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              this.generateNewBlob();
              if (isOneTime && this.intersectionObserver) {
                this.intersectionObserver.disconnect();
                this.intersectionObserver = null;
              }
            }
          });
        },
        { root: null, rootMargin, threshold: 0 },
      );
      this.intersectionObserver.observe(this);
    }

    // --- drift ("DVD"-style bounce) -----------------------------------------
    startDrift() {
      if (this.driftFrameId) return;
      this.setAttribute("data-blob-drifting", "");
      if (!this.driftInitialized) this.initDrift();
      const step = () => {
        this.driftPosX += this.driftVelX;
        this.driftPosY += this.driftVelY;
        const { w, h, pw, ph } = this.driftBounds();
        if (this.driftPosX + w > pw || this.driftPosX < 0) {
          this.driftVelX = -this.driftVelX;
          this.driftPosX = Math.max(0, Math.min(this.driftPosX, pw - w));
        }
        if (this.driftPosY + h > ph || this.driftPosY < 0) {
          this.driftVelY = -this.driftVelY;
          this.driftPosY = Math.max(0, Math.min(this.driftPosY, ph - h));
        }
        this.style.transform = `translate3d(${this.driftPosX}px, ${this.driftPosY}px, 0)`;
        this.driftFrameId = requestAnimationFrame(step);
      };
      this.driftFrameId = requestAnimationFrame(step);
    }

    initDrift() {
      const speed = this.driftSpeed * 0.1;
      const { w, h, pw, ph } = this.driftBounds();
      this.driftPosX = Math.random() * Math.max(0, pw - w);
      this.driftPosY = Math.random() * Math.max(0, ph - h);
      this.driftVelX = Math.random() > 0.5 ? speed : -speed;
      this.driftVelY = Math.random() > 0.5 ? speed : -speed;
      this.driftInitialized = true;
    }

    driftBounds() {
      const parent = this.offsetParent || this.parentElement;
      return {
        w: this.offsetWidth,
        h: this.offsetHeight,
        pw: parent ? parent.offsetWidth || parent.clientWidth : 0,
        ph: parent ? parent.offsetHeight || parent.clientHeight : 0,
      };
    }

    stopDrift() {
      if (this.driftFrameId) cancelAnimationFrame(this.driftFrameId);
      this.driftFrameId = null;
    }

    deflect() {
      const speed = this.driftSpeed * 0.1;
      const angle = Math.random() * 2 * Math.PI;
      this.driftVelX = Math.cos(angle) * speed;
      this.driftVelY = Math.sin(angle) * speed;
    }
  }

  // Register (guarded for SSR + double-definition).
  if (
    typeof window !== "undefined" &&
    window.customElements &&
    !window.customElements.get("dynamo-blob")
  ) {
    window.customElements.define("dynamo-blob", DynamoBlob);
  }

  // ---------------------------------------------------------------------------
  // Pure helpers (no DOM) — exported and independently testable.
  // ---------------------------------------------------------------------------

  function generateBlobPoints(points, variance, random = Math.random) {
    const count = Math.max(3, Number.isFinite(points) ? Math.floor(points) : 3);
    const step = (2 * Math.PI) / count;
    const pts = [];
    for (let i = 0; i < count; i++) {
      const angle = i * step;
      const r = BASE_RADIUS + (random() * variance - variance / 2);
      pts.push({ x: Math.cos(angle) * r + CENTER, y: Math.sin(angle) * r + CENTER });
    }
    return pts;
  }

  function pointsToPath(pts) {
    if (!pts.length) return "";
    let d = "";
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const next = pts[(i + 1) % pts.length];
      d += ` Q ${p.x},${p.y} ${(p.x + next.x) / 2},${(p.y + next.y) / 2}`;
    }
    const startX = (pts[0].x + pts[pts.length - 1].x) / 2;
    const startY = (pts[0].y + pts[pts.length - 1].y) / 2;
    return `M ${startX},${startY}${d} Z`;
  }

  /**
   * Generate a closed blob path string.
   * @param {Object} options
   * @param {number} options.points - Vertex count (min 3).
   * @param {number} options.variance - Radius deviation in internal units.
   * @param {() => number} [options.random] - RNG (defaults to Math.random).
   * @returns {string} SVG path data.
   */
  function generateBlobPath({ points, variance, random = Math.random }) {
    return pointsToPath(generateBlobPoints(points, variance, random));
  }

  /**
   * Extract the blob's vertices (the quadratic control points) from a path string.
   * @param {string} pathString
   * @returns {{ x: number, y: number }[]}
   */
  function parseBlobPath(pathString) {
    const pts = [];
    if (typeof pathString !== "string") return pts;
    const num = "[+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?";
    const re = new RegExp(`Q\\s*(${num})\\s*,\\s*(${num})\\s+(${num})\\s*,\\s*(${num})`, "g");
    let match;
    while ((match = re.exec(pathString)) !== null) {
      pts.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
    }
    return pts;
  }

  /**
   * Resample a closed vertex ring to `n` evenly-angled vertices, so two shapes
   * with different point counts can be interpolated position-for-position.
   * @param {{ x: number, y: number }[]} pts
   * @param {number} n
   * @returns {{ x: number, y: number }[]}
   */
  function resampleClosed(pts, n) {
    const a = pts.length;
    if (a === n || a === 0) return pts.map((p) => ({ ...p }));
    const cx = pts.reduce((s, p) => s + p.x, 0) / a;
    const cy = pts.reduce((s, p) => s + p.y, 0) / a;
    const radii = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
    const out = [];
    for (let j = 0; j < n; j++) {
      const t = (j / n) * a;
      const i0 = Math.floor(t) % a;
      const i1 = (i0 + 1) % a;
      const f = t - Math.floor(t);
      const r = radii[i0] + (radii[i1] - radii[i0]) * f;
      const ang = (j / n) * 2 * Math.PI;
      out.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
    }
    return out;
  }

  /**
   * Interpolate between two blob vertex rings and return the resulting path.
   * Differing point counts are resampled so the morph stays vertex-for-vertex;
   * at progress 1 the result is exactly `targetPoints`.
   * @param {{ x: number, y: number }[]} currentPoints
   * @param {{ x: number, y: number }[]} targetPoints
   * @param {number} progress - 0..1
   * @returns {string} SVG path data.
   */
  function interpolateBlob(currentPoints, targetPoints, progress) {
    if (!currentPoints.length || !targetPoints.length) return "";
    const from =
      currentPoints.length === targetPoints.length
        ? currentPoints
        : resampleClosed(currentPoints, targetPoints.length);
    const lerped = from.map((p, i) => ({
      x: p.x + (targetPoints[i].x - p.x) * progress,
      y: p.y + (targetPoints[i].y - p.y) * progress,
    }));
    return pointsToPath(lerped);
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Deterministic RNG (mulberry32) keyed off an arbitrary seed string.
   * @param {string|number} seed
   * @returns {() => number}
   */
  function createSeededRandom(seed) {
    let hash = 0;
    const seedString = String(seed);
    for (let i = 0; i < seedString.length; i++) {
      hash = (hash << 5) - hash + seedString.charCodeAt(i);
      hash |= 0;
    }
    let state = hash >>> 0;
    return function seededRandom() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function encodeBlobSeed(pathString) {
    if (typeof pathString !== "string") return "";
    const normalized = pathString.trim().replace(/\s+/g, " ");
    try {
      if (typeof btoa === "function") {
        return btoa(toBinaryString(normalized)).replace(/=+$/, "");
      }
      if (typeof Buffer !== "undefined") {
        return Buffer.from(normalized, "utf8").toString("base64").replace(/=+$/, "");
      }
    } catch (error) {
      /* ignore */
    }
    return "";
  }

  function decodeBlobSeed(seed) {
    if (typeof seed !== "string" || seed.trim() === "") return null;
    const padded = seed.padEnd(Math.ceil(seed.length / 4) * 4, "=");
    try {
      if (typeof atob === "function") {
        return fromBinaryString(atob(padded));
      }
      if (typeof Buffer !== "undefined") {
        return Buffer.from(padded, "base64").toString("utf8");
      }
    } catch (error) {
      /* ignore */
    }
    return null;
  }

  function toBinaryString(text) {
    if (typeof TextEncoder !== "undefined") {
      let binary = "";
      new TextEncoder().encode(text).forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      return binary;
    }
    return Array.from(text)
      .map((char) => String.fromCharCode(char.charCodeAt(0)))
      .join("");
  }

  function fromBinaryString(binary) {
    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    }
    return binary;
  }

  exports.DynamoBlob = DynamoBlob;
  exports.createSeededRandom = createSeededRandom;
  exports.decodeBlobSeed = decodeBlobSeed;
  exports.encodeBlobSeed = encodeBlobSeed;
  exports.generateBlobPath = generateBlobPath;
  exports.generateBlobPoints = generateBlobPoints;
  exports.interpolateBlob = interpolateBlob;
  exports.parseBlobPath = parseBlobPath;
  exports.resampleClosed = resampleClosed;

}));
