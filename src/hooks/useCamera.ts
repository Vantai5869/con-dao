import { useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Camera only requests getUserMedia while `enabled` is true, so the camera
 * light stays off until the user opts in. `facingMode` picks front ("user",
 * for selfies) vs back ("environment", for documents) camera.
 */
export function useCamera(enabled: boolean, facingMode: 'user' | 'environment' = 'environment') {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }

    let stream: MediaStream | null = null;
    let cancelled = false;
    setStatus('loading');

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Trình duyệt không hỗ trợ truy cập camera, hoặc trang không chạy trên HTTPS/localhost.');
        setStatus('error');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('ready');
      } catch (err) {
        setError(
          err instanceof Error
            ? `Không thể truy cập camera: ${err.message}`
            : 'Không thể truy cập camera.',
        );
        setStatus('error');
      }
    }

    start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [enabled, facingMode]);

  return { videoRef, status, error };
}
