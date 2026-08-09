import { Component, type ErrorInfo, type ReactNode } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { StackMark } from "../components/shared/StackMark";
import { Button } from "../components/ui/Button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

/**
 * The last thing between an unexpected error and a blank white screen.
 *
 * There is no server to notice a failure here and nobody to report it to, so
 * the one useful thing this can do is say what happened in words the user can
 * repeat, and leave their stored training untouched while they do.
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("STACK stopped unexpectedly.", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div className="recovery">
        <div className="recovery__panel">
          <div className="recovery__brand">
            <StackMark size={22} />
            <p className="wordmark wordmark--small">STACK</p>
          </div>

          <span className="recovery__icon" aria-hidden="true">
            <TriangleAlert size={26} strokeWidth={1.8} />
          </span>

          <h1 className="recovery__title">STACK stopped unexpectedly</h1>
          <p className="recovery__body">
            Nothing has been erased. Reloading usually gets you back to where
            you were, because everything is read from this browser at the
            start.
          </p>
          <p className="recovery__detail">{error.message}</p>

          <div className="recovery__actions">
            <Button
              icon={<RotateCcw size={18} strokeWidth={2} />}
              onClick={() => window.location.reload()}
            >
              Reload STACK
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
