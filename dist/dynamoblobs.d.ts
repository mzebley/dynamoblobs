// dynamoblobs.d.ts

interface BlobPoint {
  x: number;
  y: number;
}

interface BlobGenerationOptions {
  points: number;
  variance: number;
  random?: () => number;
}

interface NextMorphShapeOptions {
  /** Radius deviation in internal units. */
  variance: number;
  /** Magnitude factor — fraction of variance moved (RMS) per cycle. */
  intensity: number;
  /** RNG (defaults to Math.random). */
  random?: () => number;
}

interface BlobPlayOptions {
  /** Morph-loop cycle duration in milliseconds. */
  morph?: number;
  /** Wobble period in milliseconds. */
  wobble?: number;
  /** Drift speed multiplier (same scale as data-blob-drift-speed). */
  drift?: number;
}

declare class DynamoBlob extends HTMLElement {
  // Morph state
  private _morphing: boolean;
  private animationFrameId: number | null;
  private elapsedTime: number;
  private startTime: number | null;
  private isGeneratingBlob: boolean;
  private currentPath: string | null;
  private targetPath: string | null;
  private pendingPath: string | null;

  // Wobble state
  private _wobbling: boolean;

  // Drift state
  private driftFrameId: number | null;
  private driftPosX: number;
  private driftPosY: number;
  private driftVelX: number;
  private driftVelY: number;
  private driftInitialized: boolean;

  private intersectionObserver: IntersectionObserver | null;
  private random: () => number;
  private points: number;
  private variance: number;
  private speed: number;
  private morphMs: number;
  private morphIntensity: number;
  private driftSpeed: number;
  private driftIntensity: number;
  private driftBias: number;
  private svg: SVGSVGElement;
  private path: SVGPathElement;

  constructor();

  /** True while the ambient wobble is playing. Mirrors data-blob-is-wobbling. */
  readonly isWobbling: boolean;
  /** True while the morph loop is playing. Mirrors data-blob-is-morphing. */
  readonly isMorphing: boolean;
  /** True while drift is playing. Mirrors data-blob-is-drifting. */
  readonly isDrifting: boolean;
  /** True when any layer is playing. Mirrors data-blob-is-animating. */
  readonly isAnimating: boolean;

  static readonly observedAttributes: string[];
  connectedCallback(): void;
  disconnectedCallback(): void;
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void;

  /**
   * Resume the layers the blob is configured to auto-play. A key in `options`
   * forces that layer on (and tunes it) regardless of its auto-play flag.
   * Ignores `prefers-reduced-motion`.
   */
  play(options?: BlobPlayOptions): void;
  /** Freeze wobble, morph, and drift in place. */
  pause(): void;
  /** Resume the ambient CSS wobble; optional period in milliseconds. */
  playWobble(durationMs?: number): void;
  /** Freeze the wobble at its current position. */
  pauseWobble(): void;
  /** Start the continuous morph loop; optional per-cycle duration in milliseconds. */
  playMorph(customDuration?: number | null): void;
  /** Pause the morph loop. */
  pauseMorph(): void;
  /** Resume drift; optional speed multiplier (same scale as data-blob-drift-speed). */
  playDrift(speed?: number): void;
  /** Freeze drift in place (keeps position). */
  pauseDrift(): void;
  /** Regenerate once and morph to the new silhouette. */
  generateNewBlob(duration?: number): void;
  /** Give the drifting blob a random velocity impulse. */
  deflect(): void;

  private generatePathString(): string;
  private nextMorphTarget(fromPath: string): string;
  private animateBlob(duration: number, onComplete?: (() => void) | null): void;
  private updateSeedAttribute(pathString: string): void;
  private setupIntersectionObserver(observeConfig: string): void;
  private startDrift(): void;
  private initDrift(): void;
  private driftBounds(): { w: number; h: number; pw: number; ph: number };
  private stopDrift(): void;
}

declare function generateBlobPath(options: BlobGenerationOptions): string;
declare function generateBlobPoints(
  points: number,
  variance: number,
  random?: () => number,
): BlobPoint[];
declare function nextMorphShape(fromPath: string, options: NextMorphShapeOptions): string;
declare function parseBlobPath(pathString: string): BlobPoint[];
declare function interpolateBlob(
  currentPoints: BlobPoint[],
  targetPoints: BlobPoint[],
  progress: number,
): string;
declare function resampleClosed(pts: BlobPoint[], n: number): BlobPoint[];
declare function createSeededRandom(seed: string | number): () => number;
declare function encodeBlobSeed(pathString: string): string;
declare function decodeBlobSeed(seed: string): string | null;

// Component attributes interface
interface DynamoBlobAttributes {
  // Shape
  'data-blob-points'?: string;
  'data-blob-variance'?: string;
  'data-blob-seed'?: string;
  'data-blob-observe'?: string;

  // Wobble
  'data-blob-wobble-autoplay'?: string;
  'data-blob-is-wobbling'?: string;
  'data-blob-wobble-speed'?: string;
  'data-blob-wobble-intensity'?: string;

  // Morph
  'data-blob-morph-autoplay'?: string;
  'data-blob-is-morphing'?: string;
  'data-blob-morph-speed'?: string;
  'data-blob-morph-intensity'?: string;
  'data-blob-morph-tween'?: string;

  // Drift
  'data-blob-drift-autoplay'?: string;
  'data-blob-is-drifting'?: string;
  'data-blob-drift-speed'?: string;
  'data-blob-drift-intensity'?: string;
  'data-blob-drift-bias'?: string;
  'data-blob-drift-click'?: string;
  'data-blob-drift-start-position'?: 'random' | 'center' | 'current';

  // Master
  'data-blob-is-animating'?: string;
}

declare global {
  interface HTMLElementTagNameMap {
    'dynamo-blob': DynamoBlob;
  }

  namespace JSX {
    interface IntrinsicElements {
      'dynamo-blob': Partial<DynamoBlobAttributes>;
    }
  }
}

export { DynamoBlob, createSeededRandom, decodeBlobSeed, encodeBlobSeed, generateBlobPath, generateBlobPoints, interpolateBlob, nextMorphShape, parseBlobPath, resampleClosed };
export type { BlobGenerationOptions, BlobPlayOptions, BlobPoint, DynamoBlobAttributes, NextMorphShapeOptions };
