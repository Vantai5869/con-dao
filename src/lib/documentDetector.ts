import { getCv, type CV } from './opencv';
import { distance, type Point } from './captureUtils';

export interface Quad {
  /** Ordered top-left, top-right, bottom-right, bottom-left. */
  points: Point[];
  area: number;
}

export interface DetectionResult {
  quad: Quad | null;
}

// `canvas` passed to detectDocument is now just the guide-frame region (not the
// whole camera view), so "frame" below means that guide box, not the full room.
// The document is expected to fill most of the guide box by design.
const MIN_AREA_RATIO = 0.25;
// Still reject a candidate that fills almost the entire guide box AND touches
// all 4 of its edges — that pattern means "no distinct edge found within the
// box", not "document fills the box perfectly" (a real document photographed
// at an angle rarely lines up exactly edge-to-edge with the guide box).
const MAX_AREA_RATIO = 0.95;
// The whole point of the guide box is "align your document inside this" — a
// candidate that touches or crosses its edges is either clipped (real edge is
// outside what we even captured) or is stray background, not a fully-framed
// document. Require a small margin from every edge before it counts.
const EDGE_MARGIN_RATIO = 0.03;
// Fallback (non-4-point) candidates must fill most of their own bounding rotated
// rect to count as "rectangular enough" — filters out blobby background regions
// that happen to have a large bounding box.
const MIN_RECTANGULARITY = 0.85;
// Common document long/short side ratios: ID card ~1.58, A4 ~1.41, letter ~1.29,
// business card ~1.75. Rejects near-square objects (tiles, picture frames) and
// very elongated ones (doors, shelves, table edges) that are common indoor clutter.
const MIN_ASPECT_RATIO = 1.1;
const MAX_ASPECT_RATIO = 2.3;

/**
 * Finds the document's 4-point quadrilateral in `canvas` using two
 * independent passes, merging whichever finds the larger/better result:
 *
 * 1. Edge-based — Canny on **both** luminance and the HSV saturation channel,
 *    OR'd together, then closed with a larger kernel to bridge small gaps in
 *    the boundary. Luminance alone misses a colored document (e.g. a teal ID
 *    card) on a background of similar brightness; saturation alone misses a
 *    white/gray document. Combining both catches either case.
 * 2. Color-based (HSV: bright + low-saturation, i.e. "paper-colored") —
 *    catches plain white/light paper directly as a filled region, which is
 *    more robust than edges when the paper's own boundary contrast is weak.
 *
 * Both fall back to the minimum-area rotated rectangle of their largest
 * contour when no clean 4-point shape is found. Points are in `canvas`'s own
 * pixel space.
 */
export function detectDocument(canvas: HTMLCanvasElement): DetectionResult {
  const cv = getCv();

  const src = cv.imread(canvas);
  const rgb = new cv.Mat();
  const hsv = new cv.Mat();

  const gray = new cv.Mat();
  const blurredGray = new cv.Mat();
  const lumEdges = new cv.Mat();

  const hsvChannels = new cv.MatVector();
  const blurredSat = new cv.Mat();
  const satEdges = new cv.Mat();

  const combinedEdges = new cv.Mat();
  const closedEdges = new cv.Mat();

  const colorMask = new cv.Mat();
  const colorMaskClosed = new cv.Mat();

  const kernel3 = cv.Mat.ones(3, 3, cv.CV_8U);
  const kernel5 = cv.Mat.ones(5, 5, cv.CV_8U);

  try {
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);

    // --- Pass 1a: luminance edges (auto Canny from the frame's own brightness) ---
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurredGray, new cv.Size(5, 5), 0);
    const lumBrightness = cv.mean(blurredGray)[0];
    cv.Canny(blurredGray, lumEdges, Math.max(0, 0.66 * lumBrightness), Math.min(255, 1.33 * lumBrightness));

    // --- Pass 1b: saturation-channel edges (catches colored documents on a similarly-bright background) ---
    cv.split(hsv, hsvChannels);
    const satChannel = hsvChannels.get(1);
    cv.GaussianBlur(satChannel, blurredSat, new cv.Size(5, 5), 0);
    const satBrightness = cv.mean(blurredSat)[0];
    cv.Canny(blurredSat, satEdges, Math.max(0, 0.66 * satBrightness), Math.min(255, 1.33 * satBrightness));
    satChannel.delete();

    cv.bitwise_or(lumEdges, satEdges, combinedEdges);
    cv.morphologyEx(
      combinedEdges,
      closedEdges,
      cv.MORPH_CLOSE,
      kernel5,
      new cv.Point(-1, -1),
      2,
      cv.BORDER_CONSTANT,
      cv.morphologyDefaultBorderValue(),
    );

    // --- Pass 2: color-based (paper = bright + low saturation) ---
    const low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 0, 140, 0]);
    const high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 70, 255, 255]);
    cv.inRange(hsv, low, high, colorMask);
    low.delete();
    high.delete();
    cv.morphologyEx(colorMask, colorMaskClosed, cv.MORPH_CLOSE, kernel3, new cv.Point(-1, -1), 2);

    const frameArea = canvas.width * canvas.height;
    const minArea = frameArea * MIN_AREA_RATIO;
    const maxArea = frameArea * MAX_AREA_RATIO;
    const edgeBest = findQuadInMask(cv, closedEdges, minArea, maxArea, canvas.width, canvas.height);
    const colorBest = findQuadInMask(cv, colorMaskClosed, minArea, maxArea, canvas.width, canvas.height);

    return { quad: pickLarger(edgeBest, colorBest) };
  } finally {
    src.delete();
    rgb.delete();
    hsv.delete();
    gray.delete();
    blurredGray.delete();
    lumEdges.delete();
    hsvChannels.delete();
    blurredSat.delete();
    satEdges.delete();
    combinedEdges.delete();
    closedEdges.delete();
    colorMask.delete();
    colorMaskClosed.delete();
    kernel3.delete();
    kernel5.delete();
  }
}

function pickLarger(a: Quad | null, b: Quad | null): Quad | null {
  if (!a) return b;
  if (!b) return a;
  return b.area > a.area ? b : a;
}

/** Long/short side ratio of a quad, computed from its own measured edge lengths (robust to perspective skew). */
function quadAspectRatio(points: Point[]): number {
  const [tl, tr, br, bl] = points;
  const width = (distance(tl, tr) + distance(bl, br)) / 2;
  const height = (distance(tl, bl) + distance(tr, br)) / 2;
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  return short > 0 ? long / short : Infinity;
}

function isDocumentAspectRatio(ratio: number): boolean {
  return ratio >= MIN_ASPECT_RATIO && ratio <= MAX_ASPECT_RATIO;
}

/** True only if `rect` sits fully inside the frame with a small margin on every side. */
function isWellInsideFrame(
  rect: { x: number; y: number; width: number; height: number },
  frameWidth: number,
  frameHeight: number,
): boolean {
  const marginX = frameWidth * EDGE_MARGIN_RATIO;
  const marginY = frameHeight * EDGE_MARGIN_RATIO;
  return (
    rect.x >= marginX &&
    rect.y >= marginY &&
    rect.x + rect.width <= frameWidth - marginX &&
    rect.y + rect.height <= frameHeight - marginY
  );
}

/** Runs contour -> approxPolyDP (falling back to minAreaRect) on a binary mask. Caller owns `mask`. */
function findQuadInMask(
  cv: CV,
  mask: CV,
  minArea: number,
  maxArea: number,
  frameWidth: number,
  frameHeight: number,
): Quad | null {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  let best: Quad | null = null;

  try {
    cv.findContours(mask, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let largestContourIndex = -1;
    let largestArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = Math.abs(cv.contourArea(contour));

      if (area > largestArea) {
        largestArea = area;
        largestContourIndex = i;
      }

      const perimeter = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const points: Point[] = [];
        for (let j = 0; j < 4; j++) {
          points.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] });
        }
        const ordered = orderPoints(points);

        const approxArea = Math.abs(cv.contourArea(approx));
        const boundingRect = cv.boundingRect(approx);
        const qualifies =
          approxArea > minArea &&
          approxArea < maxArea &&
          isWellInsideFrame(boundingRect, frameWidth, frameHeight) &&
          isDocumentAspectRatio(quadAspectRatio(ordered));
        if (qualifies && (!best || approxArea > best.area)) {
          best = { points: ordered, area: approxArea };
        }
      }

      approx.delete();
      contour.delete();
    }

    if (!best && largestContourIndex >= 0 && largestArea > minArea && largestArea < maxArea) {
      const contour = contours.get(largestContourIndex);
      const rect = cv.minAreaRect(contour);
      const boundingRect = cv.boundingRect(contour);
      const rectArea = rect.size.width * rect.size.height;
      const rectangularity = rectArea > 0 ? largestArea / rectArea : 0;
      const sides = [rect.size.width, rect.size.height];
      const aspectRatio = Math.min(...sides) > 0 ? Math.max(...sides) / Math.min(...sides) : Infinity;
      if (
        rectangularity > MIN_RECTANGULARITY &&
        isWellInsideFrame(boundingRect, frameWidth, frameHeight) &&
        isDocumentAspectRatio(aspectRatio)
      ) {
        best = { points: orderPoints(rotatedRectCorners(rect)), area: largestArea };
      }
      contour.delete();
    }
  } finally {
    contours.delete();
    hierarchy.delete();
  }

  return best;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rotatedRectCorners(rect: any): Point[] {
  const angleRad = (rect.angle * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const hw = rect.size.width / 2;
  const hh = rect.size.height / 2;

  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ].map((p) => ({
    x: rect.center.x + p.x * cos - p.y * sin,
    y: rect.center.y + p.x * sin + p.y * cos,
  }));
}

/** Orders 4 arbitrary points as top-left, top-right, bottom-right, bottom-left. */
function orderPoints(points: Point[]): Point[] {
  const sums = points.map((p) => p.x + p.y);
  const diffs = points.map((p) => p.x - p.y);

  const tl = points[sums.indexOf(Math.min(...sums))];
  const br = points[sums.indexOf(Math.max(...sums))];
  const tr = points[diffs.indexOf(Math.max(...diffs))];
  const bl = points[diffs.indexOf(Math.min(...diffs))];

  return [tl, tr, br, bl];
}
