import type { ReactNode, RefObject } from 'react';

interface CameraViewProps {
  containerRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Mirror the preview horizontally for the front camera, so it behaves like a selfie mirror instead of feeling reversed. Purely visual — captured frames are read from the unmirrored video element, so photos/detection stay correctly oriented. */
  mirrored?: boolean;
  children?: ReactNode;
}

export function CameraView({ containerRef, videoRef, mirrored, children }: CameraViewProps) {
  return (
    <div ref={containerRef} className="camera-view">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        className={mirrored ? 'camera-view__video camera-view__video--mirrored' : 'camera-view__video'}
        playsInline
        muted
        autoPlay
      />
      {children}
    </div>
  );
}
