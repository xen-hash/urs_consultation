import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { currentRole, clearSession, loginPathFor } from "./auth.js";

/**
 * Sign out after a period of inactivity.
 *
 * This runs off a stored timestamp rather than a countdown timer, because a
 * timer is exactly what a phone stops running: iOS suspends background tabs, so
 * a setTimeout armed before the screen locked will not have fired when the
 * screen comes back. Checking elapsed time whenever the page becomes visible
 * again catches the case a timer misses — someone locking their phone mid-
 * consultation and picking it up an hour later.
 *
 * Client-side only, and deliberately so: it clears what is on this device. The
 * token itself is separately bounded by SESSION_TTL_HOURS on the server, which
 * is what actually limits a stolen one.
 */

export const IDLE_MINUTES = 15;
const STORAGE_KEY = "urs.lastActivity";
const CHECK_INTERVAL_MS = 30_000;

// Passive listeners: these fire constantly during scrolling and must never
// block it.
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "focus"];

function stamp() {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch { /* private mode; the visibility check still covers the common case */ }
}

function idleMs() {
  try {
    const last = Number(sessionStorage.getItem(STORAGE_KEY));
    return last ? Date.now() - last : 0;
  } catch {
    return 0;
  }
}

export default function useIdleLogout(minutes = IDLE_MINUTES) {
  const navigate = useNavigate();
  const timeoutMs = minutes * 60_000;
  // Held in a ref so the listeners never need re-binding when it changes.
  const roleRef = useRef(currentRole());
  roleRef.current = currentRole();

  useEffect(() => {
    if (!roleRef.current) return undefined;

    const signOut = () => {
      const path = loginPathFor(roleRef.current);
      clearSession();
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      // The reason travels in the URL so the login screen can say why, rather
      // than dumping someone back at a form with no explanation.
      navigate(`${path}?signedOut=idle`, { replace: true });
    };

    const check = () => {
      if (!roleRef.current) return;
      if (idleMs() >= timeoutMs) signOut();
    };

    stamp();
    const onActivity = () => { if (roleRef.current) stamp(); };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
      else stamp();   // record when we left, so the gap is measured from here
    };

    ACTIVITY_EVENTS.forEach(e =>
      window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", check);
    const interval = setInterval(check, CHECK_INTERVAL_MS);

    check();   // catches a tab restored after the browser was closed

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", check);
      clearInterval(interval);
    };
  }, [timeoutMs, navigate]);
}
