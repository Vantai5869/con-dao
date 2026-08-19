import { Scanner } from 'scanic';
import type { Point } from './captureUtils';

export interface Quad {
  /** Ordered top-left, top-right, bottom-right, bottom-left. */
  points: Point[];
  area: number;
}

export interface DetectionResult {
  quad: Quad | null;
}

// EXPERIMENTAL (branch: experiment/scanic-docscan): swapped the hand-rolled OpenCV.js Canny/color
// pipeline for `scanic`'s ML corner detector (DocCornerNet, via onnxruntime-web) — it's explicitly
// built to be more robust on cluttered/low-contrast backgrounds, which is exactly where the old
// pipeline struggled (see the git history for the analysis). It also replaces OpenCV.js outright:
// perspective.ts now uses scanic's own extractDocument() instead of cv.warpPerspective, so
// @techstark/opencv-js (13MB) is no longer a dependency of this app at all.
// Model + runtime are self-hosted under public/scanic-ml/ (vendored from the scanic-ml npm
// package) rather than scanic's jsDelivr default, so this doesn't depend on a third-party CDN
// at runtime — same reasoning as vendoring the face-api.js models.
const scanner = new Scanner({
  detector: 'ml',
  ml: { assetBaseUrl: '/scanic-ml/' },
  mode: 'detect',
});

export async function loadDocumentScanner(): Promise<void> {
  await scanner.initialize();
}

/** Finds the document's 4-point quadrilateral in `canvas`. Points are in `canvas`'s own pixel space. */
export async function detectDocument(canvas: HTMLCanvasElement): Promise<DetectionResult> {
  const result = await scanner.scan(canvas);
  if (!result.success || !result.corners) return { quad: null };

  const { topLeft, topRight, bottomRight, bottomLeft } = result.corners;
  const points: Point[] = [topLeft, topRight, bottomRight, bottomLeft];
  return { quad: { points, area: polygonArea(points) } };
}

/** Shoelace formula — matches what cv.contourArea used to give us, for the area-ratio checks in stabilityMachine.ts. */
function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}
