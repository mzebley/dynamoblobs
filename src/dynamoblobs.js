import { subscribeDriftGeometry, measureDriftGeometry } from "./driftGeometry.js";

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

// The only path shape the element ever emits or accepts as a decoded seed:
// "M x,y Q cx,cy x,y … Z". Anything else that happens to base64-decode (e.g. a
// plain-string seed like "TWFyaw" -> "Mark") is treated as a string seed, and
// the strict character allowlist keeps a hostile seed from ever reaching the
// DOM as markup.
const SEED_PATH_RE = /^M[0-9\s.,eE+-]+(?:Q[0-9\s.,eE+-]+)+Z$/;

const STYLE_ID = "dynamoblobs-styles";

const BLOB_CSS = `
dynamo-blob {
  display: block;
  overflow: visible;
  pointer-events: none;
}
dynamo-blob.dynamo-blob--clickable { pointer-events: auto; cursor: pointer; }
dynamo-blob.dynamo-blob--drift {
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
dynamo-blob[data-blob-is-wobbling="false"] .dynamo-blob__turn,
dynamo-blob[data-blob-is-wobbling="false"] .dynamo-blob__skew,
dynamo-blob[data-blob-is-wobbling="false"] .dynamo-blob__scale,
dynamo-blob[data-blob-is-animating="false"] .dynamo-blob__turn,
dynamo-blob[data-blob-is-animating="false"] .dynamo-blob__skew,
dynamo-blob[data-blob-is-animating="false"] .dynamo-blob__scale { animation-play-state: paused; }
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

function ensureBlobStyles(element) {
  const root = element.getRootNode();
  const container = root.head || root;
  if (!container.querySelector || container.querySelector(`#${STYLE_ID}`)) return;
  const style = element.ownerDocument.createElement("style");
  style.id = STYLE_ID;
  style.textContent = BLOB_CSS;
  container.appendChild(style);
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const HTMLElementBase = typeof HTMLElement === "undefined" ? class {} : HTMLElement;

class DynamoBlob extends HTMLElementBase {
  static get observedAttributes() {
    return [
      "data-blob-points",
      "data-blob-variance",
      "data-blob-seed",
      "data-blob-observe",
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
    this._driftGeometry = null;
    this._driftInsetInputs = null;
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
    this._automaticLayers = new Set();
    this._pendingAttributes = new Map();
    this._masterPaused = false;
    this._spaceArmed = false;
    this._onClickBlur = () => { this._spaceArmed = false; };
    this._onMotionChange = () => this._syncAutoplay();

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
    this._onClickKeydown = (event) => {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      // Enter activates on keydown like a native button. Space waits for keyup,
      // which preserves native button timing and lets focus movement cancel it.
      if (event.key === "Enter") this.click();
      else this._spaceArmed = true;
    };
    this._onClickKeyup = (event) => {
      if (event.key !== " " || !this._spaceArmed) return;
      this._spaceArmed = false;
      event.preventDefault();
      this.click();
    };
    this._managedClickAttributes = new Map();
  }

  // --- live state, mirrored to data-blob-is-* attributes ------------------
  get isWobbling() {
    return this._wobbling;
  }
  get isMorphing() {
    return this._morphing || this.animationFrameId != null;
  }
  get isDrifting() {
    return this.driftFrameId != null;
  }
  /** True when any of the three layers is currently playing. */
  get isAnimating() {
    return this.isWobbling || this.isMorphing || this.isDrifting;
  }

  connectedCallback() {
    ensureBlobStyles(this);
    this.classList.add("dynamo-blob-host");

    if (!this._everConnected) this._readConfig();
    this._masterPaused = this._everConnected ? this._masterPaused : this.getAttribute("data-blob-is-animating") === "false";

    // Initial silhouettes. On a reconnect (the element was moved in the DOM)
    // keep the previous paths so the silhouette survives the move; a user seed
    // still wins.
    this.currentPath = this.currentPath || this._seedPath || this.generatePathString();
    if (!this._pendingAttributes.has("data-blob-seed")) this.updateSeedAttribute(this.currentPath);
    if (!this.targetPath) this.targetPath = this.generatePathString();

    const snapshotSvg = this.querySelector(":scope > .dynamo-blob__turn > svg.dynamo-blob__skew");
    const snapshotPath = snapshotSvg?.querySelector("path.dynamo-blob__path");

    if (snapshotSvg && snapshotPath) {
      // Preserve nodes that a framework still needs to claim for hydration.
      this.svg = snapshotSvg;
      this.path = snapshotPath;
    } else {
      this.innerHTML = `
        <div class="dynamo-blob__turn">
          <svg
            class="dynamo-blob__skew"
            viewBox="0 0 ${VIEW} ${VIEW}"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            role="presentation"
          >
            <g class="dynamo-blob__scale">
              <path class="dynamo-blob__path"></path>
            </g>
          </svg>
        </div>
      `;
      this.svg = this.querySelector("svg");
      this.path = this.querySelector("path");
    }
    // "d" is set as an attribute, never through innerHTML: a decoded
    // data-blob-seed is outside input and must stay inert data, not markup.
    if (!this._everConnected || !snapshotSvg || !snapshotPath) {
      this.path.setAttribute("d", this._disconnectedPath || this.currentPath);
    }

    this._applyClick();

    // Viewport-triggered regeneration
    this._applyObserve();

    this._connected = true;
    this._initializing = true;
    this._motionQuery = this.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)");
    this._motionQuery?.addEventListener?.("change", this._onMotionChange);
    if (!this._everConnected) {
      for (const layer of ["Wobble", "Morph", "Drift"]) {
            const state = this.getAttribute(this._layerStateAttr(layer));
        if (!this._masterPaused && state != null && state !== "false") this[`play${layer}`]();
        else if (state == null) this._automaticLayers.add(layer);
      }
    } else {
      for (const layer of this._resumeLayers || []) this[`play${layer}`]();
      for (const layer of this._resumeAutomatic || []) this._automaticLayers.add(layer);
    }
    this._everConnected = true;
    this._syncAutoplay();
    this._initializing = false;
    const pending = this._pendingAttributes;
    this._pendingAttributes = new Map();
    for (const [name, [oldValue, newValue]] of pending) this.attributeChangedCallback(name, oldValue, newValue);
    this._reflectState();
  }

  _layerStateAttr(layer) {
    return `data-blob-is-${{ Wobble: "wobbling", Morph: "morphing", Drift: "drifting" }[layer]}`;
  }

  _syncAutoplay(changedLayer) {
    if (changedLayer) this._automaticLayers.add(changedLayer);
    for (const layer of changedLayer ? [changedLayer] : [...this._automaticLayers]) {
      const enabled = this._boolAttr(`data-blob-${layer.toLowerCase()}-autoplay`, layer === "Wobble");
      if (enabled && !this._masterPaused && !this._motionQuery?.matches) this[`play${layer}`]();
      else if (layer !== "Morph" || this._morphing) this[`pause${layer}`]();
      this._automaticLayers.add(layer);
    }
  }

  // Attributes are reactive: change one and the element re-tunes in place.
  attributeChangedCallback(name, oldValue, newValue) {
    if (this._writingState.has(name)) return; // our own state reflection
    if (oldValue === newValue && !name.startsWith("data-blob-is-")) return;
    if (!this._connected) {
      if (this._everConnected && newValue !== this._writingSeed) this._pendingAttributes.set(name, [oldValue, newValue]);
      return;
    }
    switch (name) {
      case "data-blob-points":
      case "data-blob-variance":
        this._readConfig(name);
        this._retuneShape();
        break;
      case "data-blob-seed":
        if (newValue === this._writingSeed) return; // ignore our own write-back
        this._readConfig(name);
        this._retuneShape();
        break;
      case "data-blob-morph-tween":
      case "data-blob-morph-intensity":
        this._readConfig(name);
        break;
      case "data-blob-drift-speed":
        this._readConfig(name);
        this._setDriftSpeed(this.driftSpeed);
        break;
      case "data-blob-drift-start-position":
        if (this.driftInitialized) {
          this.initDrift(true);
          this.style.transform = `translate3d(${this.driftPosX}px, ${this.driftPosY}px, 0)`;
        }
        break;
      case "data-blob-drift-intensity":
        this._readConfig(name);
        break;
      case "data-blob-drift-bias":
        this._readConfig(name);
        this._driftInsetInputs = null; // update the inset on the next frame
        break;
      case "data-blob-wobble-speed":
      case "data-blob-wobble-intensity":
        this._applyWobbleVars(name);
        break;
      case "data-blob-morph-speed": {
        const automatic = this._automaticLayers.has("Morph");
        this._readConfig(name);
        if (this._morphing) this.playMorph(this.speed);
        else this._morphDuration = this.speed;
        if (automatic) this._automaticLayers.add("Morph");
        break;
      }
      case "data-blob-wobble-autoplay":
        this._syncAutoplay("Wobble");
        break;
      case "data-blob-morph-autoplay":
        this._syncAutoplay("Morph");
        break;
      case "data-blob-drift-autoplay":
        this._syncAutoplay("Drift");
        if (!this._boolAttr(name, false)) {
          this.classList.remove("dynamo-blob--drift");
          this.style.transform = "";
          this.driftInitialized = false;
        }
        break;
      case "data-blob-drift-click":
        this._applyClick();
        break;
      case "data-blob-observe":
        this._applyObserve();
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
        if (newValue === "false") this.pause();
        else this.play();
        break;
    }
  }

  _readConfig(changed) {
    if (!changed || changed === "data-blob-points") {
      const pointsAttr = parseInt(this.getAttribute("data-blob-points"), 10);
      this.points = Number.isFinite(pointsAttr) ? Math.max(3, pointsAttr) : 10;
    }
    if (!changed || changed === "data-blob-variance") {
      const varianceAttr = parseFloat(this.getAttribute("data-blob-variance"));
      this.variance = Number.isFinite(varianceAttr) ? varianceAttr : 8;

    }
    if (!changed || changed === "data-blob-morph-speed") {
      // Continuous cycles require a finite positive duration.
      const speedAttr = parseFloat(this.getAttribute("data-blob-morph-speed"));
      this.speed = Number.isFinite(speedAttr) && speedAttr > 0 ? speedAttr : 7500;
    }
    if (!changed || changed === "data-blob-morph-tween") {
      const tweenAttr = parseFloat(this.getAttribute("data-blob-morph-tween"));
      this.morphMs = Number.isFinite(tweenAttr) ? tweenAttr : 600;
    }
    if (!changed || changed === "data-blob-morph-intensity") {
      const morphIntensityAttr = parseFloat(this.getAttribute("data-blob-morph-intensity"));
      this.morphIntensity = Number.isFinite(morphIntensityAttr)
        ? Math.max(0, morphIntensityAttr)
        : 1;
    }
    if (!changed || changed === "data-blob-drift-speed") {
      const driftAttr = parseFloat(this.getAttribute("data-blob-drift-speed"));
      this.driftSpeed = Number.isFinite(driftAttr) ? Math.max(0, driftAttr) : 1.25;
    }
    if (!changed || changed === "data-blob-drift-intensity") {
      const driftIntensityAttr = parseFloat(this.getAttribute("data-blob-drift-intensity"));
      this.driftIntensity = Number.isFinite(driftIntensityAttr)
        ? Math.max(0, driftIntensityAttr)
        : 1;
    }
    if (!changed || changed === "data-blob-drift-bias") {
      const biasAttr = parseFloat(this.getAttribute("data-blob-drift-bias"));
      this.driftBias = Number.isFinite(biasAttr)
        ? Math.max(DRIFT_BIAS_MIN, Math.min(DRIFT_BIAS_MAX, biasAttr))
        : DRIFT_BIAS_DEFAULT;
    }
    if (!changed || changed === "data-blob-seed") {
      // Seed: a user-provided decodable path reproduces an exact shape; any other
      // non-empty user string deterministically drives generation. The element's
      // own write-back (updateSeedAttribute) is *not* a seed — treating it as one
      // would make every retune target the shape already on screen, turning the
      // reactive shape attributes (points / variance) into no-ops.
      const seedAttr = this.getAttribute("data-blob-seed");
      const hasSeed = typeof seedAttr === "string" && seedAttr.trim() !== "";
      this._hasUserSeed = hasSeed && seedAttr !== this._writingSeed;
      if (this._hasUserSeed) {
        const decoded = decodeBlobSeed(seedAttr);
        if (decoded && SEED_PATH_RE.test(decoded.trim())) {
          this._seedPath = decoded.trim();
          this.seedString = null;
        } else {
          this._seedPath = null;
          this.seedString = seedAttr;
        }
      } else {
        this._seedPath = null;
        this.seedString = null;
      }
    }
    this._applyWobbleVars(changed);
  }

  _applyWobbleVars(changed) {
    if (!changed || changed === "data-blob-wobble-speed") {
      const wobbleSpeed = parseFloat(this.getAttribute("data-blob-wobble-speed"));
      this.style.setProperty(
        "--dynamo-blob-time",
        `${Number.isFinite(wobbleSpeed) ? wobbleSpeed : 30000}ms`,
      );
    }
    if (!changed || changed === "data-blob-wobble-intensity") {
      const wobbleIntensity = parseFloat(this.getAttribute("data-blob-wobble-intensity"));
      this.style.setProperty(
        "--dynamo-blob-intensity",
        String(Number.isFinite(wobbleIntensity) ? wobbleIntensity : 2),
      );
    }
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
    // Don't stamp state until connectedCallback has finished deciding it. A
    // setup-time reflect would write partial state (e.g. is-drifting="false"
    // before drift starts) that _initialLayerState then reads back as an
    // explicit "off", suppressing that layer's autoplay. The connect path runs
    // one _reflectState() at the end, which captures the real combined state.
    if (!this._connected || this._initializing) return;
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

  // (Re)build the viewport observer from data-blob-observe. Setting, changing,
  // or removing the attribute applies live; removal stops the regeneration.
  _applyObserve() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    const config = this.getAttribute("data-blob-observe");
    if (config) this.setupIntersectionObserver(config);
  }

  _applyClick() {
    if (this._boolAttr("data-blob-drift-click", false)) {
      this.classList.add("dynamo-blob--clickable");
      this.addEventListener("click", this._onClick);
      this.addEventListener("keydown", this._onClickKeydown);
      this.addEventListener("keyup", this._onClickKeyup);
      this.addEventListener("blur", this._onClickBlur);

      // A clickable blob is a real control. Keep the generated SVG decorative,
      // but expose the host as a keyboard-operable button. Authored role, focus,
      // and accessible-name attributes win over these defaults.
      this._clearManagedClickAttribute("aria-hidden");
      if (this.getAttribute("aria-hidden") === "true") {
        this.removeAttribute("aria-hidden");
      }
      this._setManagedClickAttribute("role", "button");
      this._setManagedClickAttribute("tabindex", "0");
      if (!this.hasAttribute("aria-label") && !this.hasAttribute("aria-labelledby")) {
        this._setManagedClickAttribute("aria-label", "Deflect blob");
      }
    } else {
      this.classList.remove("dynamo-blob--clickable");
      this.removeEventListener("click", this._onClick);
      this.removeEventListener("keydown", this._onClickKeydown);
      this.removeEventListener("keyup", this._onClickKeyup);
    this.removeEventListener("blur", this._onClickBlur);
    this._spaceArmed = false;
      this._clearManagedClickAttribute("role");
      this._clearManagedClickAttribute("tabindex");
      this._clearManagedClickAttribute("aria-label");
      this._setManagedClickAttribute("aria-hidden", "true");
    }
  }

  _setManagedClickAttribute(name, value) {
    if (this.hasAttribute(name)) return;
    this.setAttribute(name, value);
    this._managedClickAttributes.set(name, value);
  }

  _clearManagedClickAttribute(name) {
    const value = this._managedClickAttributes.get(name);
    if (value !== undefined && this.getAttribute(name) === value) {
      this.removeAttribute(name);
    }
    this._managedClickAttributes.delete(name);
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
    this.isGeneratingBlob = false; // an in-flight generateNewBlob is superseded
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
    this._disconnectedPath = this.path?.getAttribute("d") || this.currentPath;
    // Clear the connected flag first: the pauses below must not stamp "false"
    // into the data-blob-is-* attributes, or a reconnect (the element being
    // moved in the DOM) would read them back as an explicit user "off" and
    // never resume that layer's play state.
    this._resumeLayers = ["Wobble", "Morph", "Drift"].filter(layer => layer === "Morph" ? this._morphing : this[`is${{ Wobble: "Wobbling", Drift: "Drifting" }[layer]}`]);
    this._disconnecting = true;
    this._resumeAutomatic = new Set(this._automaticLayers);
    this._connected = false;
    this._motionQuery?.removeEventListener?.("change", this._onMotionChange);
    this.pauseMorph();
    this.stopDrift();
    // Kill any non-morph tween (retune / generateNewBlob) so it can't keep
    // writing to the torn-down DOM or leave isGeneratingBlob wedged.
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    this.isGeneratingBlob = false;
    this._disconnecting = false;
    this.removeEventListener("click", this._onClick);
    this.removeEventListener("keydown", this._onClickKeydown);
    this.removeEventListener("keyup", this._onClickKeyup);
    this.removeEventListener("blur", this._onClickBlur);
    this._spaceArmed = false;
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

  // Request a radial perturbation of the baseline. Radius bounds may reduce
  // the resulting displacement, particularly at high intensity.
  nextMorphTarget(fromPath) {
    return nextMorphShape(fromPath, {
      variance: this.variance,
      intensity: this.morphIntensity,
      random: Math.random,
    });
  }

  // --- unified controls ---------------------------------------------------
  // Every control method returns the element so calls chain, e.g.
  // blob.pauseWobble().playMorph().playDrift(2).
  //
  // Resume the layers the blob is configured to auto-play. An options key
  // *forces* that layer on (and tunes it). Durations are in ms (morph, wobble);
  // drift takes a speed multiplier. Explicit play ignores prefers-reduced-motion
  // — that gate only applies to auto-play on render.
  play(options = {}) {
    if (!this._connected) return this;
    this._masterPaused = false;
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
    return this;
  }

  // Freeze all three layers in place.
  pause() {
    this._masterPaused = true;
    if (!this._connected) { this._resumeLayers = []; this._resumeAutomatic = new Set(); }
    this.pauseWobble();
    this.pauseMorph();
    this.pauseDrift();
    return this;
  }

  // --- wobble (CSS) -------------------------------------------------------
  // Resume the ambient wobble. An optional period (ms) sets the turn cycle.
  playWobble(durationMs) {
    if (!this._connected) return this;
    this._automaticLayers.delete("Wobble");
    if (Number.isFinite(durationMs)) {
      this.style.setProperty("--dynamo-blob-time", `${durationMs}ms`);
    }
    this._wobbling = true;
    this._reflectState();
    return this;
  }

  // Freeze the wobble at its current position (animation-play-state: paused).
  pauseWobble() {
    if (!this._connected && !this._disconnecting) {
      this._resumeLayers = this._resumeLayers?.filter(layer => layer !== "Wobble");
      this._resumeAutomatic?.delete("Wobble");
    }
    this._automaticLayers.delete("Wobble");
    this._wobbling = false;
    this._reflectState();
    return this;
  }

  // --- morph loop ---------------------------------------------------------
  playMorph(customDuration = null) {
    if (!this._connected) return this;
    this._automaticLayers.delete("Morph");
    const duration = Number.isFinite(customDuration) ? Math.max(1, customDuration) : (this._morphDuration || this.speed);
    if (this._morphing && duration === this._morphDuration) return this;
    if (this._morphing) this.pauseMorph();
    if (this.animationFrameId != null) {
      this.currentPath = this.path?.getAttribute("d") || this.currentPath;
      this._morphProgress = 0;
    }
    this._morphing = true;
    this._morphDuration = duration;
    this._reflectState();

    // A non-morph tween may be in flight (e.g. a retune snap or a
    // generateNewBlob); supersede it so two loops don't write to the same path.
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isGeneratingBlob = false;

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
    return this;
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
    if (!this._connected && !this._disconnecting) {
      this._resumeLayers = this._resumeLayers?.filter(layer => layer !== "Morph");
      this._resumeAutomatic?.delete("Morph");
    }
    this._automaticLayers.delete("Morph");
    const continuous = this._morphing;
    if (!continuous && this.animationFrameId == null) {
      this._reflectState();
      return this;
    }
    this._morphing = false;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    if (this.isGeneratingBlob || !continuous) {
      // A generation requested during continuous morphing shares this frame
      // loop. Pausing freezes the exact rendered silhouette and clears the
      // one-off target rather than leaving generation permanently wedged.
      this.currentPath = this.path?.getAttribute("d") || this.currentPath;
      this.targetPath = this.currentPath;
      this.pendingPath = null;
      this.isGeneratingBlob = false;
      this._morphProgress = 0;
    } else {
      // Freeze the tween as a fraction of its duration (not raw ms), so resume is
      // seamless even if the morph speed changes meanwhile. startTime already folds
      // in any prior elapsedTime, so read it directly — never accumulate, or
      // repeated pause/resume double-counts and the morph leaps forward.
      if (this.startTime != null && this._morphDuration > 0) {
        const elapsed = this._lastTweenElapsed ?? 0;
        this._morphProgress = Math.max(0, Math.min(elapsed / this._morphDuration, 1));
      }
    }
    this.elapsedTime = 0;
    this.startTime = null;
    this._reflectState();
    return this;
  }

  // --- drift --------------------------------------------------------------
  // Resume drift from its current position. An optional speed multiplier
  // updates driftSpeed (rescaling live velocity when already initialized).
  playDrift(speed) {
    if (!this._connected) return this;
    this._automaticLayers.delete("Drift");
    if (Number.isFinite(speed)) this._setDriftSpeed(speed);
    return this.startDrift();
  }

  // Freeze drift in place (keeps position; resumes from here).
  _setDriftSpeed(speed) {
    const heading = Math.hypot(this.driftVelX, this.driftVelY) ? Math.atan2(this.driftVelY, this.driftVelX) : (this._driftHeading ?? Math.PI / 4);
    this._driftHeading = heading;
    this.driftSpeed = Math.max(0, speed);
    const magnitude = this.driftSpeed * 0.1 * Math.SQRT2;
    this.driftVelX = Math.cos(heading) * magnitude;
    this.driftVelY = Math.sin(heading) * magnitude;
  }

  pauseDrift() {
    if (!this._connected && !this._disconnecting) {
      this._resumeLayers = this._resumeLayers?.filter(layer => layer !== "Drift");
      this._resumeAutomatic?.delete("Drift");
    }
    this._automaticLayers.delete("Drift");
    return this.stopDrift();
  }

  // One-shot regenerate + morph (analogous to a manual shuffle).
  generateNewBlob(duration = 800) {
    if (!this._connected) return this;
    if (prefersReducedMotion()) duration = 1;
    if (!Number.isFinite(duration) || duration < 1) duration = 1;

    // Retarget from the exact frame on screen. If the continuous morph loop is
    // active, the generated silhouette temporarily becomes its destination;
    // once reached, the normal loop carries on from those new points.
    const resumeMorph = this._morphing;
    const displayedPath = this.path?.getAttribute("d") || this.currentPath;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    this.currentPath = displayedPath;
    this.targetPath = this.generatePathString();
    this.pendingPath = null;
    this.elapsedTime = 0;
    this.startTime = null;
    this._morphProgress = 0;
    this.isGeneratingBlob = true;

    this.animateBlob(duration, () => {
      this.currentPath = this.targetPath;
      this.updateSeedAttribute(this.currentPath);
      this.isGeneratingBlob = false;

      if (resumeMorph && this._morphing) {
        this.targetPath = this.nextMorphTarget(this.currentPath);
        this.pendingPath = this.nextMorphTarget(this.targetPath);
        this._morphLoop();
      } else {
        this.targetPath = this.currentPath;
        this.pendingPath = null;
      }
    });
    return this;
  }

  animateBlob(duration, onComplete = null) {
    if (!this._connected) return;
    if (!Number.isFinite(duration) || duration < 1) duration = 1; // NaN/negative would never reach progress 1
    const endPoints = parseBlobPath(this.targetPath);
    const startPoints = resampleClosed(parseBlobPath(this.currentPath), endPoints.length);

    this._lastTweenElapsed = this.elapsedTime;
    const animate = (timestamp) => {
      if (!this._connected) return;
      if (this.startTime == null) this.startTime = timestamp - this.elapsedTime;
      const elapsed = timestamp - this.startTime;
      this._lastTweenElapsed = elapsed;
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
        // Clear the frame id before onComplete (which may start a new tween) —
        // a stale id here read as "a tween is running" and permanently blocked
        // generateNewBlob and the data-blob-observe regeneration.
        this.animationFrameId = null;
        this.elapsedTime = 0;
        this.startTime = null;
        if (onComplete) onComplete();
        this._reflectState();
        if (typeof CustomEvent === "function") {
          this.dispatchEvent(
            new CustomEvent("dynamo-blob-complete", { detail: { duration } }),
          );
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
    this._reflectState();
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

    const observer = new IntersectionObserver(
      (entries) => {
        if (!this._connected || this.intersectionObserver !== observer) return;
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            this.generateNewBlob();
            if (isOneTime && this.intersectionObserver === observer) {
              observer.disconnect();
              this.intersectionObserver = null;
            }
          }
        });
      },
      { root: null, rootMargin, threshold: 0 },
    );
    this.intersectionObserver = observer;
    observer.observe(this);
  }

  // --- drift ("DVD"-style bounce) -----------------------------------------
  startDrift() {
    if (!this._connected || this.driftFrameId != null) return this;
    // Initialise before going absolute so a "current" start can read the
    // element's laid-out position (offsetLeft/Top) while it's still in flow.
    this._driftGeometry = subscribeDriftGeometry(this);
    if (!this.driftInitialized) this.initDrift();
    this.classList.add("dynamo-blob--drift");
    this._driftGeometry.refresh();
    let previousTime = performance.now();
    const step = (timestamp) => {
      if (!this._connected) return;
      const frames = Math.max(0, Math.min(timestamp - previousTime, 100)) / (1000 / 60);
      previousTime = timestamp;
      // Shared geometry reads are flushed before any drifting host writes.
      const { w, h, pw, ph } = this.driftBounds();
      if (!(w > 0 && h > 0 && pw > 0 && ph > 0)) {
        this.driftFrameId = requestAnimationFrame(step);
        return;
      }
      if (this._driftNeedsPosition) this.initDrift();
      this.driftPosX += this.driftVelX * frames;
      this.driftPosY += this.driftVelY * frames;
      // Layout, shape, and collision bias have separate invalidation sources.
      // A static silhouette never needs its collision inset recalculated.
      const pathData = this.path?.getAttribute("d");
      const inputs = this._driftInsetInputs;
      if (!inputs || inputs.w !== w || inputs.h !== h ||
          inputs.bias !== this.driftBias || inputs.path !== pathData) {
        this._driftInset = this.measureDriftInset(w, h);
        this._driftInsetInputs = { w, h, bias: this.driftBias, path: pathData };
      }
      const insetX = this._driftInset ? this._driftInset.x : 0;
      const insetY = this._driftInset ? this._driftInset.y : 0;
      const minX = -insetX;
      const maxX = pw - w + insetX;
      const minY = -insetY;
      const maxY = ph - h + insetY;
      // On a wall hit, bounce. drift-intensity reshapes the bounce *angle*
      // (speed is preserved) — see _bounceOffWalls. Detect the hit(s) first so a
      // corner reflects off both walls in a single, combined bounce.
      const hitX = this.driftPosX > maxX || this.driftPosX < minX;
      const hitY = this.driftPosY > maxY || this.driftPosY < minY;
      if (hitX || hitY) {
        this._bounceOffWalls(hitX, hitY);
        if (hitX) this.driftPosX = Math.max(minX, Math.min(this.driftPosX, maxX));
        if (hitY) this.driftPosY = Math.max(minY, Math.min(this.driftPosY, maxY));
      }
      this.style.transform = `translate3d(${this.driftPosX}px, ${this.driftPosY}px, 0)`;
      this.driftFrameId = requestAnimationFrame(step);
    };
    this.driftFrameId = requestAnimationFrame(step);
    this._reflectState();
    return this;
  }

  // Reflect the velocity off the wall(s) just struck, then let drift-intensity
  // reshape the bounce ANGLE — speed is preserved (tuning the pace is
  // drift-speed's job).
  //
  // The bounce angle is read from the wall's inward normal: 0 leaves
  // perpendicular (the most extreme deflection), ±90° skims along the wall (the
  // shallowest). A clean mirror leaves at the angle it arrived. drift-intensity
  // tunes that angle, with the random spread scaled by its distance from 1:
  //   • 1   → the clean mirror angle, identical every bounce.
  //   • >1  → biased steep + randomized → sharp, varied "extreme" ricochets.
  //   • <1  → biased shallow + randomized → grazing "shallow" skims.
  // The effect saturates by ~0 and ~2 (further out adds nothing).
  _bounceOffWalls(hitX, hitY) {
    let vx = this.driftVelX;
    let vy = this.driftVelY;
    const speed = Math.hypot(vx, vy) || this.driftSpeed * 0.1;
    // Mirror reflection: flip whichever component faces a wall we hit.
    if (hitX) vx = -vx;
    if (hitY) vy = -vy;

    const k = this.driftIntensity - 1;
    if (!k) {
      // intensity 1: a plain elastic mirror bounce, every time.
      this.driftVelX = vx;
      this.driftVelY = vy;
      return;
    }

    // Inward normal points back into the field along the reflected axis; a
    // corner hit averages both walls into one diagonal normal. The tangent runs
    // along the wall.
    let nx = hitX ? Math.sign(vx) : 0;
    let ny = hitY ? Math.sign(vy) : 0;
    const nlen = Math.hypot(nx, ny) || 1;
    nx /= nlen;
    ny /= nlen;
    const tx = -ny;
    const ty = nx;

    // Split the mirror bounce into its normal part (>= 0 — it always leaves the
    // wall) and signed tangential part, then read the bounce angle off the normal.
    const vn = Math.abs(vx * nx + vy * ny);
    const vt = vx * tx + vy * ty;
    const phiMirror = Math.atan2(vt, vn); // (-pi/2, pi/2)

    // |k| sets how much randomness; the sign sets the flavour — >1 steepens
    // toward the normal (extreme), <1 flattens toward the wall (shallow).
    const amt = Math.min(Math.abs(k), 1);
    const LIMIT = Math.PI / 2 - 0.12; // never fully parallel, or it'd never leave
    const graze = Math.sign(vt) || (Math.random() < 0.5 ? 1 : -1);
    const target = k > 0 ? 0 : graze * LIMIT; // steep vs grazing
    let phi = phiMirror + (target - phiMirror) * amt; // bias toward the flavour
    phi += (Math.random() * 2 - 1) * amt * (Math.PI / 2); // random scatter
    phi = Math.max(-LIMIT, Math.min(LIMIT, phi));

    // Rebuild the velocity from the reshaped angle, preserving speed.
    const vnOut = Math.cos(phi) * speed;
    const vtOut = Math.sin(phi) * speed;
    this.driftVelX = nx * vnOut + tx * vtOut;
    this.driftVelY = ny * vnOut + ty * vtOut;
  }

  initDrift(reposition = false) {
    const speed = this.driftSpeed * 0.1;
    const { w, h, pw, ph } = this.driftBounds();
    this._driftNeedsPosition = !(w > 0 && h > 0 && pw > 0 && ph > 0);
    const maxX = Math.max(0, pw - w);
    const maxY = Math.max(0, ph - h);
    // Where the bounce begins. Default is a random spot (scatters ambient
    // backgrounds); "current" continues from the element's laid-out position
    // (no teleport), "center" starts from the container's middle.
    const start = (this.getAttribute("data-blob-drift-start-position") || "").toLowerCase();
    if (start === "current" && reposition) return;
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
    if (!reposition) {
      this.driftVelX = Math.random() > 0.5 ? speed : -speed;
      this.driftVelY = Math.random() > 0.5 ? speed : -speed;
    }
    this.driftInitialized = true;
  }

  driftBounds() {
    return this._driftGeometry?.read() || measureDriftGeometry(this);
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
    const pathData = this.path ? this.path.getAttribute("d") : "";
    if (pathData === this._collisionPath) return this._collisionRadius;
    const pts = parseBlobPath(pathData);
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
    this._collisionPath = pathData;
    this._collisionRadius = sum / count;
    return this._collisionRadius;
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
    this._driftGeometry?.release();
    this._driftGeometry = null;
    if (this.driftFrameId) cancelAnimationFrame(this.driftFrameId);
    this.driftFrameId = null;
    this._reflectState();
    return this;
  }

  // Click deflect: redirect the drifting blob. drift-intensity tunes how sharply
  // it turns from its current heading — the same extremity scale as a wall bounce:
  //   • 1   → a fully random new direction (turn spread evenly over the circle).
  //   • >1  → biased toward a hard reversal → extreme, sharp redirects.
  //   • <1  → biased toward the current heading → shallow nudges (→ 0 turns none).
  // Speed is preserved; only the angle changes.
  deflect() {
    const speed = Math.hypot(this.driftVelX, this.driftVelY) || this.driftSpeed * 0.1;
    const heading =
      this.driftVelX || this.driftVelY
        ? Math.atan2(this.driftVelY, this.driftVelX)
        : Math.random() * 2 * Math.PI;
    // Turn magnitude away from the heading: 0 keeps going straight, π reverses.
    // The intensity exponent skews the random pick — >1 toward π (reverse), <1
    // toward 0 (straight on); at 1 it stays uniform, i.e. a fully random heading.
    const turn = Math.pow(Math.random(), 1 / this.driftIntensity) * Math.PI;
    const angle = heading + (Math.random() < 0.5 ? 1 : -1) * turn;
    this.driftVelX = Math.cos(angle) * speed;
    this.driftVelY = Math.sin(angle) * speed;
    return this;
  }
}

// Register (guarded for SSR + double-definition).
if (
  typeof globalThis !== "undefined" &&
  globalThis.customElements &&
  !globalThis.customElements.get("dynamo-blob")
) {
  globalThis.customElements.define("dynamo-blob", DynamoBlob);
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
 * Produce the next morph silhouette as a requested-magnitude perturbation of a base
 * shape. Each vertex radius is nudged in a random direction, then the whole
 * displacement is rescaled so its per-vertex RMS equals `intensity * variance`.
 * Radii are then clamped to BASE_RADIUS ± variance, which can reduce the actual
 * displacement below that request, including to zero at the boundary.
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

export {
  DynamoBlob,
  generateBlobPath,
  generateBlobPoints,
  nextMorphShape,
  parseBlobPath,
  interpolateBlob,
  resampleClosed,
  createSeededRandom,
  encodeBlobSeed,
  decodeBlobSeed,
};
