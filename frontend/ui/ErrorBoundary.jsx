import { Component } from "react";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";

/**
 * Catches render errors so one bad component doesn't blank the entire app.
 *
 * React unmounts the whole tree when a render throws, which is how a single
 * mistyped prop turned into a white screen with nothing on it — no message, no
 * way forward, and nothing for the person using it to report beyond "it went
 * white". This shows what happened and offers the two things that actually
 * recover: reload, or sign out and start clean.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the stack in the console for anyone with devtools open.
    console.error("Unhandled render error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-dvh bg-canvas flex items-center justify-center p-5">
        <div className="card max-w-md w-full text-center">
          <span className="icon-tile icon-tile-muted mx-auto mb-3 w-12 h-12">
            <AlertTriangle size={22} aria-hidden="true" />
          </span>
          <h1 className="font-semibold text-fg text-lg">Something went wrong</h1>
          <p className="text-sm text-muted-fg mt-1.5">
            This screen failed to load. Reloading usually clears it. If it keeps
            happening, sign out and back in.
          </p>
          <p className="text-xs text-subtle-fg mt-3 font-mono break-words">
            {String(this.state.error?.message || this.state.error).slice(0, 200)}
          </p>
          <div className="flex gap-2 mt-5">
            <button onClick={() => window.location.reload()} className="btn btn-primary flex-1">
              <RefreshCw size={16} aria-hidden="true" /> Reload
            </button>
            <button
              onClick={() => { sessionStorage.clear(); window.location.replace("/"); }}
              className="btn btn-secondary flex-1"
            >
              <LogOut size={16} aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }
}
