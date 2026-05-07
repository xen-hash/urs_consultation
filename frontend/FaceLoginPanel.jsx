// FaceLoginPanel.jsx — Camera-based biometric login panel
import { useRef, useState, useEffect, useCallback } from "react";
import { Camera, ScanFace, WifiOff, RefreshCw, X } from "lucide-react";
import { API_BASE } from "./constants.js";
import { Spinner } from "./SharedUI.jsx";

export default function FaceLoginPanel({ onSuccess, onError }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [stage, setStage]       = useState("starting"); // starting | ready | scanning | error | offline
  const [camError, setCamError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [dots, setDots]         = useState("");

  // Animate scanning dots
  useEffect(() => {
    if (stage !== "scanning") return;
    const iv = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 500);
    return () => clearInterval(iv);
  }, [stage]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCamError(null);
    setStage("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("NotSupported");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stream.getTracks().forEach(t => t.stop()); return; }
      video.srcObject = stream;
      await new Promise(r => { video.onloadedmetadata = r; });
      try { await video.play(); } catch (_) {}
      setStage("ready");
    } catch (e) {
      let msg = "Camera unavailable.";
      if (e.name === "NotAllowedError" || e.message?.includes("Permission"))
        msg = "Camera permission denied. Tap the camera icon in your browser's address bar and allow access.";
      else if (e.name === "NotFoundError")
        msg = "No camera found. Please connect a camera and try again.";
      else if (e.name === "NotReadableError")
        msg = "Camera is in use by another app. Close it and retry.";
      else if (e.message === "NotSupported")
        msg = "Camera not supported in this browser. Try Chrome or Safari.";
      setCamError(msg);
      setStage("error");
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const captureAndVerify = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || scanning) return;
    setScanning(true);
    setStage("scanning");

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const imageBase64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];

    try {
      const res = await fetch(`${API_BASE}/biometric/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64 }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      stopCamera();
      onSuccess?.(data);
    } catch (e) {
      const isOffline = e.message?.includes("fetch") || e.name === "TimeoutError"
        || e.message?.includes("offline") || e.message?.includes("service");
      if (isOffline) {
        setStage("offline");
      } else {
        setStage("ready");
        onError?.(e.message || "Face not recognized. Please try again.");
      }
    } finally {
      setScanning(false);
    }
  }, [scanning, onSuccess, onError, stopCamera]);

  return (
    <div className="space-y-4">
      {/* Camera viewport */}
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-300
            ${stage === "ready" || stage === "scanning" ? "opacity-100" : "opacity-30"}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay states */}
        {stage === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3">
            <Spinner size={8} light />
            <p className="text-white/70 text-sm">Starting camera…</p>
          </div>
        )}

        {stage === "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* Face guide oval */}
            <div className="w-40 h-52 rounded-full border-2 border-dashed border-white/50 flex items-center justify-center">
              <ScanFace size={40} className="text-white/30" />
            </div>
            <p className="text-white/60 text-xs mt-3 bg-black/40 px-3 py-1 rounded-full">
              Position your face in the oval
            </p>
          </div>
        )}

        {stage === "scanning" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 gap-3">
            <div className="w-40 h-52 rounded-full border-2 border-[#ffa000] animate-pulse flex items-center justify-center">
              <ScanFace size={40} className="text-[#ffa000]" />
            </div>
            <p className="text-white font-semibold text-sm">Scanning{dots}</p>
          </div>
        )}

        {stage === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 p-6">
            <Camera size={36} className="text-red-400" />
            <p className="text-white/80 text-sm text-center">{camError}</p>
            <button onClick={startCamera}
              className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl transition-all">
              <RefreshCw size={12} /> Try Again
            </button>
          </div>
        )}

        {stage === "offline" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 p-6">
            <WifiOff size={36} className="text-amber-400" />
            <p className="text-white font-semibold text-sm">Biometric Service Offline</p>
            <p className="text-white/60 text-xs text-center">
              The face recognition service is not running. Contact the administrator to enable biometric login.
            </p>
          </div>
        )}
      </div>

      {/* Scan button */}
      {(stage === "ready" || stage === "scanning") && (
        <button
          onClick={captureAndVerify}
          disabled={scanning || stage !== "ready"}
          className="w-full flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080]
                     text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg
                     disabled:opacity-50 active:scale-[0.98]">
          {scanning ? <Spinner size={4} light /> : <ScanFace size={16} />}
          {scanning ? "Verifying…" : "Scan My Face"}
        </button>
      )}

      <p className="text-center text-xs text-white/30">
        Make sure you are enrolled before using biometric login
      </p>
    </div>
  );
}