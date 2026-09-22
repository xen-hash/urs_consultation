import { useCallback, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Download, RefreshCw, WifiOff, X, Share } from "lucide-react";

import { SAFETY_POLL_MS, UPDATE_INTERVAL_MS, canReloadNow } from "./lib/appUpdate.js";

/** True while the browser reports no network connection. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}

/** True when the app is running from the home screen rather than a browser tab. */
export function useIsStandalone() {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const read = () => setStandalone(mq.matches || window.navigator.standalone === true);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  return standalone;
}

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports itself as a Mac, but it has a touch screen.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/**
 * Wraps the Chromium install flow. iOS has no beforeinstallprompt event,
 * so there we fall back to showing the Add-to-Home-Screen steps.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const standalone = useIsStandalone();

  useEffect(() => {
    const capture = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const installed = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event is single-use — Chrome fires a fresh one if the user declines.
    setDeferred(null);
    return outcome === "accepted";
  }, [deferred]);

  return {
    canInstall: !standalone && !!deferred,
    needsManualSteps: !standalone && !deferred && isIOS(),
    standalone,
    install
  };
}

/** "Install App" button — renders nothing once the app is already installed. */
export function InstallAppButton({ tone = "light", className = "" }) {
  const { canInstall, needsManualSteps, install } = useInstallPrompt();
  const [showSteps, setShowSteps] = useState(false);

  if (!canInstall && !needsManualSteps) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (canInstall ? install() : setShowSteps(true))}
        // The front page's bar is navy now, so the light pill would be the one
        // bright slab left on it.
        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border
          transition-colors ${tone === "dark"
            ? "text-on-backdrop/80 hover:text-on-backdrop bg-on-backdrop/10 hover:bg-on-backdrop/20 border-on-backdrop/20"
            : "text-muted-fg hover:text-fg bg-surface-2 border-border"} ${className}`}
      >
        <Download size={13} /> Install App
      </button>

      {showSteps && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => setShowSteps(false)}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl animate-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-lg text-brand">
                Add to Home Screen
              </h3>
              <button onClick={() => setShowSteps(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <ol className="text-sm text-gray-600 space-y-3 leading-relaxed">
              <li className="flex gap-2">
                <span className="font-semibold text-brand">1.</span>
                <span>
                  Tap the <Share size={13} className="inline -mt-0.5" /> Share button in Safari's
                  toolbar.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-brand">2.</span>
                <span>Scroll down and choose <strong>Add to Home Screen</strong>.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-brand">3.</span>
                <span>Tap <strong>Add</strong> — the URS seal appears with your other apps.</span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Reloads the page when a new build takes over, and goes looking for one.
 *
 * Returns "waiting" while a reload is held back because the reader is
 * mid-sentence, so the UI can say so and offer to do it anyway.
 */
function useAutoReload() {
  const [waiting, setWaiting] = useState(false);
  const [registration, setRegistration] = useState(null);
  const reloading = useRef(false);
  const poll = useRef(null);

  const reload = useCallback(() => {
    if (reloading.current) return;
    reloading.current = true;
    clearInterval(poll.current);
    poll.current = null;
    window.location.reload();
  }, []);

  // Both of these are stable, which matters: useRegisterSW captures its
  // options once, on first render, so a callback rebuilt each render would
  // leave it holding the first one forever.
  const reloadWhenSafe = useCallback(() => {
    if (canReloadNow()) { reload(); return; }
    // Held back: they are mid-sentence. Re-check shortly — canReloadNow also
    // says yes the moment the app goes into the background.
    setWaiting(true);
    if (!poll.current) {
      poll.current = setInterval(() => { if (canReloadNow()) reload(); }, SAFETY_POLL_MS);
    }
  }, [reload]);

  // onRegisteredSW is a plain callback — it takes no teardown — so the
  // registration is handed to an effect that can be cleaned up properly.
  useRegisterSW({
    onRegisteredSW(url, reg) { if (reg) setRegistration(reg); },
    // Supplying this is what stops the plugin reloading on its own the instant
    // the new worker activates. Its default is a bare window.location.reload()
    // from the "activated" handler, which lands mid-sentence and takes the
    // half-written consultation request with it.
    onNeedReload: reloadWhenSafe,
  });

  useEffect(() => () => clearInterval(poll.current), []);

  // ── Going looking for a new build ───────────────────────────────────────
  useEffect(() => {
    if (!registration) return undefined;

    const check = () => { registration.update().catch(() => {}); };

    // A backgrounded PWA has its timers throttled or frozen, and an installed
    // one can sit for days without the window ever closing. The timer covers a
    // tab left open on a desk; the other two cover a phone in a pocket.
    const timer = setInterval(check, UPDATE_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    // Back on the campus WiFi is the first moment a check can succeed at all.
    window.addEventListener("online", check);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", check);
    };
  }, [registration]);

  return { waiting, reloadNow: reload };
}

/**
 * Global app-status layer: the offline bar and the update notice.
 * Mounted once, above the router.
 */
export default function PWAStatus() {
  const online = useOnlineStatus();
  const { waiting, reloadNow } = useAutoReload();

  if (online && !waiting) return null;

  return (
    // One stack so the offline bar and the update prompt never sit on top of
    // each other; pointer-events pass through the gaps to the page beneath.
    <div
      aria-live="polite"
      className="fixed bottom-4 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none"
    >
      {!online && (
        <div
          role="status"
          className="pointer-events-auto flex items-center gap-2 bg-amber-500 text-fg text-sm font-semibold px-4 py-2.5 rounded-lg shadow-2xl animate-rise"
        >
          <WifiOff size={15} />
          You're offline — showing the last loaded data
        </div>
      )}

      {/* Only ever seen when a reload is being held back because something is
          half-typed. The ordinary case reloads on its own and says nothing —
          there is no decision to put to anybody, and a banner offering a
          button that is about to press itself is just noise. */}
      {waiting && (
        <div
          role="status"
          className="pointer-events-auto flex items-center gap-3 bg-brand text-fg text-sm px-4 py-2.5 rounded-lg shadow-2xl animate-rise"
        >
          <RefreshCw size={15} className="text-accent-fg" />
          <span className="font-semibold">
            An update is ready — it will load when you finish typing
          </span>
          <button
            onClick={reloadNow}
            className="bg-accent hover:bg-accent font-semibold px-3 py-1 rounded-xl transition-colors"
          >
            Reload now
          </button>
        </div>
      )}
    </div>
  );
}
