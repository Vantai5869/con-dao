import { useTranslation } from '../lib/i18n';

interface ResumeStepDialogProps {
  onRedo: () => void;
  onContinue: () => void;
}

/** Shown when a scanned ticket's transaction already has a completed step on file (e.g. the user got interrupted last time), letting them redo it or pick up where they left off. */
export function ResumeStepDialog({ onRedo, onContinue }: ResumeStepDialogProps) {
  const { t } = useTranslation();

  return (
    <div className="error-dialog-backdrop">
      <div className="error-dialog">
        <h3 className="language-selector__title">{t('qr.resumeTitle')}</h3>
        <p className="error-dialog__message">{t('qr.resumeMessage')}</p>

        <div className="error-dialog__actions">
          <button type="button" className="secondary-btn error-dialog__btn" onClick={onRedo}>
            {t('qr.resumeRedo')}
          </button>
          <button type="button" className="primary-btn error-dialog__btn" onClick={onContinue}>
            {t('qr.resumeContinue')}
          </button>
        </div>
      </div>
    </div>
  );
}
