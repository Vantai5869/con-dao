import { useTranslation } from '../lib/i18n';
import { routeLabel, type Ticket } from '../lib/ticket';

interface TicketSummaryCardProps {
  ticket: Ticket;
  onNext: () => void;
  onRescan: () => void;
}

/** Replaces the camera view after a ticket QR is successfully decoded, showing the parsed info for confirmation. */
export function TicketSummaryCard({ ticket, onNext, onRescan }: TicketSummaryCardProps) {
  const { t } = useTranslation();

  return (
    <div className="ticket-summary-page">
      <div className="ticket-summary">
        <div className="ticket-summary__header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="9" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>{t('qr.summaryTitle')}</span>
        </div>

        <dl className="ticket-summary__rows">
          <div className="ticket-summary__row">
            <dt>{t('qr.passenger')}</dt>
            <dd>{ticket.name}</dd>
          </div>
          <div className="ticket-summary__row">
            <dt>{t('qr.idNumber')}</dt>
            <dd>{ticket.idNumber}</dd>
          </div>
          <div className="ticket-summary__row">
            <dt>{t('qr.seat')}</dt>
            <dd>{ticket.seat}</dd>
          </div>
          <div className="ticket-summary__row">
            <dt>{t('qr.departureTime')}</dt>
            <dd>{ticket.datetime}</dd>
          </div>
          <div className="ticket-summary__row">
            <dt>{t('qr.route')}</dt>
            <dd>{routeLabel(ticket.routeCode)}</dd>
          </div>
        </dl>
      </div>

      <button type="button" className="ticket-summary__rescan" onClick={onRescan}>
        ↻ {t('qr.rescanHint')}
      </button>

      <button type="button" className="primary-btn ticket-summary__next" onClick={onNext}>
        {t('qr.nextStep')}
      </button>
    </div>
  );
}
