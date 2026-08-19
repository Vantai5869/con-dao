import { useEffect } from 'react';

/**
 * Mobile browsers disagree on what 100svh/100dvh actually resolves to — Chrome
 * on iOS in particular has been seen leaving a gap below the real content
 * height even though Safari on the same device renders it correctly. Measuring
 * the visual viewport directly and exposing it as a CSS custom property
 * sidesteps that inconsistency entirely.
 *
 * `window.innerHeight` + `resize`/`orientationchange` alone isn't enough on iOS:
 * WebKit doesn't reliably fire `resize` on `window` when the address bar
 * shows/hides during scroll, so the value can stay stuck at whatever it was
 * measured as while the browser chrome was still settling (more visible as a
 * gap on smaller screens, where that chrome is a bigger fraction of the
 * viewport). `window.visualViewport` tracks the actually-visible area and
 * fires its own `resize` for exactly this case, so it's preferred when available.
 */
export function useViewportHeight(): void {
  useEffect(() => {
    const setHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${height}px`);
    };

    setHeight();
    window.addEventListener('resize', setHeight);
    window.addEventListener('orientationchange', setHeight);
    window.visualViewport?.addEventListener('resize', setHeight);

    return () => {
      window.removeEventListener('resize', setHeight);
      window.removeEventListener('orientationchange', setHeight);
      window.visualViewport?.removeEventListener('resize', setHeight);
    };
  }, []);
}
