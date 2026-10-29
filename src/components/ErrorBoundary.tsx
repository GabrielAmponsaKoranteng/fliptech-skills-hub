// Catches rendering errors so one broken component shows a recovery panel instead of a blank page.
// `variant="page"` is used around each route's content (the navigation stays usable); `variant="app"`
// wraps everything as a last resort.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  variant?: 'page' | 'app';
}

interface State { error: Error | null }

/** A lazily loaded page failed to download — usually a new version was deployed while the tab was open. */
export const isChunkLoadError = (e: Error) =>
  /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically imported/i.test(e.message);

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The place to send crashes to an error tracker (e.g. Sentry) once there is one.
    console.error('Fliptech page crashed:', error, info.componentStack);
  }

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const stale = isChunkLoadError(error);
    const title = stale ? 'A new version of Fliptech is available' : 'Something went wrong on this page';
    const text = stale
      ? 'Reload to get the latest version. Anything you’ve saved is safe.'
      : 'Sorry about that. Try again, or reload the page. Anything you’ve already saved is safe.';
    const body = (
      <>
        <div className="empty-ico" style={{ background: 'var(--warn-50)', color: 'var(--warn)' }}><AlertTriangle size={28} /></div>
        <h3>{title}</h3>
        <p>{text}</p>
        {import.meta.env.DEV && !stale && <pre className="error-detail">{error.message}</pre>}
        <div className="row mt-4" style={{ justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          {!stale && <button className="btn btn-secondary" onClick={this.retry}>Try again</button>}
          <button className="btn btn-primary" onClick={() => location.reload()}><RefreshCw size={16} /> Reload page</button>
          {/* A plain link: the router itself may be what broke. */}
          <a className="btn btn-ghost" href="/">Go to the homepage</a>
        </div>
      </>
    );

    return this.props.variant === 'app'
      ? <div className="boot" role="alert"><div className="boot-inner empty">{body}</div></div>
      : <div className="card" role="alert"><div className="empty">{body}</div></div>;
  }
}
