import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Keep tool inputs and local data out of logs and telemetry.
  }
  render() {
    if (this.state.failed) return (
      <div className="card p-6 space-y-3" role="alert">
        <h1 className="text-lg font-semibold">This tool could not load</h1>
        <p className="text-sm text-muted">Try another tool, or reload this page to retry.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    );
    return this.props.children;
  }
}
