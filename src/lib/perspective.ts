import { getCv } from './opencv';
import { canvasToBlob, distance, shrinkQuad, type Point } from './captureUtils';
import type { Quad } from './documentDetector';

// Small outward margin (negative "shrink") so a slightly tight detection still
// captures the document's very edge instead of clipping it.
const CROP_SHRINK_FACTOR = -0.02;

/**
 * Perspective-warps the video frame so the detected quad becomes a flat,
 * axis-aligned rectangle ("scanner" flattening), sized to the quad's own
 * measured width/height rather than a fixed preset aspect ratio.
 */
export async function warpToBlob(video: HTMLVideoElement, quad: Quad): Promise<Blob> {
  const cv = getCv();
  const [tl, tr, br, bl] = shrinkQuad(quad.points, CROP_SHRINK_FACTOR);

  const outputWidth = Math.round(Math.max(distance(tl, tr), distance(bl, br)));
  const outputHeight = Math.round(Math.max(distance(tl, bl), distance(tr, br)));

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = video.videoWidth;
  sourceCanvas.height = video.videoHeight;
  sourceCanvas.getContext('2d')!.drawImage(video, 0, 0);

  const src = cv.imread(sourceCanvas);
  const dst = new cv.Mat();
  const srcTri = pointsToMat(cv, [tl, tr, br, bl]);
  const dstTri = pointsToMat(cv, [
    { x: 0, y: 0 },
    { x: outputWidth - 1, y: 0 },
    { x: outputWidth - 1, y: outputHeight - 1 },
    { x: 0, y: outputHeight - 1 },
  ]);
  const transform = cv.getPerspectiveTransform(srcTri, dstTri);

  try {
    cv.warpPerspective(src, dst, transform, new cv.Size(outputWidth, outputHeight));

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;
    cv.imshow(outputCanvas, dst);

    return await canvasToBlob(outputCanvas);
  } finally {
    src.delete();
    dst.delete();
    srcTri.delete();
    dstTri.delete();
    transform.delete();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pointsToMat(cv: any, points: Point[]) {
  return cv.matFromArray(4, 1, cv.CV_32FC2, points.flatMap((p) => [p.x, p.y]));
}
