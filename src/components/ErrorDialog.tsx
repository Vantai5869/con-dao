import { useTranslation } from '../lib/i18n';

interface ErrorDialogProps {
  message: string;
  /** Overrides the primary button's label — e.g. "Retry" instead of "Rescan" for a connection failure, where scanning again isn't actually what's being retried. Defaults to the rescan label. */
  rescanLabel?: string;
  onRescan: () => void;
  onHome?: () => void;
}

/** Centered modal shown when a scan/capture step fails validation (invalid QR, face mismatch, unreadable document, ...). */
export function ErrorDialog({ message, rescanLabel, onRescan, onHome }: ErrorDialogProps) {
  const { t } = useTranslation();

  return (
    <div className="error-dialog-backdrop">
      <div className="error-dialog">
        <div className="error-dialog__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </div>

        <p className="error-dialog__message">{message}</p>

        <div className="error-dialog__actions">
          {onHome && (
            <button type="button" className="secondary-btn error-dialog__btn" onClick={onHome}>
              {t('qr.home')}
            </button>
          )}
          <button type="button" className="primary-btn error-dialog__btn" onClick={onRescan}>
            {rescanLabel ?? t('qr.rescan')}
          </button>
        </div>
      </div>
    </div>
  );
}
