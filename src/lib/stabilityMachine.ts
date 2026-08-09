import { distance } from './captureUtils';
import type { Quad } from './documentDetector';

export type ScanStatus = 'no_document' | 'holding' | 'capture';

export interface ScanTick {
  status: ScanStatus;
  /** 0..1 progress towards auto-capture, useful for a progress ring/bar. */
  progress: number;
  /** The quad this tick was computed from (for overlay rendering), null if none qualified. */
  quad: Quad | null;
}

/**
 * Tracks how still a detected document quad has been held, in native video
 * pixel space. Any frame where nothing qualifies (no quad, or too small a
 * fraction of the frame) resets the streak immediately, and a quad that moved
 * too much since the last frame restarts the streak at 1 rather than
 * resetting to 0 — the document is still there, it just hasn't settled yet.
 */
export class StabilityTracker {
  private stableCount = 0;
  private prevQuad: Quad | null = null;
  private displacementThreshold: number;
  private minAreaRatio: number;
  private requiredStableFrames: number;

  constructor(displacementThreshold: number, minAreaRatio: number, requiredStableFrames: number) {
    this.displacementThreshold = displacementThreshold;
    this.minAreaRatio = minAreaRatio;
    this.requiredStableFrames = requiredStableFrames;
  }

  reset(): void {
    this.stableCount = 0;
    this.prevQuad = null;
  }

  update(quad: Quad | null, frameWidth: number, frameHeight: number): ScanTick {
    const frameArea = frameWidth * frameHeight;

    if (!quad || quad.area / frameArea < this.minAreaRatio) {
      this.reset();
      return { status: 'no_document', progress: 0, quad: null };
    }

    const frameDiagonal = Math.hypot(frameWidth, frameHeight);
    const displacement = this.prevQuad
      ? averageDisplacement(quad, this.prevQuad) / frameDiagonal
      : Infinity;
    this.prevQuad = quad;

    this.stableCount = displacement > this.displacementThreshold ? 1 : this.stableCount + 1;
    const progress = Math.min(1, this.stableCount / this.requiredStableFrames);

    if (this.stableCount >= this.requiredStableFrames) {
      this.stableCount = 0;
      return { status: 'capture', progress: 1, quad };
    }

    return { status: 'holding', progress, quad };
  }
}

function averageDisplacement(a: Quad, b: Quad): number {
  const total = a.points.reduce((sum, p, i) => sum + distance(p, b.points[i]), 0);
  return total / a.points.length;
}
