import { useTranslation } from '../lib/i18n';

/** Suspense fallback shown while a lazy-loaded step screen's JS chunk is downloading. */
export function ScreenLoading() {
  const { t } = useTranslation();

  return (
    <div className="screen-loading">
      <span className="screen-loading__spinner" />
      <span className="screen-loading__text">{t('common.loading')}</span>
    </div>
  );
}
