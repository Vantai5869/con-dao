import { lazy, Suspense, useCallback, useState } from 'react';
import { WelcomeScreen } from './WelcomeScreen';
import { QrScanScreen } from './QrScanScreen';
import { SuccessScreen } from './SuccessScreen';
import type { DocumentBlobs } from './DocumentVerifyScreen';
import { checkFaceExists } from '../lib/faceExistsApi';
import { generatePassCode, isReturnTrip, markTicketUsed, type Ticket } from '../lib/ticket';

// Lazy-loaded: each pulls in a heavy detection library (MediaPipe / OpenCV.js).
// The welcome/QR screens need neither, so they must not be blocked behind
// downloading them (see the earlier blank-dashboard bug this fixed).
const FaceVerifyScreen = lazy(() => import('./FaceVerifyScreen').then((m) => ({ default: m.FaceVerifyScreen })));
const DocumentVerifyScreen = lazy(() =>
  import('./DocumentVerifyScreen').then((m) => ({ default: m.DocumentVerifyScreen })),
);

type Step = 'welcome' | 'qr' | 'face' | 'document' | 'success';

/** Owns the whole check-in wizard's cross-step state and step transitions, including the return-trip skip-document branch. */
export function CheckInFlow() {
  const [step, setStep] = useState<Step>('welcome');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [faceBlob, setFaceBlob] = useState<Blob | null>(null);
  const [, setDocumentBlobs] = useState<DocumentBlobs | null>(null);
  const [passCode, setPassCode] = useState('');

  const reset = useCallback(() => {
    setStep('welcome');
    setTicket(null);
    setFaceBlob(null);
    setDocumentBlobs(null);
    setPassCode('');
  }, []);

  const finish = useCallback((finalTicket: Ticket) => {
    markTicketUsed(finalTicket.code);
    setPassCode(generatePassCode(finalTicket));
    setStep('success');
  }, []);

  const handleQrConfirmed = useCallback((confirmedTicket: Ticket) => {
    setTicket(confirmedTicket);
    setStep('face');
  }, []);

  const handleFaceSuccess = useCallback(
    async (blob: Blob) => {
      setFaceBlob(blob);
      if (ticket && isReturnTrip(ticket)) {
        // TODO: real face-match API. Mocked to always exist for now.
        const exists = await checkFaceExists(ticket.idNumber);
        if (exists) {
          finish(ticket);
          return;
        }
      }
      setStep('document');
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

  switch (step) {
    case 'welcome':
      return <WelcomeScreen onStart={() => setStep('qr')} />;

    case 'qr':
      return <QrScanScreen onConfirmed={handleQrConfirmed} onCancel={reset} />;

    case 'face':
      return (
        <Suspense fallback={<div className="screen-loading">Đang tải...</div>}>
          <FaceVerifyScreen onSuccess={handleFaceSuccess} onCancel={reset} />
        </Suspense>
      );

    case 'document':
      return (
        <Suspense fallback={<div className="screen-loading">Đang tải...</div>}>
          <DocumentVerifyScreen onSuccess={handleDocumentSuccess} onCancel={reset} />
        </Suspense>
      );

    case 'success':
      return (
        <SuccessScreen faceBlob={faceBlob} passengerName={ticket?.name ?? ''} passCode={passCode} onRestart={reset} />
      );
  }
}
