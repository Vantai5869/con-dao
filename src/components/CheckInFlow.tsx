import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react';
import { WelcomeScreen } from './WelcomeScreen';
import { QrScanScreen, type QrConfirmedStep } from './QrScanScreen';
import { SuccessScreen } from './SuccessScreen';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorDialog } from './ErrorDialog';
import { ScreenLoading } from './ScreenLoading';
import type { DocumentBlobs } from './DocumentVerifyScreen';
import { generatePassCode, type Ticket } from '../lib/ticket';
import { useTranslation } from '../lib/i18n';

// Lazy-loaded: each pulls in a heavy detection library (MediaPipe / OpenCV.js).
// The welcome/QR screens need neither, so they must not be blocked behind
// downloading them (see the earlier blank-dashboard bug this fixed).
const FaceVerifyScreen = lazy(() => import('./FaceVerifyScreen').then((m) => ({ default: m.FaceVerifyScreen })));
const DocumentVerifyScreen = lazy(() =>
  import('./DocumentVerifyScreen').then((m) => ({ default: m.DocumentVerifyScreen })),
);

type Step = 'welcome' | 'qr' | 'face' | 'document' | 'success';

/** Owns the whole check-in wizard's cross-step state and step transitions, including the server-driven skip-face branch. */
export function CheckInFlow() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('welcome');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [faceBlob, setFaceBlob] = useState<Blob | null>(null);
  const [, setDocumentBlobs] = useState<DocumentBlobs | null>(null);
  const [passCode, setPassCode] = useState('');

  const reset = useCallback(() => {
    setStep('welcome');
    setTicket(null);
    setTransactionId(null);
    setFaceBlob(null);
    setDocumentBlobs(null);
    setPassCode('');
  }, []);

  const finish = useCallback((finalTicket: Ticket) => {
    setPassCode(generatePassCode(finalTicket));
    setStep('success');
  }, []);

  const handleQrConfirmed = useCallback((confirmedTicket: Ticket, confirmedTransactionId: string, targetStep: QrConfirmedStep) => {
    setTicket(confirmedTicket);
    setTransactionId(confirmedTransactionId);
    setStep(targetStep);
  }, []);

  const handleFaceSuccess = useCallback(
    (blob: Blob, isNeedPaper: boolean) => {
      setFaceBlob(blob);
      if (isNeedPaper) {
        setStep('document');
      } else if (ticket) {
        finish(ticket);
      }
    },
    [ticket, finish],
  );

  const handleDocumentSuccess = useCallback(
    (blobs: DocumentBlobs) => {
      setDocumentBlobs(blobs);
      if (ticket) finish(ticket);
    },
    [ticket, finish],
  );

  let screen: ReactNode;
  switch (step) {
    case 'welcome':
      screen = <WelcomeScreen onStart={() => setStep('qr')} />;
      break;

    case 'qr':
      screen = <QrScanScreen onConfirmed={handleQrConfirmed} onCancel={reset} />;
      break;

    case 'face':
      screen = (
        <Suspense fallback={<ScreenLoading />}>
          <FaceVerifyScreen transactionId={transactionId as string} onSuccess={handleFaceSuccess} onCancel={reset} />
        </Suspense>
      );
      break;

    case 'document':
      screen = (
        <Suspense fallback={<ScreenLoading />}>
          <DocumentVerifyScreen transactionId={transactionId as string} onSuccess={handleDocumentSuccess} onCancel={reset} />
        </Suspense>
      );
      break;

    case 'success':
      screen = <SuccessScreen faceBlob={faceBlob} passengerName={ticket?.name ?? ''} passCode={passCode} onRestart={reset} />;
      break;
  }

  return (
    // Keyed on `step` so leaving the crashed screen (via the fallback's own reset button, which
    // calls `reset()` and changes `step`) remounts a fresh boundary instead of staying tripped.
    <ErrorBoundary key={step} fallback={<ErrorDialog message={t('common.unexpectedError')} onRescan={reset} />}>
      {screen}
    </ErrorBoundary>
  );
}
