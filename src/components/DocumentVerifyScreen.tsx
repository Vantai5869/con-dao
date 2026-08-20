import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { CameraView } from './CameraView';
import { GuideFrame } from './GuideFrame';
import { DocumentOverlay, type OverlayTone } from './DocumentOverlay';
import { ScannerScreen } from './ScannerScreen';
import { QrPhotoScannerScreen } from './QrPhotoScannerScreen';
import { CameraIcon } from './CameraIcon';
import { ErrorDialog } from './ErrorDialog';
import { StepHeader } from './StepHeader';
import { loadDocumentScanner } from '../lib/documentDetector';
import { warpToBlob } from '../lib/perspective';
import { canvasToBlob, computeSourceRect, drawRegionToCanvas } from '../lib/captureUtils';
import { useTranslation } from '../lib/i18n';
import type { ScanTick } from '../lib/stabilityMachine';
import { ApiError, uploadPhoto, type UploadType } from '../lib/api';

export type DocType = 'cccd' | 'passport' | 'qr';
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
// Time given to physically flip the card over before auto-scan re-engages — real people take a
// couple of seconds to flip and reposition a physical card, not milliseconds. The scanner is
// paused for this whole window (see the `!showBackSideHint` guard below), not just showing a
// message, so a still-mid-flip card can't get auto-captured as a blurry false positive.
const BACK_SIDE_HINT_MS = 3000;
// The final capture of a document (CCCD back, passport, or the QR photo) is held on screen for at
// least this long before moving on — without it, a fast upload could make the captured photo feel
// like it vanished before the user even saw what got sent.
const MIN_UPLOAD_HOLD_MS = 1000;

function uploadTypeFor(docType: DocType, side: Side): UploadType {
  if (docType === 'qr') return 'QR_CC';
  if (docType === 'passport') return 'PASSPORT';
  return side === 'front' ? 'CC_FRONT' : 'CC_BACK';
}

export function DocumentVerifyScreen({ transactionId, onSuccess, onCancel }: DocumentVerifyScreenProps) {
  const { t, lang } = useTranslation();
  const [docType, setDocType] = useState<DocType>('cccd');
  // The QR tab asks "capture or upload?" before turning the camera on at all — camera access is
  // only requested once "Chụp ảnh" is actually picked, instead of firing (and defaulting to
  // looking like) auto-capture the moment the tab is opened.
  const [qrCaptureChosen, setQrCaptureChosen] = useState(false);
  const cameraEnabled = docType !== 'qr' || qrCaptureChosen;
  const { videoRef, status: cameraStatus, error: cameraError } = useCamera(cameraEnabled, 'environment');
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [scannerReady, setScannerReady] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  // The capture whose upload hasn't been confirmed yet — kept so a failed upload can be retried
  // with the same photo instead of forcing a recapture.
  const [pendingUpload, setPendingUpload] = useState<{ blob: Blob; type: UploadType } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scanTick, setScanTick] = useState<ScanTick>({ status: 'no_document', progress: 0, quad: null });

  const [side, setSide] = useState<Side>('front');
  const [frontBlob, setFrontBlob] = useState<Blob | null>(null);
  const [frontJustCaptured, setFrontJustCaptured] = useState(false);
  const [showBackSideHint, setShowBackSideHint] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const frontThumbUrl = useObjectUrl(frontBlob);
  const pendingUploadUrl = useObjectUrl(pendingUpload?.blob ?? null);
  // The back/passport shot is the final one for this document — freeze it full-screen with a
  // spinner while its upload is awaited, so it's obvious something is happening instead of
  // looking like the capture froze (the front shot already gets its own fly-to-slot animation).
  const showFinalUploadOverlay = uploading && pendingUpload?.type !== 'CC_FRONT';

  useEffect(() => {
    loadDocumentScanner()
      .then(() => setScannerReady(true))
      .catch((err) => setScannerError(err instanceof Error ? err.message : 'Không thể tải mô hình nhận diện giấy tờ.'));
  }, []);

  const resetScan = useCallback(() => {
    setDetectError(null);
    setScanTick({ status: 'no_document', progress: 0, quad: null });
  }, []);

  const handleTick = useCallback((tick: ScanTick) => setScanTick(tick), []);
  const handleError = useCallback((message: string) => setDetectError(message), []);

  // The final side of a document (CCCD back, or the only side for a passport) still waits for its
  // upload before finishing — that response is the last confirmation this document actually made
  // it to the backend before the flow moves away from this screen entirely.
  const attemptFinalUpload = useCallback(
    async (blob: Blob, type: UploadType) => {
      setUploading(true);
      const startedAt = Date.now();
      try {
        await uploadPhoto(blob, type, transactionId, lang);
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_UPLOAD_HOLD_MS) {
          await new Promise((resolve) => setTimeout(resolve, MIN_UPLOAD_HOLD_MS - elapsed));
        }
        setPendingUpload(null);
        onSuccess({ docType, front: type === 'CC_BACK' ? (frontBlob as Blob) : blob, back: type === 'CC_BACK' ? blob : undefined });
      } catch (err) {
        setUploadErrorMessage(err instanceof ApiError ? err.message : t('document.errorNotRecognized'));
      } finally {
        setUploading(false);
      }
    },
    [transactionId, lang, docType, frontBlob, onSuccess, t],
  );

  // CCCD front doesn't gate anything — move on to the back side right away and let the upload run
  // in the background instead of freezing the capture flow on it.
  const attemptFrontUpload = useCallback(
    (blob: Blob) => {
      uploadPhoto(blob, 'CC_FRONT', transactionId, lang)
        .then(() => setPendingUpload(null))
        .catch((err) => setUploadErrorMessage(err instanceof ApiError ? err.message : t('document.errorNotRecognized')));
    },
    [transactionId, lang, t],
  );

  const handleCaptured = useCallback(
    (blob: Blob) => {
      const type = uploadTypeFor(docType, side);
      setPendingUpload({ blob, type });

      if (type === 'CC_FRONT') {
        setFrontBlob(blob);
        setFrontJustCaptured(true);
        attemptFrontUpload(blob);
        return;
      }

      attemptFinalUpload(blob, type);
    },
    [docType, side, attemptFrontUpload, attemptFinalUpload],
  );

  const handleFileSelected = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // allow picking the same file again after an error
      if (file) handleCaptured(file);
    },
    [handleCaptured],
  );

  // A failed upload (network hiccup or the backend rejecting the photo itself, e.g. OCR
  // couldn't read it) always leads back to recapturing rather than resending the same photo —
  // simpler than trying to tell those two cases apart, and a recapture costs the user almost
  // nothing. If it was the front side that failed (and the flow had already moved on to
  // capturing the back in the background), jump back to front to redo it.
  const handleUploadRecapture = useCallback(() => {
    const failedType = pendingUpload?.type;
    setUploadErrorMessage(null);
    setPendingUpload(null);
    if (failedType === 'CC_FRONT') {
      setSide('front');
      setFrontBlob(null);
      setFrontJustCaptured(false);
      setShowBackSideHint(false);
    }
    resetScan();
  }, [pendingUpload, resetScan]);

  useEffect(() => {
    if (!frontJustCaptured) return;
    const timer = setTimeout(() => {
      setFrontJustCaptured(false);
      setSide('back');
      resetScan();
      setShowBackSideHint(true);
    }, FRONT_CAPTURED_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [frontJustCaptured, resetScan]);

  useEffect(() => {
    if (!showBackSideHint) return;
    const timer = setTimeout(() => setShowBackSideHint(false), BACK_SIDE_HINT_MS);
    return () => clearTimeout(timer);
  }, [showBackSideHint]);

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
      setQrCaptureChosen(false);
      resetScan();
    },
    [side, resetScan],
  );

  const cameraReady = cameraStatus === 'ready';
  // QR capture uses jsQR (fast, no model to load), not the document-shape AI model.
  const ready = cameraReady && (docType === 'qr' || scannerReady);
  const showQrChoice = docType === 'qr' && !qrCaptureChosen;

  const title =
    docType === 'qr'
      ? t('document.qrTitle')
      : docType === 'passport'
        ? t('document.passportFront')
        : side === 'front'
          ? t('document.cccdFront')
          : t('document.cccdBack');
  const subtitle = docType === 'qr' ? t('document.qrHint') : docType === 'passport' ? t('document.passportHint') : t('document.cccdHint');

  const statusText = uploading
    ? t('common.uploading')
    : getStatusText({ cameraStatus, cameraError, scannerReady, scannerError, scanTick, docType, t });
  const tone: OverlayTone =
    scanTick.status === 'holding' ? 'holding' : scanTick.status === 'capture' ? 'success' : 'idle';

  return (
    <>
      <StepHeader title={title} subtitle={subtitle} step={3} totalSteps={3} onBack={onCancel} />

      {docType === 'cccd' && (
        <div className="document-verify__thumbs">
          <DocThumbSlot
            index={1}
            url={frontThumbUrl}
            loading={pendingUpload?.type === 'CC_FRONT'}
            onOpen={() => setPreviewOpen(true)}
          />
          <DocThumbSlot index={2} url={null} loading={pendingUpload?.type === 'CC_BACK'} onOpen={() => {}} />
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="document-verify__file-input" onChange={handleFileSelected} />

      {showQrChoice ? (
        <div className="document-verify__qr-choice">
          <div className="document-verify__qr-choice-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 21h3M21 14v3" />
            </svg>
          </div>
          <p className="document-verify__qr-choice-text">{t('document.qrHint')}</p>
          <div className="document-verify__qr-choice-actions">
            <button type="button" className="document-verify__qr-choice-btn" onClick={() => setQrCaptureChosen(true)}>
              <CameraIcon />
              <span>{t('document.captureAction')}</span>
            </button>
            <button
              type="button"
              className="document-verify__qr-choice-btn document-verify__qr-choice-btn--secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
                <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
              </svg>
              <span>{t('document.uploadFromDevice')}</span>
            </button>
          </div>
        </div>
      ) : (
        <CameraView containerRef={containerRef} videoRef={videoRef}>
          <GuideFrame frameRef={frameRef} shape={docType === 'qr' ? 'corners-qr' : 'corners-document'} tone={tone} />
          <DocumentOverlay
            videoRef={videoRef}
            containerRef={containerRef}
            quad={scanTick.quad}
            tone={tone}
            statusText={detectError || uploadErrorMessage || showFinalUploadOverlay || showBackSideHint ? '' : statusText}
            progress={scanTick.progress}
            barBottom={88}
          />

          {frontJustCaptured && frontThumbUrl && (
            <div className="document-verify__front-flash">
              <img className="document-verify__front-fly" src={frontThumbUrl} alt="" />
            </div>
          )}

          {showBackSideHint && (
            <div className="document-verify__flip-hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 2.1l4 4-4 4" />
                <path d="M3 12.2v-2a4 4 0 0 1 4-4h14" />
                <path d="M7 21.9l-4-4 4-4" />
                <path d="M21 11.8v2a4 4 0 0 1-4 4H3" />
              </svg>
              <span>{t('document.backSideHint')}</span>
            </div>
          )}

          {showFinalUploadOverlay && pendingUploadUrl && (
            <div className={docType === 'qr' ? 'document-verify__frozen document-verify__frozen--square' : 'document-verify__frozen'}>
              <img src={pendingUploadUrl} alt="" />
              <div className="document-verify__uploading">
                <span className="document-verify__uploading-spinner" />
                <span>{t('common.uploading')}</span>
              </div>
            </div>
          )}
        </CameraView>
      )}

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
          <button
            type="button"
            className={docType === 'qr' ? 'document-verify__type-btn document-verify__type-btn--active' : 'document-verify__type-btn'}
            onClick={() => selectDocType('qr')}
          >
            {t('document.tabQr')}
          </button>
        </div>
      )}

      {!showQrChoice && cameraReady && !frontJustCaptured && !uploading && (
        <button type="button" className="manual-capture-btn manual-capture-btn--raised" aria-label="Chụp" onClick={manualCapture}>
          <CameraIcon />
        </button>
      )}

      {!showQrChoice && ready && !frontJustCaptured && !uploading && !showBackSideHint && (
        docType === 'qr' ? (
          <QrPhotoScannerScreen
            videoRef={videoRef}
            containerRef={containerRef}
            frameRef={frameRef}
            onCapture={handleCaptured}
          />
        ) : (
          <ScannerScreen
            key={`${docType}-${side}`}
            videoRef={videoRef}
            containerRef={containerRef}
            frameRef={frameRef}
            onTick={handleTick}
            onCapture={handleCaptured}
            onError={handleError}
          />
        )
      )}

      {detectError && <ErrorDialog message={detectError} onRescan={handleRetry} onHome={onCancel} />}

      {uploadErrorMessage && <ErrorDialog message={uploadErrorMessage} onRescan={handleUploadRecapture} onHome={onCancel} />}

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
function DocThumbSlot({
  index,
  url,
  loading,
  onOpen,
}: {
  index: number;
  url: string | null;
  loading?: boolean;
  onOpen: () => void;
}) {
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
      {loading && (
        <span className="document-verify__thumb-loading">
          <span className="document-verify__thumb-spinner" />
        </span>
      )}
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
  scannerReady: boolean;
  scannerError: string | null;
  scanTick: ScanTick;
  docType: DocType;
  t: (key: import('../lib/i18n').TranslationKey) => string;
}): string {
  const { cameraStatus, cameraError, scannerReady, scannerError, scanTick, docType, t } = args;

  if (cameraStatus === 'error') return cameraError ?? t('common.cameraError');
  if (cameraStatus === 'loading') return t('common.loadingCamera');
  // The QR tab uses jsQR (QrPhotoScannerScreen), not the document-shape AI model, so it doesn't
  // wait on scannerReady/scannerError at all.
  if (docType === 'qr') return t('document.qrScanHint');
  if (scannerError) return scannerError;
  if (!scannerReady) return t('common.loadingModel');

  switch (scanTick.status) {
    case 'no_document':
      return t('document.placeHint');
    case 'holding':
      return t('face.holding');
    case 'capture':
      return '';
  }
}
