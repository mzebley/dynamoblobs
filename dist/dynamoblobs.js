(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Dynamoblobs = {}));
})(this, (function (exports) { 'use strict';

  // dynamoblobs — dependency-free generative SVG blobs as a custom element.
  //
  // <dynamo-blob> renders a closed, organic SVG path with three independent,
  // always-available motion layers:
  //   • wobble — a continuous CSS turn / skew / scale,
  //   • morph  — a JS path-interpolation loop between silhouettes,
  //   • drift  — a "DVD"-style bounce around a positioned parent, deflectable on click.
  //
  // Each layer is "always ready": you control whether it auto-plays on render
  // (data-blob-<layer>-autoplay) and play/pause it live (data-blob-is-<layer>ing,
  // mirrored to .isWobbling / .isMorphing / .isDrifting). data-blob-is-animating
  // (.isAnimating) is the master: false freezes everything, true resumes the
  // auto-play layers. prefers-reduced-motion suppresses auto-play only.
  //
  // It lives in the light DOM, inherits `fill` from your CSS, is `aria-hidden`,
  // and is SSR-safe (everything DOM-y is guarded).

  // ---------------------------------------------------------------------------
  // Internal geometry. The blob is drawn in a fixed coordinate space and scaled
  // to the host element, so `variance` is resolution-independent and the host
  // controls size purely with CSS.
  // ---------------------------------------------------------------------------
  const VIEW = 100;
  const CENTER = VIEW / 2;
  const BASE_RADIUS = 30; // leaves headroom for variance + wobble inside 0..100

  // Multiplier on the drift-collision radius (data-blob-drift-bias). The boundary
  // is the blob's average silhouette radius; the default shrinks it slightly so the
  // blob carries a touch *past* the wall before bouncing (the wobble's scale
  // breathes the silhouette to ~0.9, so this keeps contact centred in that breath).
  // Below 1 leans further past; above 1 bounces sooner. Clamped to a sane range.
  const DRIFT_BIAS_DEFAULT = 0.9;
  const DRIFT_BIAS_MIN = 0.5;
  const DRIFT_BIAS_MAX = 1.5;

  const STYLE_ID = "dynamoblobs-styles";

  const BLOB_CSS = `
.dynamo-blob-host {
  display: block;
  overflow: visible;
  pointer-events: none;
}
.dynamo-blob-host.dynamo-blob--clickable { pointer-events: auto; cursor: pointer; }
.dynamo-blob-host.dynamo-blob--drift {
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
  animation: dynamo-blob-turn var(--dynamo-blob-time, 30000ms) linear infinite;
}
.dynamo-blob__skew {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  transform-origin: center;
  transform-box: fill-box;
  will-change: transform;
  animation: dynamo-blob-skew calc(var(--dynamo-blob-time, 30000ms) * 0.5) linear infinite;
}
.dynamo-blob__scale {
  transform-origin: center;
  transform-box: fill-box;
  will-change: transform;
  animation: dynamo-blob-scale calc(var(--dynamo-blob-time, 30000ms) * 0.5) ease-in-out infinite;
}
.dynamo-blob__path { fill: inherit; }
.dynamo-blob-host[data-blob-is-wobbling="false"] .dynamo-blob__turn,
.dynamo-blob-host[data-blob-is-wobbling="false"] .dynamo-blob__skew,
.dynamo-blob-host[data-blob-is-wobbling="false"] .dynamo-blob__scale,
.dynamo-blob-host[data-blob-is-animating="false"] .dynamo-blob__turn,
.dynamo-blob-host[data-blob-is-animating="false"] .dynamo-blob__skew,
.dynamo-blob-host[data-blob-is-animating="false"] .dynamo-blob__scale { animation-play-state: paused; }
@keyframes dynamo-blob-turn { to { transform: rotate(360deg); } }
@keyframes dynamo-blob-skew {
  0%   { transform: skewY(0deg); }
  13%  { transform: skewY(calc(1.8deg * var(--dynamo-blob-intensity, 2))); }
  18%  { transform: skewY(calc(2.2deg * var(--dynamo-blob-intensity, 2))); }
  24%  { transform: skewY(calc(2.48deg * var(--dynamo-blob-intensity, 2))); }
  25%  { transform: skewY(calc(2.5deg * var(--dynamo-blob-intensity, 2))); }
  26%  { transform: skewY(calc(2.48deg * var(--dynamo-blob-intensity, 2))); }
  32%  { transform: skewY(calc(2.2deg * var(--dynamo-blob-intensity, 2))); }
  37%  { transform: skewY(calc(1.8deg * var(--dynamo-blob-intensity, 2))); }
  50%  { transform: skewY(0deg); }
  63%  { transform: skewY(calc(-1.8deg * var(--dynamo-blob-intensity, 2))); }
  68%  { transform: skewY(calc(-2.2deg * var(--dynamo-blob-intensity, 2))); }
  74%  { transform: skewY(calc(-2.48deg * var(--dynamo-blob-intensity, 2))); }
  75%  { transform: skewY(calc(-2.5deg * var(--dynamo-blob-intensity, 2))); }
  76%  { transform: skewY(calc(-2.48deg * var(--dynamo-blob-intensity, 2))); }
  82%  { transform: skewY(calc(-2.2deg * var(--dynamo-blob-intensity, 2))); }
  87%  { transform: skewY(calc(-1.8deg * var(--dynamo-blob-intensity, 2))); }
  100% { transform: skewY(0deg); }
}
@keyframes dynamo-blob-scale {
  0%   { transform: scaleX(0.9) scaleY(1); }
  25%  { transform: scaleX(0.9) scaleY(0.9); }
  50%  { transform: scaleX(1) scaleY(0.9); }
  75%  { transform: scaleX(0.9) scaleY(0.9); }
  100% { transform: scaleX(0.9) scaleY(1); }
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

  class DynamoBlob extends HTMLElement {
    static get observedAttributes() {
      return [
        "data-blob-points",
        "data-blob-variance",
        "data-blob-seed",
        "data-blob-morph-tween",
        "data-blob-morph-speed",
        "data-blob-morph-intensity",
        "data-blob-morph-autoplay",
        "data-blob-is-morphing",
        "data-blob-wobble-speed",
        "data-blob-wobble-intensity",
        "data-blob-wobble-autoplay",
        "data-blob-is-wobbling",
        "data-blob-drift-speed",
        "data-blob-drift-intensity",
        "data-blob-drift-bias",
        "data-blob-drift-autoplay",
        "data-blob-drift-click",
        "data-blob-drift-start-position",
        "data-blob-is-drifting",
        "data-blob-is-animating",
      ];
    }

    constructor() {
      super();

      // Morph state
      this._morphing = false;
      this.animationFrameId = null;
      this.elapsedTime = 0;
      this.startTime = null;
      this.isGeneratingBlob = false;
      this.currentPath = null;
      this.targetPath = null;
      this.pendingPath = null;
      // Frozen fraction (0..1) through the current tween when paused, so a resume
      // continues seamlessly; the duration the active tween was started with.
      this._morphProgress = 0;
      this._morphDuration = 0;

      // Wobble state (CSS-driven; this is the intended play/pause).
      this._wobbling = false;

      // Drift state
      this.driftFrameId = null;
      this.driftPosX = 0;
      this.driftPosY = 0;
      this.driftVelX = 0;
      this.driftVelY = 0;
      this.driftInitialized = false;
      this._driftInset = null; // padding between host box and the collision boundary
      this._driftInsetTick = 0;
      // Tunes how close drift bounces to the wall (data-blob-drift-bias). The
      // boundary is a rotation-invariant radius from the path geometry (stable under
      // the CSS wobble), scaled by this.
      this.driftBias = DRIFT_BIAS_DEFAULT;

      this.intersectionObserver = null;
      this.random = Math.random;
      this.seedString = null;
      this.driftSpeed = 1.25;
      this.driftIntensity = 1;
      this.morphMs = 600;
      this.morphIntensity = 1;
      this._connected = false;
      this._hasUserSeed = false;
      this._writingSeed = null;
      this._seedPath = null;

      // Names we're mid-writing to the DOM as state reflection — ignore the
      // resulting attributeChangedCallback so the two-way attributes don't loop.
      this._writingState = new Set();

      this.play = this.play.bind(this);
      this.pause = this.pause.bind(this);
      this.playWobble = this.playWobble.bind(this);
      this.pauseWobble = this.pauseWobble.bind(this);
      this.playMorph = this.playMorph.bind(this);
      this.pauseMorph = this.pauseMorph.bind(this);
      this.playDrift = this.playDrift.bind(this);
      this.pauseDrift = this.pauseDrift.bind(this);
      this.generateNewBlob = this.generateNewBlob.bind(this);
      this.deflect = this.deflect.bind(this);
      this._onClick = () => this.deflect();
    }

    // --- live state, mirrored to data-blob-is-* attributes ------------------
    get isWobbling() {
      return this._wobbling;
    }
    get isMorphing() {
      return this._morphing;
    }
    get isDrifting() {
      return this.driftFrameId != null;
    }
    /** True when any of the three layers is currently playing. */
    get isAnimating() {
      return this.isWobbling || this.isMorphing || this.isDrifting;
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

      // Decide each layer's initial play state. An explicit data-blob-is-<layer>ing
      // wins; otherwise the layer auto-plays per its -autoplay flag, unless the
      // master is off or reduced motion is requested.
      const masterOff = this.getAttribute("data-blob-is-animating") === "false";
      const reduce = prefersReducedMotion();

      this._wobbling = this._initialLayerState(
        "data-blob-is-wobbling",
        "data-blob-wobble-autoplay",
        true,
        masterOff,
        reduce,
      );
      if (
        this._initialLayerState(
          "data-blob-is-morphing",
          "data-blob-morph-autoplay",
          false,
          masterOff,
          reduce,
        )
      ) {
        this.playMorph();
      }
      if (
        this._initialLayerState(
          "data-blob-is-drifting",
          "data-blob-drift-autoplay",
          false,
          masterOff,
          reduce,
        )
      ) {
        this.startDrift();
      }

      this._connected = true;
      this._reflectState();
    }

    _initialLayerState(stateAttr, autoplayAttr, autoplayDefault, masterOff, reduce) {
      const explicit = this.getAttribute(stateAttr);
      if (explicit != null) return explicit !== "false";
      return !masterOff && !reduce && this._boolAttr(autoplayAttr, autoplayDefault);
    }

    // Attributes are reactive: change one and the element re-tunes in place.
    attributeChangedCallback(name, oldValue, newValue) {
      if (this._writingState.has(name)) return; // our own state reflection
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
        case "data-blob-morph-tween":
        case "data-blob-morph-intensity":
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
        case "data-blob-drift-intensity":
          this._readConfig();
          break;
        case "data-blob-drift-bias":
          this._readConfig();
          this._driftInsetTick = 0; // re-measure with the new bias next frame
          break;
        case "data-blob-wobble-speed":
        case "data-blob-wobble-intensity":
          this._applyWobbleVars();
          break;
        case "data-blob-morph-speed":
          this._readConfig();
          if (this._morphing) {
            this.pauseMorph();
            this.playMorph();
          }
          break;
        case "data-blob-wobble-autoplay":
          if (this._boolAttr("data-blob-wobble-autoplay", true)) this.playWobble();
          else this.pauseWobble();
          break;
        case "data-blob-morph-autoplay":
          if (this._boolAttr("data-blob-morph-autoplay", false)) this.playMorph();
          else this.pauseMorph();
          break;
        case "data-blob-drift-autoplay":
          if (
            this._boolAttr("data-blob-drift-autoplay", false) &&
            this.getAttribute("data-blob-is-animating") !== "false"
          ) {
            this.startDrift();
          } else {
            // Tear all the way down so the element returns to flow (re-centers),
            // unlike is-drifting="false", which freezes drift in place.
            this.stopDrift();
            this.classList.remove("dynamo-blob--drift");
            this.style.transform = "";
            this.driftInitialized = false;
            this._reflectState();
          }
          break;
        case "data-blob-drift-click":
          this._applyClick();
          break;
        case "data-blob-is-wobbling":
          if (newValue === "false") this.pauseWobble();
          else this.playWobble();
          break;
        case "data-blob-is-morphing":
          if (newValue === "false") this.pauseMorph();
          else this.playMorph();
          break;
        case "data-blob-is-drifting":
          if (newValue === "false") this.pauseDrift();
          else this.playDrift();
          break;
        case "data-blob-is-animating":
          // Master freeze / resume. false pauses every layer in place; true (or
          // removed) resumes the auto-play layers. Explicit, so it ignores
          // prefers-reduced-motion.
          if (newValue === "false") {
            this.pauseWobble();
            this.pauseMorph();
            this.pauseDrift();
          } else {
            if (this._boolAttr("data-blob-wobble-autoplay", true)) this.playWobble();
            if (this._boolAttr("data-blob-morph-autoplay", false)) this.playMorph();
            if (this._boolAttr("data-blob-drift-autoplay", false)) this.startDrift();
          }
          break;
      }
    }

    _readConfig() {
      const pointsAttr = parseInt(this.getAttribute("data-blob-points"), 10);
      this.points = Number.isFinite(pointsAttr) ? Math.max(3, pointsAttr) : 10;

      const varianceAttr = parseFloat(this.getAttribute("data-blob-variance"));
      this.variance = Number.isFinite(varianceAttr) ? varianceAttr : 8;

      this.speed = parseFloat(this.getAttribute("data-blob-morph-speed")) || 7500;

      const tweenAttr = parseFloat(this.getAttribute("data-blob-morph-tween"));
      this.morphMs = Number.isFinite(tweenAttr) ? tweenAttr : 600;

      const morphIntensityAttr = parseFloat(this.getAttribute("data-blob-morph-intensity"));
      this.morphIntensity = Number.isFinite(morphIntensityAttr)
        ? Math.max(0, morphIntensityAttr)
        : 1;

      const driftAttr = parseFloat(this.getAttribute("data-blob-drift-speed"));
      this.driftSpeed = Number.isFinite(driftAttr) ? driftAttr : 1.25;

      const driftIntensityAttr = parseFloat(this.getAttribute("data-blob-drift-intensity"));
      this.driftIntensity = Number.isFinite(driftIntensityAttr)
        ? Math.max(0, driftIntensityAttr)
        : 1;

      const biasAttr = parseFloat(this.getAttribute("data-blob-drift-bias"));
      this.driftBias = Number.isFinite(biasAttr)
        ? Math.max(DRIFT_BIAS_MIN, Math.min(DRIFT_BIAS_MAX, biasAttr))
        : DRIFT_BIAS_DEFAULT;

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
        `${Number.isFinite(wobbleSpeed) ? wobbleSpeed : 30000}ms`,
      );
      const wobbleIntensity = parseFloat(this.getAttribute("data-blob-wobble-intensity"));
      this.style.setProperty(
        "--dynamo-blob-intensity",
        String(Number.isFinite(wobbleIntensity) ? wobbleIntensity : 2),
      );
    }

    // Read a boolean-ish attribute. Absent → default; "false"/"0"/"no"/"off" → false.
    _boolAttr(name, dflt) {
      const v = this.getAttribute(name);
      if (v == null) return dflt;
      return !["false", "0", "no", "off"].includes(v.trim().toLowerCase());
    }

    // Mirror live play/pause state to the data-blob-is-* attributes. Guarded so
    // the resulting attributeChangedCallback is ignored (no feedback loop).
    _reflectState() {
      this._reflect("data-blob-is-wobbling", this.isWobbling);
      this._reflect("data-blob-is-morphing", this.isMorphing);
      this._reflect("data-blob-is-drifting", this.isDrifting);
      this._reflect("data-blob-is-animating", this.isAnimating);
    }

    _reflect(name, on) {
      const value = on ? "true" : "false";
      if (this.getAttribute(name) === value) return;
      this._writingState.add(name);
      this.setAttribute(name, value);
      this._writingState.delete(name);
    }

    _applyClick() {
      if (this._boolAttr("data-blob-drift-click", false)) {
        this.classList.add("dynamo-blob--clickable");
        this.addEventListener("click", this._onClick);
      } else {
        this.classList.remove("dynamo-blob--clickable");
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
      // A retune redefines the shape baseline, so any frozen morph tween is stale.
      this._morphProgress = 0;
      // Re-baseline from what's actually on screen so rapid changes redirect
      // smoothly — and so both tween endpoints stay valid paths (a null target
      // would interpolate to an empty "d" and blank the blob mid-morph).
      this.currentPath = this.path.getAttribute("d") || this.currentPath;
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      this.elapsedTime = 0;
      this.startTime = null;
      this.targetPath = target;
      this.pendingPath = null;

      if (this._morphing) {
        // Redirect the live morph toward the retuned shape from the current frame,
        // then keep the loop running at the configured morph speed.
        this._morphLoop();
        return;
      }

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
      this.pauseMorph();
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

    // The next silhouette for the morph loop: a fixed-magnitude perturbation of
    // `fromPath`, so every cycle moves the shape by a consistent amount in a
    // random direction. Higher intensity = bigger, reliably dramatic changes
    // (no accidental near-duplicates that make the loop look stalled).
    nextMorphTarget(fromPath) {
      return nextMorphShape(fromPath, {
        variance: this.variance,
        intensity: this.morphIntensity,
        random: Math.random,
      });
    }

    // --- unified controls ---------------------------------------------------
    // Resume the layers the blob is configured to auto-play. An options key
    // *forces* that layer on (and tunes it). Durations are in ms (morph, wobble);
    // drift takes a speed multiplier. Explicit play ignores prefers-reduced-motion
    // — that gate only applies to auto-play on render.
    play(options = {}) {
      const opts = options || {};
      if (opts.wobble != null || this._boolAttr("data-blob-wobble-autoplay", true)) {
        this.playWobble(opts.wobble);
      }
      if (opts.morph != null || this._boolAttr("data-blob-morph-autoplay", false)) {
        this.playMorph(opts.morph);
      }
      if (opts.drift != null || this._boolAttr("data-blob-drift-autoplay", false)) {
        this.playDrift(opts.drift);
      }
    }

    // Freeze all three layers in place.
    pause() {
      this.pauseWobble();
      this.pauseMorph();
      this.pauseDrift();
    }

    // --- wobble (CSS) -------------------------------------------------------
    // Resume the ambient wobble. An optional period (ms) sets the turn cycle.
    playWobble(durationMs) {
      if (Number.isFinite(durationMs)) {
        this.style.setProperty("--dynamo-blob-time", `${durationMs}ms`);
      }
      this._wobbling = true;
      this._reflectState();
    }

    // Freeze the wobble at its current position (animation-play-state: paused).
    pauseWobble() {
      this._wobbling = false;
      this._reflectState();
    }

    // --- morph loop ---------------------------------------------------------
    playMorph(customDuration = null) {
      if (this._morphing) return;
      this._morphing = true;
      this._reflectState();
      this._morphDuration = customDuration || this.speed;

      // A non-morph tween may be in flight (e.g. a retune snap); supersede it so
      // two loops don't write to the same path.
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      if (this._morphProgress > 0 && this.currentPath && this.targetPath) {
        // Resume a tween frozen by pauseMorph at the exact same progress, so the
        // restart is seamless and survives a morph-speed change while paused.
        this.elapsedTime = this._morphProgress * this._morphDuration;
      } else {
        // Fresh start: baseline the first target off the current shape so even the
        // opening cycle obeys the intensity-driven magnitude.
        this.elapsedTime = 0;
        this.targetPath = this.nextMorphTarget(this.currentPath);
        this.pendingPath = null;
      }
      this.startTime = null;
      this._morphProgress = 0;

      this._morphLoop();
    }

    // One morph cycle: tween currentPath -> targetPath, then advance the ring
    // (current <- target <- pending) and recurse while still morphing.
    _morphLoop() {
      if (!this.pendingPath) this.pendingPath = this.nextMorphTarget(this.targetPath);
      this.animateBlob(this._morphDuration, () => {
        this.currentPath = this.targetPath;
        this.updateSeedAttribute(this.currentPath);
        this.targetPath = this.pendingPath;
        this.pendingPath = this.nextMorphTarget(this.targetPath);
        if (this._morphing) this._morphLoop();
      });
    }

    pauseMorph() {
      if (!this._morphing) {
        this._reflectState();
        return;
      }
      this._morphing = false;
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      // Freeze the tween as a fraction of its duration (not raw ms), so resume is
      // seamless even if the morph speed changes meanwhile. startTime already folds
      // in any prior elapsedTime, so read it directly — never accumulate, or
      // repeated pause/resume double-counts and the morph leaps forward.
      if (this.startTime != null && this._morphDuration > 0) {
        const elapsed = performance.now() - this.startTime;
        this._morphProgress = Math.max(0, Math.min(elapsed / this._morphDuration, 1));
      }
      this.elapsedTime = 0;
      this.startTime = null;
      this._reflectState();
    }

    // --- drift --------------------------------------------------------------
    // Resume drift from its current position. An optional speed multiplier
    // updates driftSpeed (rescaling live velocity when already initialized).
    playDrift(speed) {
      if (Number.isFinite(speed)) {
        const prev = this.driftSpeed;
        this.driftSpeed = speed;
        if (this.driftInitialized && prev) {
          const ratio = this.driftSpeed / prev;
          this.driftVelX *= ratio;
          this.driftVelY *= ratio;
        }
      }
      this.startDrift();
    }

    // Freeze drift in place (keeps position; resumes from here).
    pauseDrift() {
      this.stopDrift();
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
          const d = interpolateBlob(startPoints, endPoints, easeInOutCubic(progress));
          // Only write a real path — never blank the blob if a silhouette is
          // momentarily missing (the tween still completes and self-heals).
          if (d) this.path.setAttribute("d", d);
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
      // Initialise before going absolute so a "current" start can read the
      // element's laid-out position (offsetLeft/Top) while it's still in flow.
      if (!this.driftInitialized) this.initDrift();
      this.classList.add("dynamo-blob--drift");
      const step = () => {
        this.driftPosX += this.driftVelX;
        this.driftPosY += this.driftVelY;
        const { w, h, pw, ph } = this.driftBounds();
        // Bounce off the blob's silhouette, not the host box. The shape fills only
        // the middle of the box (transparent headroom for variance + wobble), so we
        // let the box overhang the walls by that padding. The boundary is a
        // rotation-invariant radius derived from the path geometry, so the CSS
        // wobble can spin/skew/scale without ever moving the bounce. Refreshed every
        // few frames — it changes slowly (only with morph), so this stays cheap.
        if (this._driftInsetTick <= 0) {
          this._driftInset = this.measureDriftInset(w, h);
          this._driftInsetTick = 10;
        }
        this._driftInsetTick--;
        const insetX = this._driftInset ? this._driftInset.x : 0;
        const insetY = this._driftInset ? this._driftInset.y : 0;
        const minX = -insetX;
        const maxX = pw - w + insetX;
        const minY = -insetY;
        const maxY = ph - h + insetY;
        // On a wall hit, reflect and scale velocity by drift intensity
        // (restitution): 1 is perfectly elastic, <1 damps, >1 energizes.
        if (this.driftPosX > maxX || this.driftPosX < minX) {
          this.driftVelX = -this.driftVelX * this.driftIntensity;
          this.driftPosX = Math.max(minX, Math.min(this.driftPosX, maxX));
          this._clampDriftSpeed();
        }
        if (this.driftPosY > maxY || this.driftPosY < minY) {
          this.driftVelY = -this.driftVelY * this.driftIntensity;
          this.driftPosY = Math.max(minY, Math.min(this.driftPosY, maxY));
          this._clampDriftSpeed();
        }
        this.style.transform = `translate3d(${this.driftPosX}px, ${this.driftPosY}px, 0)`;
        this.driftFrameId = requestAnimationFrame(step);
      };
      this.driftFrameId = requestAnimationFrame(step);
      this._reflectState();
    }

    // Keep an energized bounce (intensity > 1) from running away to infinity.
    _clampDriftSpeed() {
      const cap = Math.max(0.5, this.driftSpeed * 0.1 * 4);
      this.driftVelX = Math.max(-cap, Math.min(cap, this.driftVelX));
      this.driftVelY = Math.max(-cap, Math.min(cap, this.driftVelY));
    }

    initDrift() {
      const speed = this.driftSpeed * 0.1;
      const { w, h, pw, ph } = this.driftBounds();
      const maxX = Math.max(0, pw - w);
      const maxY = Math.max(0, ph - h);
      // Where the bounce begins. Default is a random spot (scatters ambient
      // backgrounds); "current" continues from the element's laid-out position
      // (no teleport), "center" starts from the container's middle.
      const start = (this.getAttribute("data-blob-drift-start-position") || "").toLowerCase();
      if (start === "current") {
        this.driftPosX = Math.max(0, Math.min(this.offsetLeft, maxX));
        this.driftPosY = Math.max(0, Math.min(this.offsetTop, maxY));
      } else if (start === "center") {
        this.driftPosX = maxX / 2;
        this.driftPosY = maxY / 2;
      } else {
        this.driftPosX = Math.random() * maxX;
        this.driftPosY = Math.random() * maxY;
      }
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

    // The mean collision radius in viewBox units — a rotation-invariant scalar
    // taken from the un-wobbled path geometry (the CSS wobble lives on ancestor
    // elements, so the path's own coordinates ignore it), so the bounce never
    // breathes with the spin.
    //
    // Crucially this samples the *rendered curve*, not the parsed vertices. Each
    // vertex is a quadratic control point and the silhouette passes through the
    // edge midpoints, so it sits inside the vertex ring — measuring the vertices
    // overestimates the radius and the blob bounces well short of the wall.
    _driftCollisionRadius() {
      const pts = parseBlobPath(this.path ? this.path.getAttribute("d") : "");
      const n = pts.length;
      if (!n) return BASE_RADIUS;
      // t=0 is the edge midpoint (shared with the previous segment, so counted
      // once); 0.25/0.5/0.75 walk the bulge toward the control point.
      const ts = [0, 0.25, 0.5, 0.75];
      let sum = 0;
      let count = 0;
      for (let i = 0; i < n; i++) {
        const cur = pts[i];
        const prev = pts[(i - 1 + n) % n];
        const next = pts[(i + 1) % n];
        const m0x = (prev.x + cur.x) / 2;
        const m0y = (prev.y + cur.y) / 2;
        const m1x = (cur.x + next.x) / 2;
        const m1y = (cur.y + next.y) / 2;
        for (const t of ts) {
          const u = 1 - t;
          const x = u * u * m0x + 2 * u * t * cur.x + t * t * m1x;
          const y = u * u * m0y + 2 * u * t * cur.y + t * t * m1y;
          sum += Math.hypot(x - CENTER, y - CENTER);
          count++;
        }
      }
      return sum / count;
    }

    // The transparent padding (px) between the host box and the collision boundary,
    // per axis. Derived from the stable collision radius (scaled by drift-bias), so
    // the wobble never makes it breathe — no layout reads, just arithmetic. Returns
    // { x: 0, y: 0 } when unmeasurable.
    measureDriftInset(w = this.offsetWidth, h = this.offsetHeight) {
      if (!w || !h) return { x: 0, y: 0 };
      // viewBox is square with preserveAspectRatio "meet", so it renders as a
      // min(w,h) square centred in the host box: `scale` px per unit, plus any
      // letterbox on the longer axis. The blob sits centred, radius*scale wide.
      const scale = Math.min(w, h) / VIEW;
      const ring = scale * (CENTER - this._driftCollisionRadius() * this.driftBias);
      return {
        x: Math.max(0, ring + (w - scale * VIEW) / 2),
        y: Math.max(0, ring + (h - scale * VIEW) / 2),
      };
    }

    stopDrift() {
      if (this.driftFrameId) cancelAnimationFrame(this.driftFrameId);
      this.driftFrameId = null;
      this._reflectState();
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
   * Produce the next morph silhouette as a fixed-magnitude perturbation of a base
   * shape. Each vertex radius is nudged in a random direction, then the whole
   * displacement is rescaled so its per-vertex RMS equals `intensity * variance`.
   * Because the magnitude is enforced, successive morphs feel consistently lively
   * — high intensity guarantees dramatic change instead of occasionally landing
   * on a near-identical shape. Radii are clamped to BASE_RADIUS ± variance.
   * @param {string} fromPath - The baseline silhouette path.
   * @param {Object} options
   * @param {number} options.variance - Radius deviation in internal units.
   * @param {number} options.intensity - Magnitude factor (fraction of variance, RMS).
   * @param {() => number} [options.random] - RNG (defaults to Math.random).
   * @returns {string} SVG path data.
   */
  function nextMorphShape(fromPath, { variance, intensity, random = Math.random }) {
    const pts = parseBlobPath(fromPath);
    const n = pts.length;
    if (!n) return generateBlobPath({ points: 10, variance, random });

    const radii = pts.map((p) => Math.hypot(p.x - CENTER, p.y - CENTER));
    const dirs = [];
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const d = random() * 2 - 1;
      dirs.push(d);
      sumSq += d * d;
    }
    // Normalize so the direction vector has unit RMS, then scale to the target
    // RMS displacement. amp is the consistent per-cycle radial change.
    const rms = Math.sqrt(sumSq / n) || 1;
    const amp = Math.max(0, intensity) * variance;
    const min = BASE_RADIUS - variance;
    const max = BASE_RADIUS + variance;

    const out = [];
    for (let i = 0; i < n; i++) {
      let r = radii[i] + (dirs[i] / rms) * amp;
      r = Math.max(min, Math.min(max, r));
      const ang = (i / n) * 2 * Math.PI;
      out.push({ x: CENTER + Math.cos(ang) * r, y: CENTER + Math.sin(ang) * r });
    }
    return pointsToPath(out);
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
  exports.nextMorphShape = nextMorphShape;
  exports.parseBlobPath = parseBlobPath;
  exports.resampleClosed = resampleClosed;

}));
