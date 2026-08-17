import { useCallback, useRef, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { CameraView } from './CameraView';
import { GuideFrame } from './GuideFrame';
import { DocumentOverlay } from './DocumentOverlay';
import { QrScannerScreen } from './QrScannerScreen';
import { TicketSummaryCard } from './TicketSummaryCard';
import { ErrorDialog } from './ErrorDialog';
import { ResumeStepDialog } from './ResumeStepDialog';
import { StepHeader } from './StepHeader';
import { useTranslation } from '../lib/i18n';
import { parseTicketInfo, type Ticket } from '../lib/ticket';
import { ApiError, registerTransaction } from '../lib/api';

export type QrConfirmedStep = 'face' | 'document';

interface QrScanScreenProps {
  onConfirmed: (ticket: Ticket, transactionId: string, targetStep: QrConfirmedStep) => void;
  onCancel: () => void;
}

/** Step 1: scan the ferry ticket QR, register the transaction, then show the parsed ticket for confirmation. */
export function QrScanScreen({ onConfirmed, onCancel }: QrScanScreenProps) {
  const { t, lang } = useTranslation();
  const { videoRef, status: cameraStatus, error: cameraError } = useCamera(true, 'environment');
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [nextStep, setNextStep] = useState<2 | 3>(2);
  const [registering, setRegistering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showResumeChoice, setShowResumeChoice] = useState(false);
  const [scanKey, setScanKey] = useState(0);

  const handleDecoded = useCallback(
    async (raw: string) => {
      const parsed = parseTicketInfo(raw);
      if (!parsed) {
        setErrorMessage(t('qr.errorInvalid'));
        return;
      }

      setRegistering(true);
      try {
        const result = await registerTransaction(raw, lang);
        setTicket(parsed);
        setTransactionId(result.transactionId);
        setNextStep(result.nextStep);
      } catch (err) {
        setErrorMessage(err instanceof ApiError ? err.message : t('qr.errorInvalid'));
      } finally {
        setRegistering(false);
      }
    },
    [t, lang],
  );

  const handleRescan = useCallback(() => {
    setErrorMessage(null);
    setTicket(null);
    setTransactionId(null);
    setShowResumeChoice(false);
    setScanKey((k) => k + 1);
  }, []);

  const handleNext = useCallback(() => {
    if (nextStep === 3) {
      setShowResumeChoice(true);
      return;
    }
    if (ticket && transactionId) onConfirmed(ticket, transactionId, 'face');
  }, [ticket, transactionId, nextStep, onConfirmed]);

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
          statusText={ticket || errorMessage ? '' : registering ? t('qr.registering') : statusText}
          progress={0}
        />
      </CameraView>

      {cameraReady && !ticket && !errorMessage && !registering && (
        <QrScannerScreen
          key={scanKey}
          videoRef={videoRef}
          containerRef={containerRef}
          frameRef={frameRef}
          onDecoded={handleDecoded}
        />
      )}

      {ticket && !showResumeChoice && <TicketSummaryCard ticket={ticket} onNext={handleNext} onRescan={handleRescan} />}

      {showResumeChoice && ticket && transactionId && (
        <ResumeStepDialog
          onRedo={() => onConfirmed(ticket, transactionId, 'face')}
          onContinue={() => onConfirmed(ticket, transactionId, 'document')}
        />
      )}

      {errorMessage && <ErrorDialog message={errorMessage} onRescan={handleRescan} onHome={onCancel} />}
    </>
  );
}
