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

  const tones = {
    success: "text-success bg-success-50",
    brand:   "text-brand bg-brand-50",
    neutral: "text-muted-fg bg-surface-2",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-canvas animate-fade"
      role="status"
      aria-live="polite"
    >
      <div className="text-center animate-rise">
        <span
          className={`w-20 h-20 rounded-full grid place-items-center mx-auto mb-5 ${tones[tone] || tones.success}`}
        >
          <ConfirmMark size={34} />
        </span>
        <p className="text-title font-bold text-fg">{title}</p>
        {subtitle && <p className="text-muted-fg mt-1.5">{subtitle}</p>}
      </div>
    </div>,
    document.body
  );
}
