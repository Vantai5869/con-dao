import { LANGUAGES, useTranslation } from '../lib/i18n';

interface LanguageSelectorProps {
  onClose: () => void;
}

/** Modal listing all supported languages, opened from the flag button on the welcome screen. */
export function LanguageSelector({ onClose }: LanguageSelectorProps) {
  const { lang, setLang, t } = useTranslation();

  return (
    <div className="language-selector-backdrop" onClick={onClose}>
      <div className="language-selector" onClick={(e) => e.stopPropagation()}>
        <h3 className="language-selector__title">{t('language.title')}</h3>

        <ul className="language-selector__list">
          {LANGUAGES.map((option) => (
            <li key={option.code}>
              <button
                type="button"
                className={
                  option.code === lang
                    ? 'language-selector__option language-selector__option--active'
                    : 'language-selector__option'
                }
                onClick={() => setLang(option.code)}
              >
                <span className="language-selector__flag">{option.flag}</span>
                <span>{option.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <button type="button" className="primary-btn" onClick={onClose}>
          {t('language.done')}
        </button>
      </div>
    </div>
  );
}
