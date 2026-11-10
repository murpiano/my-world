import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import styles from './App.module.css';

/** Catches a render-time crash below it so one broken piece doesn't blank the whole page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { broke: boolean }> {
  override state = { broke: false };

  static getDerivedStateFromError() {
    return { broke: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  override render() {
    if (!this.state.broke) return this.props.children;
    return (
      <div className={styles.boot} role="alert">
        <p>Something broke.</p>
        <button type="button" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  }
}
