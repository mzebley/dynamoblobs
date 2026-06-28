// dynamoblobs.d.ts

export interface BlobPoint {
  x: number;
  y: number;
}

export interface BlobGenerationOptions {
  points: number;
  variance: number;
  random?: () => number;
}

export interface BlobPlayOptions {
  /** Morph-loop cycle duration in milliseconds. */
  morph?: number;
  /** Wobble period in milliseconds. */
  wobble?: number;
  /** Drift speed multiplier (same scale as data-blob-drift-speed). */
  drift?: number;
}

declare class DynamoBlob extends HTMLElement {
  // Morph state
  private isAnimating: boolean;
  private animationFrameId: number | null;
  private elapsedTime: number;
  private startTime: number | null;
  private isGeneratingBlob: boolean;
  private currentPath: string | null;
  private targetPath: string | null;
  private pendingPath: string | null;

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
  private svg: SVGSVGElement;
  private path: SVGPathElement;

  constructor();

  static readonly observedAttributes: string[];
  connectedCallback(): void;
  disconnectedCallback(): void;
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void;

  /**
   * Resume every animation the blob is configured to run. A key in `options`
   * forces that animation on (and tunes it) regardless of its config flag;
   * unkeyed animations resume context-aware. Ignores `prefers-reduced-motion`.
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
  'data-blob-points'?: string;
  'data-blob-variance'?: string;
  'data-blob-seed'?: string;
  'data-blob-morph'?: string;
  'data-blob-animate'?: string;
  'data-blob-speed'?: string;
  'data-blob-observe'?: string;
  'data-blob-wobble'?: string;
  'data-blob-wobble-speed'?: string;
  'data-blob-wobble-amount'?: string;
  'data-blob-wobble-paused'?: string;
  'data-blob-drift'?: string;
  'data-blob-drift-speed'?: string;
  'data-blob-drift-start'?: 'random' | 'center' | 'current';
  'data-blob-click'?: string;
  'data-blob-paused'?: string;
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

export {
  DynamoBlob,
  DynamoBlobAttributes,
  generateBlobPath,
  generateBlobPoints,
  parseBlobPath,
  interpolateBlob,
  resampleClosed,
  createSeededRandom,
  encodeBlobSeed,
  decodeBlobSeed,
};
