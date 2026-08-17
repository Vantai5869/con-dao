import { useCallback, useEffect, useRef, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { CameraView } from './CameraView';
import { GuideFrame } from './GuideFrame';
import { DocumentOverlay, type OverlayTone } from './DocumentOverlay';
import { FaceScannerScreen } from './FaceScannerScreen';
import { CameraIcon } from './CameraIcon';
import { ErrorDialog } from './ErrorDialog';
import { StepHeader } from './StepHeader';
import { loadFaceDetector } from '../lib/faceDetector';
import { loadOpenCv } from '../lib/opencv';
import { canvasToBlob, computeSourceRect, drawRegionToCanvas } from '../lib/captureUtils';
import { useTranslation, type TranslationKey } from '../lib/i18n';
import type { ScanTick } from '../lib/stabilityMachine';
import { ApiError, uploadPhoto } from '../lib/api';

const SUCCESS_HOLD_MS = 700;

type Phase = 'scanning' | 'verifying' | 'success';
type FaceErrorKind = 'unclear' | 'sunglasses' | 'mask';

interface FaceVerifyScreenProps {
  transactionId: string;
  onSuccess: (blob: Blob, isNeedPaper: boolean) => void;
  onCancel: () => void;
}

export function FaceVerifyScreen({ transactionId, onSuccess, onCancel }: FaceVerifyScreenProps) {
  const { t, lang } = useTranslation();
  const { videoRef, status: cameraStatus, error: cameraError } = useCamera(true, 'user');
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [faceError, setFaceError] = useState<FaceErrorKind | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [scanTick, setScanTick] = useState<ScanTick>({ status: 'no_document', progress: 0, quad: null });
  const [phase, setPhase] = useState<Phase>('scanning');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isNeedPaper, setIsNeedPaper] = useState(true);
  const capturedUrl = useObjectUrl(capturedBlob);

  useEffect(() => {
    loadFaceDetector()
      .then(() => setModelReady(true))
      .catch((err) => setModelError(err instanceof Error ? err.message : 'Không thể tải mô hình nhận diện khuôn mặt.'));
    // Fire-and-forget: the document step (if not skipped) needs OpenCV, so start downloading it
    // now instead of waiting until the user lands there. Errors are surfaced again from
    // DocumentVerifyScreen's own loadOpenCv() call, so they're safely ignored here.
    loadOpenCv().catch(() => {});
  }, []);

  const handleTick = useCallback((tick: ScanTick) => setScanTick(tick), []);
  const handleError = useCallback(() => setFaceError('unclear'), []);
  const handleOccluded = useCallback((kind: 'sunglasses' | 'mask') => setFaceError(kind), []);
  const handleCapture = useCallback((blob: Blob) => {
    setCapturedBlob(blob);
    setPhase('verifying');
  }, []);
  // Manual capture is the deliberate "I know what I'm doing, take it now" fallback — it never
  // gets blocked by the (imperfect) glasses/mask heuristic, only the automatic path does.
  const manualCapture = useCallback(async () => {
    const video = videoRef.current;
    const container = containerRef.current;
    const frame = frameRef.current;
    if (!video || !container || !frame) return;

    try {
      const blob = await canvasToBlob(drawRegionToCanvas(video, computeSourceRect(video, container, frame)));
      setCapturedBlob(blob);
      setPhase('verifying');
    } catch {
      setFaceError('unclear');
    }
  }, [videoRef, containerRef, frameRef]);
  const handleRetry = useCallback(() => {
    setFaceError(null);
    setUploadErrorMessage(null);
    setCapturedBlob(null);
    setPhase('scanning');
    setScanTick({ status: 'no_document', progress: 0, quad: null });
  }, []);

  useEffect(() => {
    if (phase !== 'verifying' || !capturedBlob) return;
    let cancelled = false;

    uploadPhoto(capturedBlob, 'FACE', transactionId, lang)
      .then((result) => {
        if (cancelled) return;
        setIsNeedPaper(result.isNeedPaper);
        setPhase('success');
      })
      .catch((err) => {
        if (cancelled) return;
        setUploadErrorMessage(err instanceof ApiError ? err.message : t('face.errorUnclear'));
        setPhase('scanning');
      });

    return () => {
      cancelled = true;
    };
  }, [phase, capturedBlob, transactionId, lang, t]);

  useEffect(() => {
    if (phase !== 'success' || !capturedBlob) return;
    const timer = setTimeout(() => onSuccess(capturedBlob, isNeedPaper), SUCCESS_HOLD_MS);
    return () => clearTimeout(timer);
  }, [phase, capturedBlob, isNeedPaper, onSuccess]);

  const cameraReady = cameraStatus === 'ready';
  const ready = cameraReady && modelReady;

  const statusText = getStatusText({ cameraStatus, cameraError, modelReady, modelError, phase, scanTick, t });
  // The bottom pill is reserved for camera/model loading or error states — the mockup shows no
  // guidance pill while calmly scanning, relying on the oval + reminder chips instead.
  const bottomStatusText = cameraStatus === 'error' || modelError || cameraStatus === 'loading' || !modelReady ? statusText : '';
  const tone: OverlayTone =
    phase !== 'scanning'
      ? 'success'
      : scanTick.status === 'holding'
        ? 'holding'
        : scanTick.status === 'capture'
          ? 'success'
          : 'idle';

  return (
    <>
      <StepHeader title={t('face.title')} subtitle={t('face.subtitle')} step={2} totalSteps={3} onBack={onCancel} />

      <CameraView containerRef={containerRef} videoRef={videoRef} mirrored>
        {phase !== 'scanning' && capturedUrl && (
          <div className="face-verify__frozen face-verify__frozen--mirrored">
            <img src={capturedUrl} alt="" />
          </div>
        )}

        <GuideFrame frameRef={frameRef} shape="oval" tone={tone} />
        <DocumentOverlay
          videoRef={videoRef}
          containerRef={containerRef}
          quad={null}
          tone={tone}
          statusText={faceError || uploadErrorMessage ? '' : bottomStatusText}
          progress={phase === 'scanning' ? scanTick.progress : 1}
        />

        {phase === 'verifying' && (
          <div className="face-verify__verifying">
            <span className="face-verify__spinner" />
            <span>{t('face.verifying')}</span>
          </div>
        )}

        {phase === 'success' && (
          <div className="face-verify__success-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </CameraView>

      {phase === 'scanning' && (
        <div className="face-verify__chips">
          <span className="face-verify__chip">{t('face.noSunglasses')}</span>
          <span className="face-verify__chip">{t('face.noMask')}</span>
          <span className="face-verify__chip">{t('face.noHat')}</span>
        </div>
      )}

      {phase === 'scanning' && cameraReady && (
        <button type="button" className="manual-capture-btn" aria-label="Chụp" onClick={manualCapture}>
          <CameraIcon />
        </button>
      )}

      {phase === 'scanning' && ready && (
        <FaceScannerScreen
          videoRef={videoRef}
          containerRef={containerRef}
          frameRef={frameRef}
          onTick={handleTick}
          onCapture={handleCapture}
          onOccluded={handleOccluded}
          onError={handleError}
        />
      )}

      {faceError && <ErrorDialog message={t(faceErrorMessageKey(faceError))} onRescan={handleRetry} onHome={onCancel} />}
      {uploadErrorMessage && <ErrorDialog message={uploadErrorMessage} onRescan={handleRetry} onHome={onCancel} />}
    </>
  );
}

function faceErrorMessageKey(kind: FaceErrorKind): TranslationKey {
  switch (kind) {
    case 'sunglasses':
      return 'face.errorRemoveGlasses';
    case 'mask':
      return 'face.errorRemoveMask';
    case 'unclear':
      return 'face.errorUnclear';
  }
}

function getStatusText(args: {
  cameraStatus: 'idle' | 'loading' | 'ready' | 'error';
  cameraError: string | null;
  modelReady: boolean;
  modelError: string | null;
  phase: Phase;
  scanTick: ScanTick;
  t: (key: TranslationKey) => string;
}): string {
  const { cameraStatus, cameraError, modelReady, modelError, phase, scanTick, t } = args;

  if (cameraStatus === 'error') return cameraError ?? t('common.cameraError');
  if (modelError) return modelError;
  if (cameraStatus === 'loading') return t('common.loadingCamera');
  if (!modelReady) return t('common.loadingModel');
  if (phase === 'verifying') return t('face.verifying');
  if (phase === 'success') return '';

  switch (scanTick.status) {
    case 'no_document':
      return t('face.guideText');
    case 'holding':
      return t('face.holding');
    case 'capture':
      return t('face.verifying');
  }
}
