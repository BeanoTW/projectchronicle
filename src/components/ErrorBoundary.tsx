/**
 * Crash containment.
 *
 * Chronicle previously had no error boundary anywhere: a single malformed
 * record, or any render-time throw, unmounted the whole React tree and left a
 * blank white page with no way back.
 *
 * Two levels are used:
 *  - `AppErrorBoundary` wraps the router, so the app can always offer a
 *    recovery path.
 *  - `ScreenErrorBoundary` wraps individual screens, so one broken record does
 *    not take down navigation.
 *
 * The message shown to the user never contains the raw error, a stack trace,
 * record contents, tokens or database details. The technical detail goes to
 * the console in development only.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown above the recovery actions. Keep it plain and non-alarming. */
  title?: string;
  /** When true, offers "Back to Notebook" instead of a full reload. */
  screenLevel?: boolean;
}

interface State {
  failed: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      // Development only. Never logged in production builds: a thrown error
      // can carry record wording in its message.
      console.error('[Chronicle] render error', error, info.componentStack);
    }
  }

  private reset = () => {
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;

    const { title, screenLevel } = this.props;

    return (
      <div className="proto-root" style={{ padding: '32px 20px', maxWidth: 560, margin: '0 auto' }}>
        <h1 className="proto-h1" style={{ fontSize: 22 }}>
          {title ?? 'This part of Chronicle could not be displayed'}
        </h1>
        <p className="proto-help" style={{ marginTop: 10 }}>
          Something went wrong while showing this screen. Your records have not been changed or
          deleted — this is a display problem, not a data problem.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
          <button type="button" className="proto-btn" data-variant="primary" onClick={this.reset}>
            Try again
          </button>
          {screenLevel ? (
            <a className="proto-btn" href="/timeline">
              Back to Notebook
            </a>
          ) : (
            <button type="button" className="proto-btn" onClick={() => window.location.reload()}>
              Reload Chronicle
            </button>
          )}
        </div>
      </div>
    );
  }
}

export const AppErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary title="Chronicle could not continue">{children}</ErrorBoundary>
);

export const ScreenErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary screenLevel>{children}</ErrorBoundary>
);

export default ErrorBoundary;
