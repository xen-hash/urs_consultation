import { useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { AlertMark } from "./index.jsx";
import Splash, { SplashMark } from "./Splash.jsx";

/**
 * A held explanation for a failed sign-in.
 *
 * This is the other half of ConfirmSplash, and it is deliberately the same
 * screen: same gradient, same disc, same drawn mark — crossed instead of
 * ticked. A wrong PIN used to slide up as a small sheet while a correct one
 * took over the display, which made the failure feel like a lesser event from
 * a different app. Both outcomes of the same tap now land in the same place.
 *
 * Unlike the confirmation it does not pass on its own. A wrong PIN, an
 * unrecognised card and a rate-limit lockout each need a different next step,
 * and a message that fades while the camera is still running is one nobody
 * reads.
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
  qr_foreign: {
    title: "That isn't a Faculty ID card",
    body: "The code scanned fine, but it isn't a card this system issued — a student QR or a code from another app will do this. Use the Faculty ID card the admin office gave you.",
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

export default function ErrorSplash({ open, kind = "credentials", detail, onClose, onRetry }) {
  const guide = GUIDANCE[kind] || GUIDANCE.credentials;
  const firstAction = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    // Focus lands on the action, not the backdrop, so a keyboard user is not
    // left tabbing behind a screen that covers everything.
    firstAction.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <Splash open={open} dialog label={guide.title}>
      <SplashMark tone="danger">
        <AlertMark size={34} />
      </SplashMark>

      <p className="text-title font-bold text-on-backdrop">{guide.title}</p>
      <p className="text-on-backdrop/70 mt-2 leading-relaxed">{guide.body}</p>

      {/* The server's own words, kept for the cases the categories miss — a
          lockout's remaining seconds, for instance. */}
      {detail && <p className="text-sm text-on-backdrop/50 mt-3">{detail}</p>}

      <div className="mt-7 flex flex-col gap-2.5">
        {onRetry && (
          <button ref={firstAction} onClick={onRetry} className="btn btn-secondary w-full">
            <RefreshCw size={16} aria-hidden="true" /> Try again
          </button>
        )}
        <button
          ref={onRetry ? undefined : firstAction}
          onClick={onClose}
          className="btn w-full text-on-backdrop/80 border border-on-backdrop/25
                     hover:bg-on-backdrop/10 hover:text-on-backdrop transition-colors"
        >
          Close
        </button>
      </div>
    </Splash>
  );
}
