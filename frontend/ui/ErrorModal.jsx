import { AlertTriangle, RefreshCw } from "lucide-react";
import { Modal, Button } from "./index.jsx";

/**
 * A held explanation for a failed sign-in.
 *
 * A toast is the wrong weight for these. A wrong PIN, an unrecognised card and
 * a rate-limit lockout each need a different next step, and a message that
 * fades after four seconds while the camera is still running is one nobody
 * reads. This waits to be dismissed and says what to do.
 *
 * The guidance is deliberately vague about *which* half was wrong on a
 * credential failure — telling someone the username was right and the password
 * was not is a free hint to whoever is guessing.
 */

const GUIDANCE = {
  credentials: {
    title: "Those details didn't match",
    body: "Check the spelling and try again. If you've forgotten them, the admin office can reset your access.",
  },
  qr_unknown: {
    title: "Card not recognised",
    body: "This card isn't active. Cards are replaced when reissued, so an older printout stops working — ask the admin office for a current one.",
  },
  qr_unreadable: {
    title: "Couldn't read that code",
    body: "Hold the card flat inside the frame, in even light, and keep it steady for a moment.",
  },
  locked: {
    title: "Too many attempts",
    body: "Sign-in is paused for a few minutes to protect the account. Wait, then try once more.",
  },
  deactivated: {
    title: "This account is inactive",
    body: "It has been deactivated, so it can't be signed into. The admin office can reactivate it.",
  },
  offline: {
    title: "Couldn't reach the server",
    body: "Check the connection and try again. Nothing was changed.",
  },
};

/** Map an API failure to the guidance that actually helps. */
export function classifyAuthError(error) {
  const status = error?.response?.status;
  const message = (error?.response?.data?.error || "").toLowerCase();

  if (!error?.response) return "offline";
  if (status === 429) return "locked";
  if (message.includes("deactivated")) return "deactivated";
  if (message.includes("qr") || message.includes("card")) return "qr_unknown";
  return "credentials";
}

export default function ErrorModal({ open, kind = "credentials", detail, onClose, onRetry }) {
  const guide = GUIDANCE[kind] || GUIDANCE.credentials;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={guide.title}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          {onRetry && (
            <Button variant="primary" icon={RefreshCw} onClick={onRetry}>Try again</Button>
          )}
        </>
      }
    >
      <div className="flex gap-3">
        <span className="icon-tile w-11 h-11 shrink-0 bg-danger-50 text-danger">
          <AlertTriangle size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-muted-fg">{guide.body}</p>
          {/* The server's own words, kept for the cases the categories miss —
              a lockout's remaining seconds, for instance. */}
          {detail && <p className="text-xs text-subtle-fg mt-2">{detail}</p>}
        </div>
      </div>
    </Modal>
  );
}
