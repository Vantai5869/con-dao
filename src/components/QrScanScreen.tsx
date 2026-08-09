import { useCallback, useRef, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { CameraView } from './CameraView';
import { GuideFrame } from './GuideFrame';
import { DocumentOverlay } from './DocumentOverlay';
import { QrScannerScreen } from './QrScannerScreen';
import { TicketSummaryCard } from './TicketSummaryCard';
import { ErrorDialog } from './ErrorDialog';
import { StepHeader } from './StepHeader';
import { useTranslation } from '../lib/i18n';
import { isTicketUsed, parseTicketQr, type Ticket } from '../lib/ticket';

interface QrScanScreenProps {
  onConfirmed: (ticket: Ticket) => void;
  onCancel: () => void;
}

type ErrorKind = 'invalid' | 'used' | null;

/** Step 1: scan the ferry ticket QR, then show its parsed info for confirmation. */
export function QrScanScreen({ onConfirmed, onCancel }: QrScanScreenProps) {
  const { t } = useTranslation();
  const { videoRef, status: cameraStatus, error: cameraError } = useCamera(true, 'environment');
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);
  const [scanKey, setScanKey] = useState(0);

  const handleDecoded = useCallback((raw: string) => {
    const parsed = parseTicketQr(raw);
    if (!parsed) {
      setErrorKind('invalid');
      return;
    }
    if (isTicketUsed(parsed.code)) {
      setErrorKind('used');
      return;
    }
    setTicket(parsed);
  }, []);

  const handleRescan = useCallback(() => {
    setErrorKind(null);
    setTicket(null);
    setScanKey((k) => k + 1);
  }, []);

  const cameraReady = cameraStatus === 'ready';
  const statusText =
    cameraStatus === 'error'
      ? (cameraError ?? t('common.cameraError'))
      : cameraStatus === 'loading'
        ? t('common.loadingCamera')
        : t('qr.hint');

  return (
    <>
      <StepHeader title={t('qr.title')} subtitle={t('qr.subtitle')} step={1} totalSteps={3} onBack={onCancel} />

      <CameraView containerRef={containerRef} videoRef={videoRef}>
        <GuideFrame frameRef={frameRef} shape="corners-qr" tone={ticket ? 'success' : 'idle'} />
        <DocumentOverlay
          videoRef={videoRef}
          containerRef={containerRef}
          quad={null}
          tone="idle"
          statusText={ticket || errorKind ? '' : statusText}
          progress={0}
        />
      </CameraView>

      {cameraReady && !ticket && !errorKind && (
        <QrScannerScreen
          key={scanKey}
          videoRef={videoRef}
          containerRef={containerRef}
          frameRef={frameRef}
          onDecoded={handleDecoded}
        />
      )}

      {ticket && <TicketSummaryCard ticket={ticket} onNext={() => onConfirmed(ticket)} onRescan={handleRescan} />}

      {errorKind && (
        <ErrorDialog
          message={errorKind === 'invalid' ? t('qr.errorInvalid') : t('qr.errorUsed')}
          onRescan={handleRescan}
          onHome={onCancel}
        />
      )}
    </>
  );
}
