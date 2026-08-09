interface StepHeaderProps {
  title: string;
  subtitle: string;
  step: number;
  totalSteps: number;
  onBack?: () => void;
}

/** Shared top bar for the QR/Face/Document wizard steps: back button, title/subtitle, "n/total" badge, progress line. */
export function StepHeader({ title, subtitle, step, totalSteps, onBack }: StepHeaderProps) {
  return (
    <div className="step-header">
      <div className="step-header__row">
        {onBack && (
          <button type="button" className="step-header__back" onClick={onBack} aria-label="Back">
            ‹
          </button>
        )}
        <div className="step-header__text">
          <div className="step-header__title">{title}</div>
          <div className="step-header__subtitle">{subtitle}</div>
        </div>
        <div className="step-header__badge">
          {step}/{totalSteps}
        </div>
      </div>
      <div className="step-header__progress">
        <div className="step-header__progress-fill" style={{ width: `${(step / totalSteps) * 100}%` }} />
      </div>
    </div>
  );
}
