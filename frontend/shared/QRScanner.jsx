import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, RefreshCw, ImageUp } from "lucide-react";
import { Button, Spinner, Alert } from "./SharedUI.jsx";

// jsQR is imported at module scope. It used to be dynamically imported *inside*
// the requestAnimationFrame loop, which created a promise every frame at 60fps.
// Module-cached, so not a network cost, but a microtask storm that pinned the
// CPU and warmed the phone up noticeably during a scan.

const SCAN_INTERVAL_MS = 100;   // ~10fps is plenty for a QR in frame
const SCAN_EDGE = 480;          // downscale before decoding
const METADATA_TIMEOUT_MS = 10000;

// A saved photo or screenshot is decoded at a few sizes before giving up. A
// live frame is framed by the person holding the phone; a picture from the
// gallery might be a 12-megapixel photo of a card on a desk, or a 300px
// screenshot, and one fixed scale reads only some of those.
const FILE_SCAN_EDGES = [1000, 640, 1600];
const MAX_FILE_BYTES = 12 * 1024 * 1024;

/** Touch devices need an explicit gesture before getUserMedia. */
const isTouch = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(pointer: coarse)").matches;

export default function QRScanner({ onScan, onError, uploadLabel = "Upload a QR image" }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const scannedRef = useRef(false);

  const fileRef = useRef(null);

  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(false);
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

  /**
   * Read a QR out of a picture the person already has.
   *
   * On one device there is nothing to point the camera at: the card is a PDF or
   * a photo in the same phone's gallery, or it was emailed to them. Scanning
   * assumes two devices, one showing the code and one reading it, and plenty of
   * people have exactly one.
   */
  const readFile = useCallback(async (file) => {
    if (!file) return;
    setErr(null);

    if (!file.type.startsWith("image/")) {
      const msg = "That file isn't an image. Choose the picture of your QR code.";
      setErr(msg); onError?.(msg, "qr_unreadable");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      const msg = "That image is too large. Try a screenshot of the code instead.";
      setErr(msg); onError?.(msg, "qr_unreadable");
      return;
    }

    setReading(true);
    stopCamera();
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("decode"));
        image.src = url;
      });

      const canvas = canvasRef.current || document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      for (const edge of FILE_SCAN_EDGES) {
        const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // attemptBoth, unlike the live loop: a screenshot of a dark-mode card
        // or a photo shot against the light can arrive inverted, and there is
        // no next frame to do better.
        const code = jsQR(frame.data, frame.width, frame.height,
                          { inversionAttempts: "attemptBoth" });
        if (code?.data) {
          scannedRef.current = true;
          onScan(code.data.trim());
          return;
        }
      }

      const msg = "No QR code found in that image. Make sure the whole code is in the picture and try again.";
      setErr(msg);
      onError?.(msg, "qr_unreadable");
    } catch {
      const msg = "That image couldn't be opened. Try a different file.";
      setErr(msg);
      onError?.(msg, "qr_unreadable");
    } finally {
      URL.revokeObjectURL(url);
      setReading(false);
    }
  }, [onScan, onError, stopCamera]);

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
      onError?.(msg, "camera");
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

      <div className="w-full max-w-xs flex flex-col gap-2">
        <Button
          variant={active ? "secondary" : "primary"}
          icon={active ? CameraOff : err ? RefreshCw : Camera}
          onClick={active ? stopCamera : startCamera}
          loading={loading}
          className="w-full"
        >
          {active ? "Stop camera" : err ? "Try again" : "Open camera"}
        </Button>

        {/* The way in for anyone holding a single device: the code is a photo
            or a PDF on this same phone, with no second screen to point at. */}
        <Button
          icon={ImageUp}
          onClick={() => fileRef.current?.click()}
          loading={reading}
          className="w-full"
        >
          {reading ? "Reading image…" : uploadLabel}
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={uploadLabel}
          onChange={e => {
            const file = e.target.files?.[0];
            // Reset first, so choosing the same file twice still fires.
            e.target.value = "";
            readFile(file);
          }}
        />
      </div>

      <p className="text-xs text-muted-fg text-center">
        Point the camera at the QR code, or upload a picture of it.
      </p>
    </div>
  );
}
