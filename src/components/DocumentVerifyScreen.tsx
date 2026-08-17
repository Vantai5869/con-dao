import { useCallback, useEffect, useRef, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { CameraView } from './CameraView';
import { GuideFrame } from './GuideFrame';
import { DocumentOverlay, type OverlayTone } from './DocumentOverlay';
import { ScannerScreen } from './ScannerScreen';
import { CameraIcon } from './CameraIcon';
import { ErrorDialog } from './ErrorDialog';
import { StepHeader } from './StepHeader';
import { loadOpenCv } from '../lib/opencv';
import { warpToBlob } from '../lib/perspective';
import { canvasToBlob, computeSourceRect, drawRegionToCanvas } from '../lib/captureUtils';
import { useTranslation } from '../lib/i18n';
import type { ScanTick } from '../lib/stabilityMachine';
import { ApiError, uploadPhoto, type UploadType } from '../lib/api';

export type DocType = 'cccd' | 'passport';
export interface DocumentBlobs {
  docType: DocType;
  front: Blob;
  back?: Blob;
}

interface DocumentVerifyScreenProps {
  transactionId: string;
  onSuccess: (blobs: DocumentBlobs) => void;
  onCancel: () => void;
}

type Side = 'front' | 'back';

const FRONT_CAPTURED_ANIMATION_MS = 600;

function uploadTypeFor(docType: DocType, side: Side): UploadType {
  if (docType === 'passport') return 'PASSPORT';
  return side === 'front' ? 'CC_FRONT' : 'CC_BACK';
}

export function DocumentVerifyScreen({ transactionId, onSuccess, onCancel }: DocumentVerifyScreenProps) {
  const { t, lang } = useTranslation();
  const { videoRef, status: cameraStatus, error: cameraError } = useCamera(true, 'environment');
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const [cvReady, setCvReady] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scanTick, setScanTick] = useState<ScanTick>({ status: 'no_document', progress: 0, quad: null });

  const [docType, setDocType] = useState<DocType>('cccd');
  const [side, setSide] = useState<Side>('front');
  const [frontBlob, setFrontBlob] = useState<Blob | null>(null);
  const [frontJustCaptured, setFrontJustCaptured] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const frontThumbUrl = useObjectUrl(frontBlob);

  useEffect(() => {
    loadOpenCv()
      .then(() => setCvReady(true))
      .catch((err) => setCvError(err instanceof Error ? err.message : 'Không thể tải OpenCV.'));
  }, []);

  const resetScan = useCallback(() => {
    setDetectError(null);
    setScanTick({ status: 'no_document', progress: 0, quad: null });
  }, []);

  const handleTick = useCallback((tick: ScanTick) => setScanTick(tick), []);
  const handleError = useCallback((message: string) => setDetectError(message), []);

  const handleCaptured = useCallback(
    async (blob: Blob) => {
      setUploading(true);
      try {
        await uploadPhoto(blob, uploadTypeFor(docType, side), transactionId, lang);
        if (docType === 'passport' || side === 'back') {
          onSuccess({ docType, front: side === 'front' ? blob : (frontBlob as Blob), back: side === 'back' ? blob : undefined });
          return;
        }
        // CCCD front captured: play the "flies into the slot-1 thumbnail" confirmation
        // before moving on to the back side, so it's obvious the front shot registered.
        setFrontBlob(blob);
        setFrontJustCaptured(true);
      } catch (err) {
        setUploadErrorMessage(err instanceof ApiError ? err.message : t('document.errorNotRecognized'));
      } finally {
        setUploading(false);
      }
    },
    [docType, side, frontBlob, transactionId, lang, t, onSuccess],
  );

  useEffect(() => {
    if (!frontJustCaptured) return;
    const timer = setTimeout(() => {
      setFrontJustCaptured(false);
      setSide('back');
      resetScan();
    }, FRONT_CAPTURED_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [frontJustCaptured, resetScan]);

  const manualCapture = useCallback(async () => {
    const video = videoRef.current;
    const container = containerRef.current;
    const frame = frameRef.current;
    if (!video) return;

    try {
      const blob = scanTick.quad
        ? await warpToBlob(video, scanTick.quad)
        : container && frame
          ? await canvasToBlob(drawRegionToCanvas(video, computeSourceRect(video, container, frame)))
          : null;

      if (blob) handleCaptured(blob);
    } catch (err) {
      setDetectError(err instanceof Error ? err.message : String(err));
    }
  }, [videoRef, containerRef, frameRef, scanTick.quad, handleCaptured]);

  const handleRetry = useCallback(() => {
    setUploadErrorMessage(null);
    resetScan();
  }, [resetScan]);

  const selectDocType = useCallback(
    (next: DocType) => {
      if (side !== 'front') return;
      setDocType(next);
      resetScan();
    },
    [side, resetScan],
  );

  const cameraReady = cameraStatus === 'ready';
  const ready = cameraReady && cvReady;

  const title =
    docType === 'passport' ? t('document.passportFront') : side === 'front' ? t('document.cccdFront') : t('document.cccdBack');
  const subtitle = docType === 'passport' ? t('document.passportHint') : t('document.cccdHint');

  const statusText = uploading ? t('common.uploading') : getStatusText({ cameraStatus, cameraError, cvReady, cvError, scanTick, t });
  const tone: OverlayTone =
    scanTick.status === 'holding' ? 'holding' : scanTick.status === 'capture' ? 'success' : 'idle';

  return (
    <>
      <StepHeader title={title} subtitle={subtitle} step={3} totalSteps={3} onBack={onCancel} />

      {docType === 'cccd' && (
        <div className="document-verify__thumbs">
          <DocThumbSlot index={1} url={frontThumbUrl} onOpen={() => setPreviewOpen(true)} />
          <DocThumbSlot index={2} url={null} onOpen={() => {}} />
        </div>
      )}

      <CameraView containerRef={containerRef} videoRef={videoRef}>
        <GuideFrame frameRef={frameRef} shape="corners-document" tone={tone} />
        <DocumentOverlay
          videoRef={videoRef}
          containerRef={containerRef}
          quad={scanTick.quad}
          tone={tone}
          statusText={detectError || uploadErrorMessage ? '' : statusText}
          progress={scanTick.progress}
          barBottom={88}
        />

        {frontJustCaptured && frontThumbUrl && (
          <div className="document-verify__front-flash">
            <img className="document-verify__front-fly" src={frontThumbUrl} alt="" />
          </div>
        )}
      </CameraView>

      {side === 'front' && !frontJustCaptured && !uploading && (
        <div className="document-verify__type-toggle">
          <button
            type="button"
            className={docType === 'cccd' ? 'document-verify__type-btn document-verify__type-btn--active' : 'document-verify__type-btn'}
            onClick={() => selectDocType('cccd')}
          >
            {t('document.tabCccd')}
          </button>
          <button
            type="button"
            className={
              docType === 'passport' ? 'document-verify__type-btn document-verify__type-btn--active' : 'document-verify__type-btn'
            }
            onClick={() => selectDocType('passport')}
          >
            {t('document.tabPassport')}
          </button>
        </div>
      )}

      {cameraReady && !frontJustCaptured && !uploading && (
        <button type="button" className="manual-capture-btn manual-capture-btn--raised" aria-label="Chụp" onClick={manualCapture}>
          <CameraIcon />
        </button>
      )}

      {ready && !frontJustCaptured && !uploading && (
        <ScannerScreen
          key={`${docType}-${side}`}
          videoRef={videoRef}
          containerRef={containerRef}
          frameRef={frameRef}
          onTick={handleTick}
          onCapture={handleCaptured}
          onError={handleError}
        />
      )}

      {detectError && (
        <ErrorDialog message={t('document.errorNotRecognized')} onRescan={handleRetry} onHome={onCancel} />
      )}

      {uploadErrorMessage && <ErrorDialog message={uploadErrorMessage} onRescan={handleRetry} onHome={onCancel} />}

      {previewOpen && frontThumbUrl && (
        <div className="document-verify__preview-backdrop" onClick={() => setPreviewOpen(false)}>
          <img className="document-verify__preview-img" src={frontThumbUrl} alt="" />
          <button type="button" className="document-verify__preview-close" aria-label="Đóng" onClick={() => setPreviewOpen(false)}>
            ✕
          </button>
        </div>
      )}
    </>
  );
}

/** One slot in the "side 1 / side 2" progress strip shown while capturing a CCCD's front and back; captured slots are tappable to view the photo again. */
function DocThumbSlot({ index, url, onOpen }: { index: number; url: string | null; onOpen: () => void }) {
  const content = (
    <>
      {url ? (
        <img src={url} alt="" />
      ) : (
        <span className="document-verify__thumb-icon">
          <CameraIcon />
        </span>
      )}
      <span className="document-verify__thumb-number">{index}</span>
    </>
  );

  if (!url) {
    return <div className="document-verify__thumb">{content}</div>;
  }

  return (
    <button type="button" className="document-verify__thumb document-verify__thumb--tappable" onClick={onOpen} aria-label={`Xem lại ảnh ${index}`}>
      {content}
    </button>
  );
}

function getStatusText(args: {
  cameraStatus: 'idle' | 'loading' | 'ready' | 'error';
  cameraError: string | null;
  cvReady: boolean;
  cvError: string | null;
  scanTick: ScanTick;
  t: (key: import('../lib/i18n').TranslationKey) => string;
}): string {
  const { cameraStatus, cameraError, cvReady, cvError, scanTick, t } = args;

  if (cameraStatus === 'error') return cameraError ?? t('common.cameraError');
  if (cvError) return cvError;
  if (cameraStatus === 'loading') return t('common.loadingCamera');
  if (!cvReady) return t('common.loadingModel');

  switch (scanTick.status) {
    case 'no_document':
      return t('document.placeHint');
    case 'holding':
      return t('face.holding');
    case 'capture':
      return '';
  }
}
