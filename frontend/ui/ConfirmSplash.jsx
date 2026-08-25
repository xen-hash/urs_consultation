import { useEffect } from "react";
import { ConfirmMark } from "./index.jsx";
import Splash, { SplashMark } from "./Splash.jsx";

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
  useEffect(() => {
    if (!open || !onDone) return undefined;
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [open, onDone, duration]);

  return (
    <Splash open={open}>
      <SplashMark tone={tone}>
        <ConfirmMark size={34} />
      </SplashMark>
      <p className="text-title font-bold text-on-backdrop">{title}</p>
      {subtitle && <p className="text-on-backdrop/70 mt-1.5">{subtitle}</p>}
    </Splash>
  );
}
