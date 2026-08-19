import { useEffect, type RefObject } from 'react';
import { computeSourceRect, drawRegionToCanvas } from '../lib/captureUtils';
import { detectQrCode } from '../lib/qrDetector';

const TICK_INTERVAL_MS = 250;
const DETECTION_LONG_EDGE = 640;
// Require the same decoded string twice in a row before accepting it — cheap
// debounce against a rare misread, without needing full geometric stability
// tracking the way document/face detection do.
const REQUIRED_CONSECUTIVE_READS = 2;

interface QrScannerScreenProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  onDecoded: (raw: string) => void;
}

/** Logic-only: runs the QR-decode loop over the whole visible camera view (not just the guide brackets — those are visual guidance only). Renders nothing. */
export function QrScannerScreen({ videoRef, containerRef, onDecoded }: QrScannerScreenProps) {
  useEffect(() => {
    let lastRaw: string | null = null;
    let count = 0;
    let done = false;

    const interval = setInterval(() => {
      if (done) return;

      const video = videoRef.current;
      const container = containerRef.current;
      if (!video || !container || video.readyState < 2) return;

      const rect = computeSourceRect(video, container, container);
      const regionCanvas = drawRegionToCanvas(video, rect, DETECTION_LONG_EDGE);
      const raw = detectQrCode(regionCanvas);

      if (raw && raw === lastRaw) {
        count += 1;
      } else {
        lastRaw = raw;
        count = raw ? 1 : 0;
      }

      if (raw && count >= REQUIRED_CONSECUTIVE_READS) {
        done = true;
        onDecoded(raw);
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [videoRef, containerRef, onDecoded]);

  return null;
}
