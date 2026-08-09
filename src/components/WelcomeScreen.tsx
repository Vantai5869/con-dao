import { useId, useState } from 'react';
import { LANGUAGES, useTranslation } from '../lib/i18n';
import { LanguageSelector } from './LanguageSelector';
import ferryBoat from '../assets/ferry-boat.png';
import bannerPlane from '../assets/banner-plane.png';
import bannerSuitcase from '../assets/banner-suitcase.png';
import stepQr from '../assets/step-qr.png';
import stepFace from '../assets/step-face.png';
import stepId from '../assets/step-id.png';
import bannerArrow from '../assets/banner-arrow.png';
import bannerArrowhead from '../assets/banner-arrowhead.png';
import bannerArcFull from '../assets/banner-arc-full.png';

interface WelcomeScreenProps {
  onStart: () => void;
}

/** First screen: step overview, language picker, entry point into the check-in wizard. */
export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const { t, lang } = useTranslation();
  const [showLanguage, setShowLanguage] = useState(false);
  const currentFlag = LANGUAGES.find((option) => option.code === lang)?.flag ?? '🏳️';
  const bannerArcId = useId();

  return (
    <div className="welcome-screen">
      <button type="button" className="welcome-screen__lang-btn" onClick={() => setShowLanguage(true)}>
        <span>{currentFlag}</span>
        <svg className="welcome-screen__lang-chevron" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 7.5L10 12.5L15 7.5" stroke="#101828" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="welcome-screen__hero">
        <p className="welcome-screen__banner-text-sr">{t('welcome.title')}</p>
        <div className="welcome-screen__banner-title-row">
          <span className="welcome-screen__banner-flanking welcome-screen__banner-flanking--left" aria-hidden="true">
            <img className="welcome-screen__banner-flanking-small" src={bannerArrow} alt="" />
            <img className="welcome-screen__banner-flanking-big" src={bannerArrowhead} alt="" />
          </span>
          <svg className="welcome-screen__banner-text-svg" viewBox="0 0 306 46" aria-hidden="true">
            <path id={bannerArcId} d="M4,40 Q153,6 302,40" fill="none" />
            <text className="welcome-screen__banner-text-svg-label" textAnchor="middle">
              <textPath href={`#${bannerArcId}`} startOffset="50%">
                {t('welcome.title')}
              </textPath>
            </text>
          </svg>
          <span className="welcome-screen__banner-flanking welcome-screen__banner-flanking--right" aria-hidden="true">
            <img className="welcome-screen__banner-flanking-small" src={bannerArrow} alt="" />
            <img className="welcome-screen__banner-flanking-big" src={bannerArrowhead} alt="" />
          </span>
        </div>
        <div className="welcome-screen__banner-deco" aria-hidden="true">
          <img className="welcome-screen__banner-arc-img" src={bannerArcFull} alt="" />
          <img className="welcome-screen__banner-bubble welcome-screen__banner-bubble--left" src={bannerPlane} alt="" />
          <img className="welcome-screen__banner-bubble welcome-screen__banner-bubble--right" src={bannerSuitcase} alt="" />
        </div>
        <h1 className="welcome-screen__place">CÔN ĐẢO</h1>
        <svg className="welcome-screen__title-divider" viewBox="0 0 300 16" aria-hidden="true">
          <line x1="0" y1="8" x2="112" y2="8" />
          <line x1="188" y1="8" x2="300" y2="8" />
          <path d="M120,7 Q131,15 142,7 Q150,1 158,7 Q169,15 180,7" />
        </svg>
        <p className="welcome-screen__subtitle">{t('welcome.subtitle')}</p>
        <p className="welcome-screen__description">{t('welcome.description')}</p>
      </div>

      <div className="welcome-screen__steps">
        <div className="welcome-screen__step">
          <span className="welcome-screen__step-icon">
            <img src={stepQr} alt="" />
          </span>
          <span className="welcome-screen__step-text">{t('welcome.step1')}</span>
        </div>
        <div className="welcome-screen__step">
          <span className="welcome-screen__step-icon">
            <img src={stepFace} alt="" />
          </span>
          <span className="welcome-screen__step-text">{t('welcome.step2')}</span>
        </div>
        <div className="welcome-screen__step">
          <span className="welcome-screen__step-icon">
            <img src={stepId} alt="" />
          </span>
          <span className="welcome-screen__step-text">{t('welcome.step3')}</span>
        </div>
      </div>

      <div className="welcome-screen__stepper" aria-hidden="true">
        <span className="welcome-screen__stepper-dot">1</span>
        <span className="welcome-screen__stepper-line" />
        <span className="welcome-screen__stepper-dot">2</span>
        <span className="welcome-screen__stepper-line" />
        <span className="welcome-screen__stepper-dot">3</span>
      </div>

      <div className="welcome-screen__illustration">
        <img src={ferryBoat} alt="" />
      </div>

      <button type="button" className="welcome-screen__start-btn" onClick={onStart}>
        ▶ {t('welcome.start')}
      </button>

      {showLanguage && <LanguageSelector onClose={() => setShowLanguage(false)} />}
    </div>
  );
}
