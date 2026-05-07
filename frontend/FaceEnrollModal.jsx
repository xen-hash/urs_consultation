// FaceEnrollModal.jsx — Teacher enrolls a student's face + eye biometrics
import { useRef, useState, useEffect, useCallback } from "react";
import { X, Camera, CheckCircle2, Loader, Trash2, ScanFace, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import FaceOverlay from "./FaceOverlay.jsx";
import { API_BASE } from "./constants.js";
import { Spinner } from "./SharedUI.jsx";
const REQUIRED_CAPTURES = 5;

export default function FaceEnrollModal({ open, onClose, students = [] }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectRef = useRef(null);

  const [camReady, setCamReady]       = useState(false);
  const [camError, setCamError]       = useState(null);   // camera error message
  const [svcOnline, setSvcOnline]     = useState(null);   // biometric service status
  const [detection, setDetection]     = useState(null);
  const [captures, setCaptures]       = useState([]);
  const [selectedId, setSelectedId]   = useState("");
  const [type, setType]               = useState("student");
  const [enrolling, setEnrolling]     = useState(false);
  const [result, setResult]           = useState(null);
  const [videoDims, setVideoDims]     = useState({ w:640, h:480 });

  // Check biometric service availability
  const checkService = useCallback(async () => {
    try {
      const r = await fetch("http://localhost:8000/health", { signal: AbortSignal.timeout(3000) });
      const data = await r.json();
      setSvcOnline(data.status === "ok" ? true : false);
    } catch {
      setSvcOnline(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      checkService();
      startCamera();
      setCaptures([]);
      setResult(null);
      setCamError(null);
    } else {
      stopAll();
    }
    return () => stopAll();
  }, [open]);

  const startCamera = async () => {
    setCamError(null);
    setCamReady(false);

    // mediaDevices is only available on localhost or HTTPS
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCamError(
        "Camera API not available. Open the app via http://localhost:5173 (not an IP address), or use HTTPS."
      );
      return;
    }

    // Small delay to ensure the video element is mounted in the DOM
    await new Promise(r => setTimeout(r, 80));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach(t => t.stop());
        setCamError("Camera element not ready. Please close and reopen this panel.");
        return;
      }
      video.srcObject = stream;
      await new Promise(r => { video.onloadedmetadata = r; });
      try { await video.play(); } catch (_) { /* autoplay blocked — video still shows */ }
      setVideoDims({ w: video.videoWidth || 640, h: video.videoHeight || 480 });
      setCamReady(true);
      startDetectLoop();
    } catch (e) {
      let msg = "Camera not accessible.";
      if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
        msg = "No camera found. Please connect a webcam and try again.";
      } else if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        msg = "Camera permission denied. Click the camera icon in Chrome's address bar and allow access.";
      } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
        msg = "Camera is in use by another application. Close any other apps using the camera and retry.";
      }
      setCamError(msg);
    }
  };

  const stopAll = () => {
    clearInterval(detectRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCamReady(false);
  };

  const captureFrame = () => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width=video.videoWidth; canvas.height=video.videoHeight;
    canvas.getContext("2d").drawImage(video,0,0);
    return canvas.toDataURL("image/jpeg",0.85);
  };

  const startDetectLoop = () => {
    detectRef.current = setInterval(async () => {
      const frame = captureFrame();
      if (!frame) return;
      try {
        const r = await fetch(`${API_BASE}/biometric/detect`, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({image:frame})
        });
        setDetection(await r.json());
      } catch {}
    }, 80);
  };

  const handleCapture = useCallback(() => {
    if (!detection?.detected) return;
    const frame = captureFrame();
    if (!frame) return;
    setCaptures(p => [...p, frame].slice(0, REQUIRED_CAPTURES));
  }, [detection]);

  const handleEnroll = async () => {
    if (!selectedId || captures.length < REQUIRED_CAPTURES) return;
    setEnrolling(true);
    const label = `${type}_${selectedId}`;
    try {
      const r = await fetch(`${API_BASE}/biometric/enroll`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ label, images: captures })
      });
      const data = await r.json();
      setResult(data);
      if (data.enrolled) clearInterval(detectRef.current);
    } catch (e) {
      setResult({ enrolled:false, error:e.message });
    } finally {
      setEnrolling(false);
    }
  };

  if (!open) return null;

  const canEnroll = selectedId && captures.length >= REQUIRED_CAPTURES;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#001830] border border-white/15 rounded-3xl shadow-2xl w-full max-w-2xl
                      max-h-[90vh] overflow-y-auto animate-bounce-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#003366] rounded-xl flex items-center justify-center">
              <ScanFace size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-white">Biometric Enrollment</h2>
              <p className="text-white/40 text-xs">Capture {REQUIRED_CAPTURES} photos for face + eye registration</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Service status indicator */}
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border
              ${svcOnline === true ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
              : svcOnline === false ? "bg-red-500/20 border-red-400/40 text-red-300"
              : "bg-white/10 border-white/20 text-white/40"}`}>
              {svcOnline === true ? <Wifi size={11} /> : <WifiOff size={11} />}
              {svcOnline === true ? "Service Online" : svcOnline === false ? "Service Offline" : "Checking..."}
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <X size={15} className="text-white/60" />
            </button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">

          {/* ── Service Offline Warning ─────────────────────────────────── */}
          {svcOnline === false && (
            <div className="bg-red-500/15 border border-red-400/40 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 font-bold text-sm">Biometric Service is Offline</p>
                  <p className="text-red-400/80 text-xs mt-1">
                    The biometric microservice (port 8000) is not running. Start it with:
                  </p>
                  <code className="block mt-1.5 bg-black/30 text-green-300 text-xs px-3 py-2 rounded-lg">
                    cd backend && uvicorn biometric_service:app --port 8000 --host 0.0.0.0
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* Subject selector */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-1.5 block">Enrolling As</label>
              <select
                className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                value={type} onChange={e => { setType(e.target.value); setSelectedId(""); }}>
                <option value="student" className="text-gray-800">Student</option>
                <option value="teacher" className="text-gray-800">Teacher (self / by ID)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-1.5 block">
                {type === "student" ? "Select Student" : "Employee ID"}
              </label>
              {type === "student" ? (
                <select
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                  <option value="" className="text-gray-800">— select student —</option>
                  {students.map(s => (
                    <option key={s.student_id} value={s.student_id} className="text-gray-800">
                      {s.full_name} ({s.student_id})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2.5 text-sm
                             placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                  placeholder="e.g. EMP-ABCD1234"
                  value={selectedId}
                  onChange={e => setSelectedId(e.target.value)}
                />
              )}
            </div>
          </div>

          {/* ── Camera area ─────────────────────────────────────────────── */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-950 border-2
            border-white/10 max-w-sm mx-auto w-full">

            <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />

            {camReady && (
              <div className="absolute inset-0" style={{ transform:"scaleX(-1)" }}>
                <FaceOverlay detection={detection} videoWidth={videoDims.w} videoHeight={videoDims.h} />
              </div>
            )}

            {/* Loading */}
            {!camReady && !camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Loader size={32} className="text-white animate-spin" />
                <p className="text-white/50 text-sm">Starting camera…</p>
              </div>
            )}

            {/* Camera Error */}
            {camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-5 text-center">
                <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center">
                  <Camera size={28} className="text-red-400" />
                </div>
                <div>
                  <p className="text-red-400 font-bold text-sm">{camError}</p>
                  <p className="text-white/30 text-xs mt-1">Check your camera connection and permissions</p>
                </div>
                <button
                  onClick={startCamera}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold
                             px-4 py-2 rounded-xl transition-all border border-white/20">
                  <Camera size={13} /> Retry Camera
                </button>
              </div>
            )}

            {/* Capture counter dots */}
            {camReady && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {Array.from({length: REQUIRED_CAPTURES}).map((_,i) => (
                  <div key={i} className={`w-2.5 h-2.5 rounded-full border transition-all
                    ${i < captures.length
                      ? "bg-emerald-400 border-emerald-400 scale-110"
                      : "bg-white/20 border-white/30"}`} />
                ))}
              </div>
            )}
          </div>

          {/* Detection status */}
          {camReady && (
            <div className={`text-center text-sm font-semibold transition-colors
              ${detection?.detected ? "text-emerald-400" : "text-white/40"}`}>
              {detection?.detected
                ? `✓ Face detected — ${detection.eyes?.length >= 2 ? "eyes visible" : "look straight at camera"}`
                : "No face detected — position yourself in frame"}
            </div>
          )}

          {/* Capture button */}
          {camReady && (
            <div className="flex justify-center">
              <button
                onClick={handleCapture}
                disabled={!detection?.detected || captures.length >= REQUIRED_CAPTURES || !!result?.enrolled}
                className="flex items-center gap-2 bg-[#003366] hover:bg-[#004080] disabled:opacity-40
                           text-white font-semibold px-8 py-3 rounded-2xl transition-all active:scale-95 text-sm">
                <Camera size={17} />
                {captures.length >= REQUIRED_CAPTURES
                  ? `✓ All ${REQUIRED_CAPTURES} photos captured`
                  : `Capture Photo (${captures.length}/${REQUIRED_CAPTURES})`}
              </button>
            </div>
          )}

          {/* Thumbnail strip */}
          {captures.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {captures.map((src, i) => (
                <div key={i} className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 border-emerald-400/60 relative">
                  <img src={src} alt={`cap${i}`} className="w-full h-full object-cover scale-x-[-1]" />
                  <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-400 rounded-full flex items-center justify-center">
                    <span className="text-white text-[8px] font-black">{i+1}</span>
                  </div>
                </div>
              ))}
              <button
                onClick={() => { setCaptures([]); setResult(null); }}
                className="w-16 h-16 rounded-xl border border-white/15 flex flex-col items-center justify-center
                           shrink-0 text-white/40 hover:text-red-400 hover:border-red-400/40 transition-all gap-1">
                <Trash2 size={14} />
                <span className="text-[9px]">Reset</span>
              </button>
            </div>
          )}

          {/* Enroll button */}
          {!result?.enrolled && (
            <button
              onClick={handleEnroll}
              disabled={!canEnroll || enrolling || svcOnline === false}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700
                         disabled:opacity-40 text-white font-bold py-3.5 rounded-2xl transition-all text-sm
                         active:scale-[0.98]">
              {enrolling ? <Spinner size={4} light /> : <ScanFace size={17} />}
              {enrolling ? "Enrolling biometrics…" : "Enroll Face + Eyes"}
            </button>
          )}

          {!canEnroll && !result?.enrolled && captures.length < REQUIRED_CAPTURES && selectedId && (
            <p className="text-center text-white/30 text-xs">
              Capture {REQUIRED_CAPTURES - captures.length} more photo{REQUIRED_CAPTURES - captures.length !== 1 ? "s" : ""} to enable enrollment
            </p>
          )}
          {!selectedId && (
            <p className="text-center text-amber-400/70 text-xs">
              ⚠ Select a {type === "student" ? "student" : "teacher"} above before enrolling
            </p>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-2xl px-5 py-4 flex items-start gap-3 border
              ${result.enrolled
                ? "bg-emerald-500/15 border-emerald-500/30"
                : "bg-red-500/15 border-red-500/30"}`}>
              {result.enrolled
                ? <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                : <X size={20} className="text-red-400 shrink-0 mt-0.5" />
              }
              <div>
                <p className={`font-bold text-sm ${result.enrolled ? "text-emerald-300" : "text-red-400"}`}>
                  {result.enrolled ? "Enrollment successful! 🎉" : "Enrollment failed"}
                </p>
                {result.enrolled && (
                  <p className="text-white/50 text-xs mt-1 space-y-0.5">
                    <span className="block">✓ {result.face_samples} face samples saved (engine: {result.engine})</span>
                    <span className="block">✓ {result.eye_samples} eye samples saved</span>
                    {result.avg_sharpness && <span className="block">✓ Average image sharpness: {result.avg_sharpness}</span>}
                    <span className="block mt-1.5 text-emerald-400/80 font-semibold">
                      Label: <code className="bg-black/20 px-1.5 py-0.5 rounded">{result.label}</code>
                    </span>
                    <span className="block text-white/30 mt-1">This user can now log in using Face + Eye biometrics.</span>
                  </p>
                )}
                {result.error && <p className="text-red-300 text-xs mt-0.5">{result.error}</p>}
              </div>
            </div>
          )}

          {/* Tips */}
          {camReady && !result?.enrolled && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1.5">Tips for best results</p>
              <ul className="text-white/30 text-[11px] space-y-1 list-disc list-inside">
                <li>Face the camera directly — slight angle variations help</li>
                <li>Ensure both eyes are clearly visible and open wide</li>
                <li>Use good even lighting — avoid direct backlight</li>
                <li>Remove glasses if possible for better eye recognition</li>
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
