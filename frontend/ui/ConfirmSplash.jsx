import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ConfirmMark, useScrollLock } from "./index.jsx";

/**
 * A held confirmation for actions that change where you are.
 *
 * A toast cannot do this job. Sign-in and sign-out navigate immediately after,
 * which unmounts the toast host and takes the message with it — the welcome
 * message was on screen for a few hundred milliseconds and then destroyed by
 * the very navigation it was confirming. This owns the screen for a beat, so
 * the confirmation is unmissable and the transition has somewhere to happen.
 *
 * Deliberately brief. It sits between one screen and the next; anything longer
 * than about a second stops reading as feedback and starts reading as a wait.
 */
export default function ConfirmSplash({
  open, title, subtitle, tone = "success", onDone, duration = 1100,
}) {
  useScrollLock(open);

  useEffect(() => {
    if (!open || !onDone) return undefined;
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [open, onDone, duration]);

  if (!open) return null;

  // On the deep gradient the light-canvas tones invert: the mark is white on a
  // translucent disc rather than a dark glyph on a pale one.
  const tones = {
    success: "text-white bg-success/25 ring-1 ring-success/40",
    brand:   "text-white bg-on-backdrop/15 ring-1 ring-on-backdrop/25",
    neutral: "text-white bg-on-backdrop/10 ring-1 ring-on-backdrop/20",
    danger:  "text-white bg-danger/30 ring-1 ring-danger/50",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-6 animate-fade
                 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900"
      role="status"
      aria-live="polite"
    >
      {/* The same dot texture the entry screens use, so the moment reads as
          part of the app rather than a blank interstitial. */}
      <div aria-hidden="true" className="absolute inset-0 dot-pattern opacity-70" />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgb(var(--on-backdrop) / 0.10), transparent 55%)",
        }}
      />

      <div className="relative text-center animate-rise">
        <span
          className={`w-20 h-20 rounded-full grid place-items-center mx-auto mb-5 ${tones[tone] || tones.success}`}
        >
          <ConfirmMark size={34} />
        </span>
        <p className="text-title font-bold text-on-backdrop">{title}</p>
        {subtitle && <p className="text-on-backdrop/70 mt-1.5">{subtitle}</p>}
      </div>
    </div>,
    document.body
  );
}
