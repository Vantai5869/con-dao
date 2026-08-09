import { useObjectUrl } from '../hooks/useObjectUrl';
import { useTranslation } from '../lib/i18n';

interface SuccessScreenProps {
  faceBlob: Blob | null;
  passengerName: string;
  passCode: string;
  onRestart: () => void;
}

/** Final screen after QR + face (+ document, unless skipped) all succeed. */
export function SuccessScreen({ faceBlob, passengerName, passCode, onRestart }: SuccessScreenProps) {
  const { t } = useTranslation();
  const faceUrl = useObjectUrl(faceBlob);

  return (
    <div className="success-screen">
      <div className="success-screen__mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 className="success-screen__title">{t('success.title')}</h1>
      <p className="success-screen__subtitle">{t('success.subtitle')}</p>

      <div className="success-screen__card">
        {faceUrl && <img src={faceUrl} alt="" className="success-screen__avatar" />}
        <div className="success-screen__info">
          <div className="success-screen__name">{passengerName}</div>
          <div className="success-screen__code">
            {t('success.ticketLabel')}: {passCode}
          </div>
        </div>
      </div>

      <button type="button" className="success-screen__restart-btn" onClick={onRestart}>
        ↻ {t('success.restart')}
      </button>
    </div>
  );
}
