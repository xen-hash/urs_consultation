import { useRef, useState, useCallback } from "react";
import { Camera, Download, RotateCcw, Check, User } from "lucide-react";
import { Spinner } from "./SharedUI.jsx";

// ── Webcam Photo Capture ──────────────────────────────────────────────────────
export function WebcamCapture({ onCapture, onSkip }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const [active, setActive]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [countdown, setCountdown] = useState(null);

  const startCamera = async () => {
    setLoading(true); setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (e) {
      setError("Camera access denied. Please allow camera permission.");
    } finally { setLoading(false); }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setActive(false);
  };

  const capturePhoto = () => {
    // 3-second countdown
    let count = 3;
    setCountdown(count);
    const iv = setInterval(() => {
      count--;
      if (count === 0) {
        clearInterval(iv);
        setCountdown(null);
        // Take the shot
        const video  = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        // Mirror the image (selfie view)
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        stopCamera();
        onCapture(dataUrl);
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-sm aspect-square bg-black rounded-2xl overflow-hidden border-2 border-white/20">
        <video ref={videoRef} className="w-full h-full object-cover"
          muted playsInline style={{ transform: "scaleX(-1)", display: active ? "block" : "none" }} />
        <canvas ref={canvasRef} className="hidden" />

        {!active && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
            <User size={48} className="text-white/30" />
            <p className="text-white/50 text-sm">Camera not active</p>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner size={10} light />
          </div>
        )}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-white font-display font-black text-8xl animate-bounce-in">{countdown}</span>
          </div>
        )}
        {active && countdown === null && (
          <>
            {/* Face guide oval */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-40 h-48 border-2 border-white/50 rounded-full" style={{ borderStyle: "dashed" }} />
            </div>
            {/* Corner guides */}
            <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-[#ffa000]" />
            <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-[#ffa000]" />
            <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-[#ffa000]" />
            <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-[#ffa000]" />
          </>
        )}
      </div>

      {error && <p className="text-red-400 text-xs text-center">{error}</p>}

      <div className="flex gap-3 w-full max-w-sm">
        {!active ? (
          <button onClick={startCamera} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080]
                       text-white font-semibold py-3 rounded-2xl transition-all disabled:opacity-50">
            {loading ? <Spinner size={4} light /> : <Camera size={18} />}
            {loading ? "Starting..." : "Open Camera"}
          </button>
        ) : (
          <button onClick={capturePhoto} disabled={countdown !== null}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700
                       text-white font-semibold py-3 rounded-2xl transition-all disabled:opacity-60">
            <Camera size={18} />
            {countdown !== null ? `Taking photo in ${countdown}...` : "Take Photo"}
          </button>
        )}
        <button onClick={onSkip}
          className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm px-4 py-3
                     glass rounded-2xl transition-all">
          Skip
        </button>
      </div>
      <p className="text-white/30 text-xs">Position your face inside the oval guide</p>
    </div>
  );
}

// ── Faculty ID Card ───────────────────────────────────────────────────────────
export function FacultyIDCard({ name, department, employeeId, photo, qrBase64, onDownload }) {
  const cardRef = useRef(null);
  const deptShort = department.replace(" Department", "").replace(" Engineering", " Engr.");

  const downloadID = async () => {
    // Use html2canvas-like approach with canvas
    const card = cardRef.current;
    if (!card) return;

    // Create a canvas to draw the ID
    const canvas = document.createElement("canvas");
    canvas.width  = 640;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");

    // Background
    const grad = ctx.createLinearGradient(0, 0, 640, 400);
    grad.addColorStop(0, "#001a4d");
    grad.addColorStop(0.5, "#003366");
    grad.addColorStop(1, "#001a4d");
    ctx.fillStyle = grad;
    ctx.roundRect(0, 0, 640, 400, 16);
    ctx.fill();

    // Gold top bar
    ctx.fillStyle = "#ffa000";
    ctx.fillRect(0, 0, 640, 8);

    // URS header text
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 18px serif";
    ctx.fillText("UNIVERSITY OF RIZAL SYSTEM", 30, 40);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px sans-serif";
    ctx.fillText("College of Engineering — Faculty Identification Card", 30, 60);

    // Divider
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(30, 75); ctx.lineTo(610, 75); ctx.stroke();

    // Photo area
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.roundRect(30, 90, 160, 180, 8);
    ctx.fill();

    if (photo) {
      const img = new Image();
      await new Promise(res => { img.onload = res; img.src = photo; });
      ctx.save();
      ctx.roundRect(30, 90, 160, 180, 8);
      ctx.clip();
      ctx.drawImage(img, 30, 90, 160, 180);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "60px serif";
      ctx.textAlign = "center";
      ctx.fillText(name.replace(/^(Engr\.|Dr\.|Prof\.|AR\.)\s*/, "")[0], 110, 200);
      ctx.textAlign = "left";
    }

    // Name & info
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px serif";
    ctx.fillText(name, 210, 130);

    ctx.fillStyle = "#ffa000";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(department.toUpperCase(), 210, 155);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px sans-serif";
    ctx.fillText("FACULTY", 210, 180);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("Employee ID:", 210, 215);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px monospace";
    ctx.fillText(employeeId, 210, 235);

    // QR Code
    if (qrBase64) {
      const qrImg = new Image();
      await new Promise(res => { qrImg.onload = res; qrImg.src = `data:image/png;base64,${qrBase64}`; });
      ctx.fillStyle = "#ffffff";
      ctx.roundRect(430, 80, 180, 180, 10);
      ctx.fill();
      ctx.drawImage(qrImg, 438, 88, 164, 164);
    }

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Scan QR to view availability", 520, 275);
    ctx.textAlign = "left";

    // Bottom bar
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 340, 640, 60);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "10px sans-serif";
    ctx.fillText("This card is the property of University of Rizal System. If found, please return to the Registrar's Office.", 30, 368);
    ctx.fillText("URS Faculty Consultation System · College of Engineering", 30, 386);

    // Download
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `URS-Faculty-ID-${name.replace(/\s+/g, "-")}.png`;
    link.click();
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Preview Card */}
      <div ref={cardRef}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-white/20"
        style={{ background: "linear-gradient(135deg, #001a4d 0%, #003366 50%, #001a4d 100%)" }}>

        {/* Gold top accent */}
        <div className="h-2 bg-gradient-to-r from-[#ffa000] to-[#ffcc02]" />

        {/* Header */}
        <div className="px-5 py-3 border-b border-white/10">
          <p className="text-white font-display font-bold text-sm">UNIVERSITY OF RIZAL SYSTEM</p>
          <p className="text-white/40 text-xs">College of Engineering — Faculty Identification Card</p>
        </div>

        {/* Body */}
        <div className="flex items-start gap-4 p-5">
          {/* Photo */}
          <div className="w-28 h-32 rounded-xl overflow-hidden border-2 border-white/20 shrink-0 bg-white/10 flex items-center justify-center">
            {photo
              ? <img src={photo} alt="Profile" className="w-full h-full object-cover" />
              : <div className="flex flex-col items-center gap-1 text-white/30">
                  <User size={32} />
                  <span className="text-xs">No photo</span>
                </div>
            }
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 py-1">
            <p className="font-display font-bold text-white text-lg leading-tight truncate">{name}</p>
            <p className="text-[#ffa000] font-bold text-xs uppercase mt-1 tracking-wider">{department}</p>
            <p className="text-white/40 text-xs mt-2">FACULTY</p>
            <div className="mt-3">
              <p className="text-white/40 text-[10px] uppercase tracking-wider">Employee ID</p>
              <p className="text-white font-mono font-bold text-sm">{employeeId}</p>
            </div>
          </div>

          {/* QR */}
          <div className="shrink-0 flex flex-col items-center gap-1.5">
            <div className="w-36 h-36 bg-white rounded-2xl p-2 shadow-xl border border-white/20">
              {qrBase64 && <img src={`data:image/png;base64,${qrBase64}`} alt="QR" className="w-full h-full" />}
            </div>
            <p className="text-white/30 text-[9px] text-center">Scan to verify</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-white/5 border-t border-white/10">
          <p className="text-white/25 text-[9px]">
            This card is the property of URS. If found, please return to the Registrar's Office.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 w-full max-w-lg">
        <button onClick={downloadID}
          className="flex-1 flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080]
                     text-white font-semibold py-3 rounded-2xl transition-all shadow-lg">
          <Download size={16} /> Download ID Card
        </button>
        {onDownload && (
          <button onClick={onDownload}
            className="flex items-center justify-center gap-2 glass text-white font-semibold
                       py-3 px-5 rounded-2xl transition-all text-sm">
            <Check size={15} /> Done
          </button>
        )}
      </div>
    </div>
  );
}