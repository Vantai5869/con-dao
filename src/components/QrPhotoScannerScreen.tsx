import { useEffect, type RefObject } from 'react';
import { canvasToBlob, computeSourceRect, drawRegionToCanvas, scaleAndOffsetPoints, type Point, type SourceRect } from '../lib/captureUtils';
import { detectQrCodeWithLocation } from '../lib/qrDetector';

const TICK_INTERVAL_MS = 250;
// Require the same decoded string twice in a row before accepting it — cheap debounce against a
// rare misread, matching QrScannerScreen's ticket-scan loop.
const REQUIRED_CONSECUTIVE_READS = 2;
// Extra margin around the QR's own bounding box so the crop doesn't slice right through its
// border — jsQR's reported corners sit at the code's own edge, not the card/screen's margin.
const CROP_PADDING_RATIO = 0.18;

interface QrPhotoScannerScreenProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  frameRef: RefObject<HTMLDivElement | null>;
  onCapture: (blob: Blob) => void;
}

/**
 * Logic-only: unlike QrScannerScreen (which reports the *decoded text* for the ticket-scan step),
 * this only uses jsQR as a "is there an actually-readable QR in frame" signal — once one decodes
 * confidently, it crops a photo tight to the QR's own detected corners (not the whole guide box)
 * and hands back the blob, never the decoded string. This app stores the CCCD/VNeID QR purely as
 * an image; the backend reads its content, not the frontend.
 *
 * Unlike the ticket-scan step, detection here is constrained to the guide box (not the whole
 * camera view): a CCCD/VNeID QR packs far more data than a ticket QR, so it needs a much
 * higher-version/denser code, and the physical QR printed on a CCCD is small even held close.
 * Scanning the full frame at native resolution gave jsQR too large a search space to reliably find
 * and decode something that dense and that small; cropping first to the (still native-resolution)
 * guide box both shrinks the search space and maximizes real pixel density on the QR itself.
 */
export function QrPhotoScannerScreen({ videoRef, containerRef, frameRef, onCapture }: QrPhotoScannerScreenProps) {
  useEffect(() => {
    let lastRaw: string | null = null;
    let count = 0;
    let done = false;

    const interval = setInterval(async () => {
      if (done) return;

      try {
        const video = videoRef.current;
        const container = containerRef.current;
        const frame = frameRef.current;
        if (!video || !container || !frame || video.readyState < 2) return;

        const rect = computeSourceRect(video, container, frame);
        // The guide box can briefly report a zero size right as this screen mounts, before layout
        // has settled — skip this tick rather than feeding a degenerate crop into getImageData.
        if (rect.sw <= 0 || rect.sh <= 0) return;
        const regionCanvas = drawRegionToCanvas(video, rect);
        const detection = detectQrCodeWithLocation(regionCanvas);
        const raw = detection?.data ?? null;

        if (raw && raw === lastRaw) {
          count += 1;
        } else {
          lastRaw = raw;
          count = raw ? 1 : 0;
        }

        if (raw && count >= REQUIRED_CONSECUTIVE_READS && detection) {
          done = true;
          // Map the QR's corners from the (downscaled) detection canvas back into video-native pixels.
          const scale = rect.sw / regionCanvas.width;
          const corners = scaleAndOffsetPoints(
            [
              detection.location.topLeftCorner,
              detection.location.topRightCorner,
              detection.location.bottomRightCorner,
              detection.location.bottomLeftCorner,
            ],
            scale,
            rect.sx,
            rect.sy,
          );
          const cropRect = squareCropFromPoints(corners, CROP_PADDING_RATIO, video.videoWidth, video.videoHeight);
          const blob = await canvasToBlob(drawRegionToCanvas(video, cropRect));
          onCapture(blob);
        }
      } catch (err) {
        // Swallow-and-retry rather than letting one bad tick silently wedge the whole interval —
        // logged so it's at least visible via remote devtools during testing.
        console.error('QrPhotoScannerScreen tick failed:', err);
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [videoRef, containerRef, frameRef, onCapture]);

  return null;
}

/**
 * A real photo of a physical QR is almost never taken dead-on — even a slight tilt makes its
 * projected shape a skewed quadrilateral, not a true square. Taking the plain axis-aligned
 * bounding box of tilted corners produces a crop that's wider than it is tall (or vice versa),
 * clipping the top/bottom (or sides). This forces a true square crop instead: centered on the
 * corners' own center, sized to the *larger* of their bounding width/height (plus padding), so
 * the whole QR is always included regardless of tilt.
 */
function squareCropFromPoints(points: Point[], paddingRatio: number, maxWidth: number, maxHeight: number): SourceRect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const rawSide = Math.max(maxX - minX, maxY - minY) * (1 + paddingRatio * 2);
  const side = Math.min(rawSide, maxWidth, maxHeight);

  const sx = Math.min(Math.max(0, centerX - side / 2), maxWidth - side);
  const sy = Math.min(Math.max(0, centerY - side / 2), maxHeight - side);

  return { sx, sy, sw: side, sh: side };
}
