import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, RefreshCw } from "lucide-react";
import { Button, Spinner, Alert } from "./SharedUI.jsx";

// jsQR is imported at module scope. It used to be dynamically imported *inside*
// the requestAnimationFrame loop, which created a promise every frame at 60fps.
// Module-cached, so not a network cost, but a microtask storm that pinned the
// CPU and warmed the phone up noticeably during a scan.

const SCAN_INTERVAL_MS = 100;   // ~10fps is plenty for a QR in frame
const SCAN_EDGE = 480;          // downscale before decoding
const METADATA_TIMEOUT_MS = 10000;

/** Touch devices need an explicit gesture before getUserMedia. */
const isTouch = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(pointer: coarse)").matches;

export default function QRScanner({ onScan, onError }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const scannedRef = useRef(false);

  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const stopCamera = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || scannedRef.current) return;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    // Decode a downscaled copy. A full 1080p getImageData every frame was the
    // other half of the CPU cost, and a QR does not need that resolution.
    const scale = Math.min(1, SCAN_EDGE / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" });

    if (code?.data) {
      scannedRef.current = true;
      stopCamera();
      onScan(code.data.trim());
    }
  }, [onScan, stopCamera]);

  const startCamera = useCallback(async () => {
    setLoading(true);
    setErr(null);
    scannedRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;

      // iOS can leave loadedmetadata pending indefinitely if the camera stalls.
      // Without a ceiling the spinner just spins forever with no way back.
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("timeout")), METADATA_TIMEOUT_MS);
        video.onloadedmetadata = () => { clearTimeout(timer); resolve(); };
        video.onerror = () => { clearTimeout(timer); reject(new Error("video")); };
      });

      if (!streamRef.current) return;   // unmounted while awaiting
      await video.play();
      setActive(true);
      timerRef.current = setInterval(scanFrame, SCAN_INTERVAL_MS);
    } catch (e) {
      if (e.name === "AbortError") return;
      const msg =
        e.name === "NotAllowedError"
          ? "Camera permission denied. Allow camera access and try again."
          : e.name === "NotFoundError"
          ? "No camera found on this device."
          : e.message === "timeout"
          ? "The camera didn't start. Close other apps using it and try again."
          : "Could not start the camera. Try again.";
      setErr(msg);
      onError?.(msg);
      stopCamera();
    } finally {
      setLoading(false);
    }
  }, [scanFrame, stopCamera, onError]);

  useEffect(() => {
    // Autostart only where a gesture isn't required. On iOS — and in an
    // installed PWA especially — getUserMedia without a user gesture is
    // refused, and prompting on page load gets dismissed out of reflex.
    if (!isTouch()) startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-xs aspect-square rounded-lg overflow-hidden
                      bg-brand-900 border border-border">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline           /* without this iOS forces fullscreen playback */
          autoPlay
          style={{ display: active ? "block" : "none" }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {!active && !loading && (
          <div className="absolute inset-0 grid place-items-center gap-3 text-center px-4">
            <div>
              <CameraOff size={32} className="text-white/40 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-white/60">Camera is off</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 grid place-items-center">
            <Spinner size={8} light />
          </div>
        )}

        {active && (
          <div className="absolute inset-0 pointer-events-none">
            {[
              "top-4 left-4 border-t-2 border-l-2 rounded-tl",
              "top-4 right-4 border-t-2 border-r-2 rounded-tr",
              "bottom-4 left-4 border-b-2 border-l-2 rounded-bl",
              "bottom-4 right-4 border-b-2 border-r-2 rounded-br",
            ].map(cls => (
              <span key={cls} className={`absolute w-8 h-8 border-accent ${cls}`} />
            ))}
          </div>
        )}
      </div>

      {err && <Alert tone="danger">{err}</Alert>}

      <Button
        variant={active ? "secondary" : "primary"}
        icon={active ? CameraOff : err ? RefreshCw : Camera}
        onClick={active ? stopCamera : startCamera}
        loading={loading}
      >
        {active ? "Stop camera" : err ? "Try again" : "Open camera"}
      </Button>

      <p className="text-xs text-muted-fg text-center">
        Point the camera at the QR code.
      </p>
    </div>
  );
}
