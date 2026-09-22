import { CloudOff, RefreshCw } from "lucide-react";
import { Button } from "../SharedUI.jsx";

/**
 * One explanation for a screen full of empty panels.
 *
 * When the API cannot be reached, every panel fails at the same moment for the
 * same reason — and the dashboard used to render that as data: "—" above
 * "0 with an active card", an empty faculty list, "0 still pending". Nothing
 * said the server had not answered, so a backend that was asleep looked
 * identical to a school with nobody in it.
 *
 * So the connection is reported once, at the top, in the place a reader looks
 * first, and the panels below stop inventing zeroes to fill themselves with.
 */
export default function ServerDown({ onRetry, retrying = false, className = "" }) {
  return (
    <div
      role="alert"
      className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-danger/30
                  bg-danger-50 px-4 py-3.5 ${className}`}
    >
      <span className="icon-tile w-9 h-9 shrink-0 badge-danger">
        <CloudOff size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg">Can't reach the server</p>
        <p className="text-xs text-muted-fg mt-0.5 leading-relaxed">
          Nothing on this page is live right now. The backend may be starting up —
          it sleeps when it has been idle, and the first visit can take up to a
          minute to wake it. Everything below is blank for that reason, not because
          it is empty.
        </p>
      </div>
      <Button size="sm" icon={RefreshCw} loading={retrying} onClick={onRetry}
        className="shrink-0 self-start sm:self-auto">
        Try again
      </Button>
    </div>
  );
}
