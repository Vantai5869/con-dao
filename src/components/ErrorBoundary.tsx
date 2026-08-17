import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render/effect errors anywhere below it so the app shows a visible error instead of
 * silently unmounting to a blank screen (React's default with no boundary — and this app's `.app`
 * container has a black background, so "blank" looks exactly like a crash/freeze to the user).
 * Reset by remounting with a new `key` from the caller (e.g. keyed on the current wizard step).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('Unhandled error in check-in flow:', error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
