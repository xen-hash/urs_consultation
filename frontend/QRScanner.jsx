import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader } from "lucide-react";

export default function QRScanner({ onScan, onError, autoStart = true }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const [active, setActive]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState(null);

  const startCamera = async () => {
    setLoading(true);
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;

      // Assign stream and wait for metadata before playing
      // This prevents the "play() interrupted by new load" race condition
      video.srcObject = stream;
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });

      // Abort if component unmounted while waiting
      if (!streamRef.current) return;

      await video.play();
      setActive(true);
      scanFrame();
    } catch (e) {
      // Ignore AbortError — happens when component unmounts mid-start
      if (e.name === "AbortError") return;
      const msg = e.name === "NotAllowedError"
        ? "Camera permission denied. Please allow camera access."
        : "Could not access camera. Try again.";
      setErr(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setActive(false);
  };

  const scanFrame = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    import("jsqr").then(({ default: jsQR }) => {
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert"
      });
      if (code && code.data) {
        stopCamera();
        onScan(code.data.trim());
      } else {
        rafRef.current = requestAnimationFrame(scanFrame);
      }
    });
  };

  // Auto-start camera when component mounts (if autoStart is true)
  useEffect(() => {
    if (autoStart) startCamera();
    return () => stopCamera();
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-xs aspect-square bg-gray-900 rounded-2xl overflow-hidden border-2 border-urs-blue/30">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
          style={{ display: active ? "block" : "none" }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {!active && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
            <CameraOff size={40} className="text-gray-400" />
            <p className="text-sm text-gray-400">Camera not active</p>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader size={32} className="text-white animate-spin" />
          </div>
        )}
        {active && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-urs-orange rounded-tl-md" />
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-urs-orange rounded-tr-md" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-urs-orange rounded-bl-md" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-urs-orange rounded-br-md" />
            <div className="absolute left-4 right-4 h-0.5 bg-urs-orange/60 animate-bounce" style={{ top: "50%" }} />
          </div>
        )}
      </div>

      {err && <p className="text-red-600 text-xs text-center max-w-xs">{err}</p>}

      <div className="flex gap-2">
        {!active ? (
          <button
            onClick={startCamera}
            disabled={loading}
            className="flex items-center gap-2 btn-primary text-sm py-2.5 px-5">
            <Camera size={16} />
            {loading ? "Starting..." : "Open Camera"}
          </button>
        ) : (
          <button onClick={stopCamera} className="flex items-center gap-2 btn-outline text-sm py-2.5 px-5">
            <CameraOff size={16} />
            Stop Camera
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 text-center">Point your camera at the QR code</p>
    </div>
  );
}
