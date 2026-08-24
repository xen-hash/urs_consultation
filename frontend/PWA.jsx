import { useCallback, useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Download, RefreshCw, WifiOff, X, Share } from "lucide-react";

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
export function InstallAppButton({ className = "" }) {
  const { canInstall, needsManualSteps, install } = useInstallPrompt();
  const [showSteps, setShowSteps] = useState(false);

  if (!canInstall && !needsManualSteps) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (canInstall ? install() : setShowSteps(true))}
        className={`flex items-center gap-1.5 text-white/70 hover:text-white text-sm
                    bg-white/10 hover:bg-white/20 border border-white/20
                    px-3 py-1.5 rounded-xl transition-all ${className}`}
      >
        <Download size={13} /> Install App
      </button>

      {showSteps && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                     bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowSteps(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-display font-bold text-lg text-[#003366]">
                Add to Home Screen
              </h3>
              <button onClick={() => setShowSteps(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <ol className="text-sm text-gray-600 space-y-3 leading-relaxed">
              <li className="flex gap-2">
                <span className="font-semibold text-[#003366]">1.</span>
                <span>
                  Tap the <Share size={13} className="inline -mt-0.5" /> Share button in Safari's
                  toolbar.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[#003366]">2.</span>
                <span>Scroll down and choose <strong>Add to Home Screen</strong>.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[#003366]">3.</span>
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
 * Global app-status layer: the offline bar and the update prompt.
 * Mounted once, above the router.
 */
export default function PWAStatus() {
  const online = useOnlineStatus();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(url, registration) {
      // Consultation status changes through the day; check hourly for a new build.
      if (registration) setInterval(() => registration.update(), 60 * 60 * 1000);
    }
  });

  if (online && !needRefresh) return null;

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
          className="pointer-events-auto flex items-center gap-2
                     bg-amber-500 text-white text-sm font-semibold
                     px-4 py-2.5 rounded-2xl shadow-2xl animate-slide-up"
        >
          <WifiOff size={15} />
          You're offline — showing the last loaded data
        </div>
      )}

      {needRefresh && (
        <div
          role="status"
          className="pointer-events-auto flex items-center gap-3
                     bg-[#003366] text-white text-sm px-4 py-2.5 rounded-2xl shadow-2xl animate-slide-up"
        >
          <RefreshCw size={15} className="text-[#ffa000]" />
          <span className="font-semibold">A new version is available</span>
          <button
            onClick={() => updateServiceWorker(true)}
            className="bg-[#ff6f00] hover:bg-[#e65c00] font-semibold px-3 py-1 rounded-xl transition-colors"
          >
            Reload
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="text-white/50 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
