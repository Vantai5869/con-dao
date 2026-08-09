import type { CSSProperties, RefObject } from 'react';
import { videoPointToContainerPoint, type Point } from '../lib/captureUtils';
import type { Quad } from '../lib/documentDetector';

export type OverlayTone = 'idle' | 'holding' | 'success';

interface DocumentOverlayProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  quad: Quad | null;
  tone: OverlayTone;
  statusText: string;
  progress: number;
  /** Distance in px from the screen bottom, so callers with extra bottom-anchored controls (toggle, capture button) can keep the pill clear of them. */
  barBottom?: number;
}

// Pure display polish: push the drawn outline out a couple CSS px past the
// detected corners so it visibly wraps the whole document instead of looking
// like it clips the edge. Purely cosmetic — never affects the actual capture crop.
const OVERLAY_EXPAND_PX = 2;

function expandOutward(points: Point[], pixels: number): Point[] {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return points.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / dist) * pixels, y: p.y + (dy / dist) * pixels };
  });
}

/** Draws a polygon that tracks the live-detected document corners, plus a status pill. Pass `quad={null}` to only show the status pill (e.g. when the guide frame's own border is the highlight instead). */
export function DocumentOverlay({ videoRef, containerRef, quad, tone, statusText, progress, barBottom }: DocumentOverlayProps) {
  const video = videoRef.current;
  const container = containerRef.current;

  const screenPoints =
    quad && video && container ? quad.points.map((p) => videoPointToContainerPoint(video, container, p)) : null;
  const expandedPoints = screenPoints ? expandOutward(screenPoints, OVERLAY_EXPAND_PX) : null;
  const polygonPoints = expandedPoints?.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="document-overlay">
      <svg className="document-overlay__svg">
        {polygonPoints && (
          <polygon points={polygonPoints} className={`document-overlay__polygon document-overlay__polygon--${tone}`} />
        )}
      </svg>

      {statusText && (
        <div
          className="document-overlay__bar"
          style={barBottom != null ? ({ '--overlay-bar-bottom': `${barBottom}px` } as CSSProperties) : undefined}
        >
          <div className="document-overlay__status">{statusText}</div>
          <div className="document-overlay__progress">
            <div className="document-overlay__progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
