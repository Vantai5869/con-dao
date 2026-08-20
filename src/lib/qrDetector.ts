import jsQR from 'jsqr';
import type { Point } from './captureUtils';

export interface QrDetection {
  data: string;
  /** The QR's own 4 corners, in the input canvas's pixel space (not the frame it was cropped from). */
  location: {
    topLeftCorner: Point;
    topRightCorner: Point;
    bottomLeftCorner: Point;
    bottomRightCorner: Point;
  };
}

/** Decodes a QR code from `canvas` along with where its corners are, or returns null if none is found. */
export function detectQrCodeWithLocation(canvas: HTMLCanvasElement): QrDetection | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });
  if (!result) return null;

  return { data: result.data, location: result.location };
}

/** Decodes a QR code from `canvas`, or returns null if none is found. */
export function detectQrCode(canvas: HTMLCanvasElement): string | null {
  return detectQrCodeWithLocation(canvas)?.data ?? null;
}
