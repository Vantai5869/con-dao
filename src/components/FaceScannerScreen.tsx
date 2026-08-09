import { useEffect, useRef, type RefObject } from 'react';
import { canvasToBlob, computeSourceRect, drawRegionToCanvas, type SourceRect } from '../lib/captureUtils';
import { assessOcclusion, detectFace, type FaceBox } from '../lib/faceDetector';
import type { Quad } from '../lib/documentDetector';
import { StabilityTracker, type ScanTick } from '../lib/stabilityMachine';

const TICK_INTERVAL_MS = 300;
const STABLE_FRAMES_REQUIRED = 3; // ~0.9s, matches the document flow's tolerance for hand/head tremor
const DISPLACEMENT_THRESHOLD = 0.025;
const MIN_AREA_RATIO = 0.15; // face bbox vs. the guide-oval's bounding rect — faces sit with more margin than documents
const MIN_CONFIDENCE = 0.6;
const POSITION_MARGIN_RATIO = 0.15; // face center must fall within the inner 70% of the guide oval
// TODO: the brightness/uniformity heuristic in assessOcclusion() is producing false positives
// (flagging bare eyes as sunglasses under normal lighting) even after loosening its thresholds
// once. Auto-capture is disabled from blocking on it until it's more reliable — manual capture
// never used this check to begin with. Flip this back on once the heuristic is retuned.
const AUTO_BLOCK_ON_OCCLUSION = false;

interface FaceScannerScreenProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  frameRef: RefObject<HTMLDivElement | null>;
  onTick: (tick: ScanTick) => void;
  onCapture: (blob: Blob) => void;
  /** Fired instead of onCapture when the eyes/mouth look covered right as the face settles. */
  onOccluded: (kind: 'sunglasses' | 'mask') => void;
  onError: (message: string) => void;
}

/**
 * Logic-only: runs the face-detection loop and drives auto-capture. Renders nothing.
 * Unlike document detection, MediaPipe already returns a real face bounding box, so
 * there's no need to crop the input first — we just check it's confidently a face
 * and reasonably centered/sized within the guide oval, then crop the oval region
 * itself (no perspective warp needed) for the output photo.
 */
export function FaceScannerScreen({
  videoRef,
  containerRef,
  frameRef,
  onTick,
  onCapture,
  onOccluded,
  onError,
}: FaceScannerScreenProps) {
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
        const detection = detectFace(video);
        const qualifies =
          detection != null && detection.confidence >= MIN_CONFIDENCE && isWellPositioned(detection.box, rect);
        const quad: Quad | null = qualifies ? boxToQuad(detection!.box) : null;

        const tick = trackerRef.current!.update(quad, rect.sw, rect.sh);
        onTick(tick);

        if (tick.status === 'capture') {
          capturing = true;
          try {
            const occlusion =
              AUTO_BLOCK_ON_OCCLUSION && detection!.keypoints ? assessOcclusion(video, detection!.keypoints) : null;
            if (occlusion?.sunglasses) {
              trackerRef.current!.reset();
              onOccluded('sunglasses');
            } else if (occlusion?.mask) {
              trackerRef.current!.reset();
              onOccluded('mask');
            } else {
              const blob = await canvasToBlob(drawRegionToCanvas(video, rect));
              onCapture(blob);
            }
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
  }, [videoRef, containerRef, frameRef, onTick, onCapture, onOccluded, onError]);

  return null;
}

function isWellPositioned(box: FaceBox, rect: SourceRect): boolean {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const marginX = rect.sw * POSITION_MARGIN_RATIO;
  const marginY = rect.sh * POSITION_MARGIN_RATIO;

  return (
    centerX >= rect.sx + marginX &&
    centerX <= rect.sx + rect.sw - marginX &&
    centerY >= rect.sy + marginY &&
    centerY <= rect.sy + rect.sh - marginY
  );
}

function boxToQuad(box: FaceBox): Quad {
  const { x, y, width, height } = box;
  return {
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
    area: width * height,
  };
}
