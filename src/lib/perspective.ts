import { extractDocument } from 'scanic';
import { canvasToBlob, shrinkQuad } from './captureUtils';
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
  const [topLeft, topRight, bottomRight, bottomLeft] = shrinkQuad(quad.points, CROP_SHRINK_FACTOR);

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = video.videoWidth;
  sourceCanvas.height = video.videoHeight;
  sourceCanvas.getContext('2d')!.drawImage(video, 0, 0);

  const result = await extractDocument(sourceCanvas, { topLeft, topRight, bottomRight, bottomLeft }, { output: 'canvas' });
  if (!result.success || !(result.output instanceof HTMLCanvasElement)) {
    throw new Error(result.message || 'Không thể cắt ảnh giấy tờ.');
  }

  return canvasToBlob(result.output);
}
