import { useEffect, type RefObject } from 'react';
import { computeSourceRect, drawRegionToCanvas } from '../lib/captureUtils';
import { detectQrCode } from '../lib/qrDetector';

const TICK_INTERVAL_MS = 250;
// Tickets with longer text fields (name, route, etc.) encode into a denser/higher-version QR —
// 640px wasn't always enough resolution for jsQR to resolve those tickets' modules reliably,
// even though it was plenty for simpler/sparser ones. Kept well under the CCCD QR step's native-
// resolution scan (that one crops to a small guide box first; this one scans the whole camera
// view every tick, so going that far here would cost meaningfully more per-tick CPU).
const DETECTION_LONG_EDGE = 1280;
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
