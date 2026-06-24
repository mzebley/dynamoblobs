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

  connectedCallback(): void;
  disconnectedCallback(): void;

  /** Start the continuous morph loop. */
  play(customDuration?: number | null): void;
  /** Pause the morph loop. */
  pause(): void;
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
  'data-blob-animate'?: string;
  'data-blob-speed'?: string;
  'data-blob-observe'?: string;
  'data-blob-wobble'?: string;
  'data-blob-wobble-speed'?: string;
  'data-blob-wobble-amount'?: string;
  'data-blob-drift'?: string;
  'data-blob-drift-speed'?: string;
  'data-blob-click'?: string;
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
