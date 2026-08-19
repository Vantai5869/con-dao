import { useEffect, useRef, type RefObject } from 'react';
import { computeSourceRect, drawRegionToCanvas, scaleAndOffsetPoints } from '../lib/captureUtils';
import { detectDocument, type Quad } from '../lib/documentDetector';
import { warpToBlob } from '../lib/perspective';
import { StabilityTracker, type ScanTick } from '../lib/stabilityMachine';

const DETECTION_LONG_EDGE = 640;
const MIN_AREA_RATIO = 0.25; // detected quad must cover at least 25% of the guide box
const DISPLACEMENT_THRESHOLD = 0.025; // normalized avg corner movement (fraction of guide-box diagonal) — loose enough to tolerate normal hand tremor
const STABLE_FRAMES_REQUIRED = 3; // ~0.9s at TICK_INTERVAL_MS — capture soon after a qualifying quad appears
const TICK_INTERVAL_MS = 300;

interface ScannerScreenProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  frameRef: RefObject<HTMLDivElement | null>;
  onTick: (tick: ScanTick) => void;
  onCapture: (blob: Blob) => void;
  onError: (message: string) => void;
}

/**
 * Logic-only: runs the detection loop and drives auto-capture. Renders nothing.
 * Detection is constrained to the guide-frame region (not the whole camera view),
 * so surrounding room clutter can't be mistaken for the document.
 */
export function ScannerScreen({ videoRef, containerRef, frameRef, onTick, onCapture, onError }: ScannerScreenProps) {
  const trackerRef = useRef<StabilityTracker | null>(null);
  if (!trackerRef.current) {
    trackerRef.current = new StabilityTracker(DISPLACEMENT_THRESHOLD, MIN_AREA_RATIO, STABLE_FRAMES_REQUIRED);
  }

  useEffect(() => {
    let capturing = false;

    const interval = setInterval(async () => {
      if (capturing) return;

      const video = videoRef.current;
      const container = containerRef.current;
      const frame = frameRef.current;
      if (!video || !container || !frame || video.readyState < 2) return;

      try {
        const rect = computeSourceRect(video, container, frame);
        const regionCanvas = drawRegionToCanvas(video, rect, DETECTION_LONG_EDGE);
        const { quad: rawQuad } = await detectDocument(regionCanvas);

        // Map from region-canvas-local coords back into full video-native coords.
        const scale = rect.sw / regionCanvas.width;
        const quad: Quad | null = rawQuad
          ? { points: scaleAndOffsetPoints(rawQuad.points, scale, rect.sx, rect.sy), area: rawQuad.area * scale * scale }
          : null;

        const tick = trackerRef.current!.update(quad, rect.sw, rect.sh);
        onTick(tick);

        if (tick.status === 'capture' && tick.quad) {
          capturing = true;
          try {
            const blob = await warpToBlob(video, tick.quad);
            onCapture(blob);
          } finally {
            capturing = false;
          }
        }
      } catch (err) {
        capturing = false;
        onError(err instanceof Error ? err.message : String(err));
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [videoRef, containerRef, frameRef, onTick, onCapture, onError]);

  return null;
}
