import { createPortal } from "react-dom";
import { useScrollLock } from "./index.jsx";

/**
 * The full-screen moment a sign-in resolves on — either way.
 *
 * Success took over the screen with a drawn mark on the brand gradient while
 * failure arrived as a small card sliding up from the bottom, so the two
 * outcomes of the same tap looked like they came from different products. This
 * is the one surface both are drawn on; what differs between them is the mark,
 * the words, and whether it dismisses itself.
 *
 * It is a portal rather than an overlay in place because the screens that use
 * it navigate immediately afterwards — anything rendered inside the route is
 * unmounted by the very transition it is confirming.
 */
export default function Splash({ open, dialog = false, label, children }) {
  useScrollLock(open);
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-6 animate-fade
                 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900"
      {...(dialog
        // A failure waits to be dismissed, so it is a dialog and takes focus.
        // A confirmation passes on its own and must not interrupt what the
        // screen reader is already saying.
        ? { role: "alertdialog", "aria-modal": "true", "aria-label": label }
        : { role: "status", "aria-live": "polite" })}
    >
      {/* The dot texture the entry screens use, so the moment reads as part of
          the app rather than a blank interstitial. */}
      <div aria-hidden="true" className="absolute inset-0 dot-pattern opacity-70" />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgb(var(--on-backdrop) / 0.10), transparent 55%)",
        }}
      />

      <div className="relative w-full max-w-sm text-center animate-rise">{children}</div>
    </div>,
    document.body
  );
}

/**
 * The disc the mark sits in. On the deep gradient the light-canvas tones
 * invert: a white glyph on a translucent disc rather than a dark one on a pale
 * disc.
 */
export function SplashMark({ tone = "success", children }) {
  const tones = {
    success: "text-white bg-success/25 ring-1 ring-success/40",
    brand:   "text-white bg-on-backdrop/15 ring-1 ring-on-backdrop/25",
    neutral: "text-white bg-on-backdrop/10 ring-1 ring-on-backdrop/20",
    danger:  "text-white bg-danger/30 ring-1 ring-danger/50",
  };
  return (
    <span className={`w-20 h-20 rounded-full grid place-items-center mx-auto mb-5 ${tones[tone] || tones.success}`}>
      {children}
    </span>
  );
}
