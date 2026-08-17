import type { RefObject } from 'react';
import type { OverlayTone } from './DocumentOverlay';

interface GuideFrameProps {
  frameRef: RefObject<HTMLDivElement | null>;
  /**
   * 'corners-qr' is a small square frame sized for a QR code; 'corners-document' is a wide
   * landscape frame sized for an ID card/passport photo page — they share the corner-bracket look
   * but must NOT share dimensions, since this element's bounding box is also what capture crops to.
   */
  shape?: 'oval' | 'corners-qr' | 'corners-document';
  /** The guide's own border (or corner brackets, for 'corners-*') changes color with detection status instead of drawing a separate highlight shape. */
  tone?: OverlayTone;
}

/** Fixed guide the user aligns their document/face/QR to. Detection is constrained to this region only, so surrounding clutter can't be mistaken for the target. */
export function GuideFrame({ frameRef, shape = 'corners-document', tone = 'idle' }: GuideFrameProps) {
  const isCorners = shape === 'corners-qr' || shape === 'corners-document';
  return (
    <div ref={frameRef} className={`guide-frame guide-frame--${shape} guide-frame--tone-${tone}`}>
      {isCorners && (
        <>
          <span className="guide-frame__corner guide-frame__corner--tl" />
          <span className="guide-frame__corner guide-frame__corner--tr" />
          <span className="guide-frame__corner guide-frame__corner--bl" />
          <span className="guide-frame__corner guide-frame__corner--br" />
        </>
      )}
    </div>
  );
}
