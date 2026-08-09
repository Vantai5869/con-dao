import { useEffect } from 'react';

/**
 * Mobile browsers disagree on what 100svh/100dvh actually resolves to — Chrome
 * on iOS in particular has been seen leaving a gap below the real content
 * height even though Safari on the same device renders it correctly. Measuring
 * window.innerHeight directly and exposing it as a CSS custom property sidesteps
 * that inconsistency entirely.
 */
export function useViewportHeight(): void {
  useEffect(() => {
    const setHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };

    setHeight();
    window.addEventListener('resize', setHeight);
    window.addEventListener('orientationchange', setHeight);

    return () => {
      window.removeEventListener('resize', setHeight);
      window.removeEventListener('orientationchange', setHeight);
    };
  }, []);
}
