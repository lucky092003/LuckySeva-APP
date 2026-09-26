import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught render error', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <h1 className="text-lg font-bold text-gray-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-500">
          The app failed to render. Reload the page to try again.
        </p>
        <pre className="mt-4 max-w-full overflow-x-auto rounded-xl bg-gray-50 p-3 text-left text-xs text-red-700">
          {error.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Reload
        </button>
      </div>
    );
  }
}
