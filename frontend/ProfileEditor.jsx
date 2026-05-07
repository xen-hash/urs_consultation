import { useState, useRef } from "react";
import { Camera, Download, User, Check, X, Pencil } from "lucide-react";
import { Spinner } from "./SharedUI.jsx";

// ── Webcam Photo Capture (reusable) ──────────────────────────────────────────
export function WebcamCapture({ onCapture, onCancel, title = "Take Your Photo" }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [active, setActive]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [countdown, setCount]   = useState(null);

  const start = async () => {
    setLoading(true); setError(null);

    // mediaDevices is only available on localhost or HTTPS
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Camera API not available. Open the app via http://localhost:5173 (not an IP address), or use HTTPS.");
      setLoading(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch (_) { /* autoplay blocked — still shows */ }
      }
      setActive(true);
    } catch (e) {
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setError("Camera permission denied. Click the camera icon in Chrome's address bar and allow access.");
      } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
        setError("No camera found. Please connect a webcam.");
      } else if (e.name === "NotReadableError") {
        setError("Camera is in use by another app. Close it and try again.");
      } else {
        setError("Camera access failed. Please allow camera permission.");
      }
    }
    finally { setLoading(false); }
  };

  const stop = () => { streamRef.current?.getTracks().forEach(t => t.stop()); setActive(false); };

  const capture = () => {
    let c = 3; setCount(c);
    const iv = setInterval(() => {
      c--;
      if (c === 0) {
        clearInterval(iv); setCount(null);
        const v = videoRef.current, cv = canvasRef.current;
        if (!v || !cv) return;
        cv.width = v.videoWidth; cv.height = v.videoHeight;
        const ctx = cv.getContext("2d");
        ctx.translate(cv.width, 0); ctx.scale(-1, 1);
        ctx.drawImage(v, 0, 0);
        stop();
        onCapture(cv.toDataURL("image/jpeg", 0.9));
      } else { setCount(c); }
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="font-semibold text-gray-700 text-sm">{title}</p>
      <div className="relative w-full max-w-xs aspect-square bg-gray-900 rounded-2xl overflow-hidden border-2 border-gray-200">
        <video ref={videoRef} muted playsInline
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)", display: active ? "block" : "none" }} />
        <canvas ref={canvasRef} className="hidden" />
        {!active && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
            <User size={40} /> <p className="text-sm">Camera not active</p>
          </div>
        )}
        {loading && <div className="absolute inset-0 flex items-center justify-center"><Spinner size={10} /></div>}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-white font-black text-8xl animate-bounce-in">{countdown}</span>
          </div>
        )}
        {active && countdown === null && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-36 h-44 border-2 border-white/50 rounded-full" style={{ borderStyle: "dashed" }} />
            </div>
            <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-[#ffa000]" />
            <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-[#ffa000]" />
            <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-[#ffa000]" />
            <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-[#ffa000]" />
          </>
        )}
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <div className="flex gap-2 w-full max-w-xs">
        {!active
          ? <button onClick={start} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080]
                         text-white font-semibold py-2.5 rounded-xl transition-all text-sm disabled:opacity-50">
              {loading ? <Spinner size={4} light /> : <Camera size={15} />}
              {loading ? "Starting..." : "Open Camera"}
            </button>
          : <button onClick={capture} disabled={countdown !== null}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700
                         text-white font-semibold py-2.5 rounded-xl transition-all text-sm disabled:opacity-60">
              <Camera size={15} />
              {countdown !== null ? `Taking in ${countdown}...` : "Take Photo"}
            </button>
        }
        <button onClick={onCancel}
          className="px-4 py-2.5 border border-gray-200 text-gray-500 hover:text-gray-700 rounded-xl text-sm transition-all">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── ID Card Generator ─────────────────────────────────────────────────────────

function truncate(str, max) {
  return str && str.length > max ? str.substring(0, max) + "…" : (str || "");
}

export async function generateIDCard({ name, subtitle, idNumber, role, photo, qrBase64, type = "student" }) {
  const W = 660, H = 415;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // ── Background gradient ──────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,   "#000e2e");
  bg.addColorStop(0.35,"#002368");
  bg.addColorStop(0.65,"#003380");
  bg.addColorStop(1,   "#000e2e");
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, 16); ctx.fill();

  // Radial centre glow
  const glow = ctx.createRadialGradient(W * 0.55, H * 0.35, 0, W * 0.55, H * 0.35, W * 0.55);
  glow.addColorStop(0, "rgba(0,90,200,0.28)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Subtle diagonal stripe texture
  ctx.save();
  ctx.globalAlpha = 0.025;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 8;
  for (let i = -H; i < W + H; i += 28) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
  }
  ctx.restore();

  // ── Gold top accent bar ──────────────────────────────────────────────────
  const goldBar = ctx.createLinearGradient(0, 0, W, 0);
  goldBar.addColorStop(0,   "#7d5a00");
  goldBar.addColorStop(0.25,"#ffd700");
  goldBar.addColorStop(0.5, "#ffa000");
  goldBar.addColorStop(0.75,"#ffd700");
  goldBar.addColorStop(1,   "#7d5a00");
  ctx.fillStyle = goldBar;
  ctx.fillRect(0, 0, W, 10);

  // ── URS circle seal ──────────────────────────────────────────────────────
  const LX = 42, LY = 45;
  const sealGrad = ctx.createRadialGradient(LX, LY, 0, LX, LY, 24);
  sealGrad.addColorStop(0, "#003d9a");
  sealGrad.addColorStop(1, "#001560");
  ctx.fillStyle = sealGrad;
  ctx.beginPath(); ctx.arc(LX, LY, 24, 0, Math.PI * 2); ctx.fill();
  const sealRing = ctx.createLinearGradient(LX - 24, LY, LX + 24, LY);
  sealRing.addColorStop(0, "rgba(255,180,0,0.4)");
  sealRing.addColorStop(0.5, "rgba(255,220,0,0.9)");
  sealRing.addColorStop(1, "rgba(255,180,0,0.4)");
  ctx.strokeStyle = sealRing;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(LX, LY, 24, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px serif";
  ctx.textAlign = "center";
  ctx.fillText("URS", LX, LY + 5);
  ctx.textAlign = "left";

  // Header text
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "bold 13px serif";
  ctx.fillText("UNIVERSITY OF RIZAL SYSTEM", 76, 37);
  ctx.fillStyle = "rgba(255,200,0,0.7)";
  ctx.font = "9.5px sans-serif";
  const cardLabel = "College of Engineering — " + (type === "student" ? "Student" : "Faculty") + " Identification Card";
  ctx.fillText(cardLabel, 76, 54);

  // Header divider with gold fade
  const divGrad = ctx.createLinearGradient(0, 0, W, 0);
  divGrad.addColorStop(0,   "rgba(255,180,0,0.6)");
  divGrad.addColorStop(0.5, "rgba(255,255,255,0.15)");
  divGrad.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(28, 68); ctx.lineTo(W - 28, 68); ctx.stroke();

  // ── Photo area ───────────────────────────────────────────────────────────
  const PX = 30, PY = 84, PW = 148, PH = 185;

  // Gold frame glow
  ctx.fillStyle = "rgba(255,180,0,0.12)";
  ctx.beginPath(); ctx.roundRect(PX - 4, PY - 4, PW + 8, PH + 8, 12); ctx.fill();
  const frameGrad = ctx.createLinearGradient(PX, PY, PX + PW, PY + PH);
  frameGrad.addColorStop(0, "rgba(255,220,0,0.7)");
  frameGrad.addColorStop(0.5, "rgba(255,140,0,0.4)");
  frameGrad.addColorStop(1, "rgba(255,220,0,0.7)");
  ctx.strokeStyle = frameGrad;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(PX - 4, PY - 4, PW + 8, PH + 8, 12); ctx.stroke();

  if (photo) {
    const img = new Image();
    await new Promise(res => { img.onload = res; img.onerror = res; img.src = photo; });
    ctx.save();
    ctx.beginPath(); ctx.roundRect(PX, PY, PW, PH, 8); ctx.clip();
    ctx.drawImage(img, PX, PY, PW, PH);
    ctx.restore();
  } else {
    const photoBg = ctx.createLinearGradient(PX, PY, PX, PY + PH);
    photoBg.addColorStop(0, "rgba(0,40,110,0.7)");
    photoBg.addColorStop(1, "rgba(0,15,50,0.8)");
    ctx.fillStyle = photoBg;
    ctx.beginPath(); ctx.roundRect(PX, PY, PW, PH, 8); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = "64px serif"; ctx.textAlign = "center";
    ctx.fillText((name[0] || "?").toUpperCase(), PX + PW / 2, PY + PH / 2 + 24);
    ctx.textAlign = "left";
  }

  // ── Info section ─────────────────────────────────────────────────────────
  const IX = 196;

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 21px serif";
  ctx.fillText(truncate(name.toUpperCase(), 26), IX, 115);

  const goldText = ctx.createLinearGradient(IX, 0, IX + 340, 0);
  goldText.addColorStop(0, "#ffd700"); goldText.addColorStop(1, "#ffa000");
  ctx.fillStyle = goldText;
  ctx.font = "bold 10px sans-serif";
  ctx.fillText(truncate(subtitle.toUpperCase(), 38), IX, 136);

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "9.5px sans-serif";
  ctx.fillText(truncate(role.toUpperCase(), 46), IX, 157);

  // Info divider
  const iDiv = ctx.createLinearGradient(IX, 0, IX + 260, 0);
  iDiv.addColorStop(0, "rgba(255,180,0,0.7)");
  iDiv.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = iDiv;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(IX, 168); ctx.lineTo(IX + 260, 168); ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "8.5px sans-serif";
  ctx.fillText(type === "student" ? "STUDENT ID NUMBER" : "EMPLOYEE ID NUMBER", IX, 186);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 17px monospace";
  ctx.fillText(idNumber, IX, 210);

  // Type badge pill
  const badgeW = 70, badgeH = 20, badgeX = IX, badgeY = 220;
  const badgeBg = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY);
  badgeBg.addColorStop(0, "rgba(255,160,0,0.2)");
  badgeBg.addColorStop(1, "rgba(255,200,0,0.1)");
  ctx.fillStyle = badgeBg;
  ctx.beginPath(); ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5); ctx.fill();
  ctx.strokeStyle = "rgba(255,180,0,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5); ctx.stroke();
  ctx.fillStyle = "rgba(255,200,0,0.9)";
  ctx.font = "bold 8px sans-serif";
  ctx.fillText(type === "student" ? "STUDENT" : "FACULTY MEMBER", badgeX + 8, badgeY + 13);

  // ── QR Code ──────────────────────────────────────────────────────────────
  if (qrBase64) {
    const QX = 448, QY = 72, QS = 190;
    // Container glow
    const qrGlow = ctx.createRadialGradient(QX + QS/2, QY + QS/2, 0, QX + QS/2, QY + QS/2, QS);
    qrGlow.addColorStop(0, "rgba(255,255,255,0.08)");
    qrGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = qrGlow;
    ctx.beginPath(); ctx.roundRect(QX - 8, QY - 8, QS + 16, QS + 16, 14); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(QX - 8, QY - 8, QS + 16, QS + 16, 14); ctx.stroke();
    // White QR bg
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.roundRect(QX, QY, QS, QS, 10); ctx.fill();
    const qrImg = new Image();
    await new Promise(res => { qrImg.onload = res; qrImg.onerror = res; qrImg.src = `data:image/png;base64,${qrBase64}`; });
    ctx.drawImage(qrImg, QX + 8, QY + 8, QS - 16, QS - 16);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "8.5px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Scan to Verify", QX + QS / 2, QY + QS + 16);
    ctx.textAlign = "left";
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const ftGrad = ctx.createLinearGradient(0, H - 56, 0, H);
  ftGrad.addColorStop(0, "rgba(0,0,0,0)");
  ftGrad.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = ftGrad;
  ctx.fillRect(0, H - 56, W, 56);

  const ftLine = ctx.createLinearGradient(0, 0, W, 0);
  ftLine.addColorStop(0, "rgba(255,180,0,0.25)");
  ftLine.addColorStop(0.5, "rgba(255,255,255,0.12)");
  ftLine.addColorStop(1, "rgba(0,0,0,0)");
  ctx.strokeStyle = ftLine;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(28, H - 50); ctx.lineTo(W - 28, H - 50); ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.font = "8.5px sans-serif";
  ctx.fillText("This card is the property of University of Rizal System. If found, please return to the Registrar's Office.", 28, H - 32);
  ctx.fillStyle = "rgba(255,180,0,0.45)";
  ctx.fillText("URS Faculty Consultation System · College of Engineering", 28, H - 16);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `URS-ID-${idNumber}.png`;
  link.click();
}

// ── ID Card Preview ───────────────────────────────────────────────────────────
export function IDCardPreview({ name, subtitle, idNumber, role, photo, qrBase64, type = "student" }) {
  const trunc = (s, n) => s && s.length > n ? s.substring(0, n) + "…" : (s || "");
  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl select-none"
      style={{ background: "linear-gradient(135deg, #000e2e 0%, #002368 40%, #003380 65%, #000e2e 100%)" }}>

      {/* Gold top bar */}
      <div style={{ height: 7, background: "linear-gradient(90deg,#7d5a00,#ffd700 30%,#ffa000 70%,#7d5a00)" }} />

      {/* Subtle diagonal stripe overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 18px, rgba(255,255,255,0.015) 18px, rgba(255,255,255,0.015) 19px)"
      }} />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2.5 border-b" style={{ borderColor: "rgba(255,180,0,0.2)" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border"
          style={{ background: "radial-gradient(circle, #003d9a, #001560)", borderColor: "rgba(255,200,0,0.5)" }}>
          <span className="text-white font-bold text-[10px]">URS</span>
        </div>
        <div>
          <p className="text-white font-bold text-[11px] tracking-wide">UNIVERSITY OF RIZAL SYSTEM</p>
          <p className="text-[9px]" style={{ color: "rgba(255,200,0,0.65)" }}>
            College of Engineering — {type === "student" ? "Student" : "Faculty"} Identification Card
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex items-start gap-3 px-4 py-3">

        {/* Photo */}
        <div className="shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
          style={{
            width: 72, height: 90,
            background: "linear-gradient(160deg,#002368,#000e2e)",
            border: "2px solid",
            borderColor: "rgba(255,190,0,0.5)",
            boxShadow: "0 0 10px rgba(255,160,0,0.15)"
          }}>
          {photo
            ? <img src={photo} alt="Profile" className="w-full h-full object-cover" />
            : <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 28 }}>
                {(name[0] || "?").toUpperCase()}
              </span>
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="font-bold text-white text-sm leading-tight truncate">{trunc(name.toUpperCase(), 26)}</p>
          <p className="font-bold text-[10px] mt-0.5 truncate"
            style={{ color: "#ffd700", background: "linear-gradient(90deg,#ffd700,#ffa000)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {trunc(subtitle.toUpperCase(), 32)}
          </p>
          <p className="text-[9px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
            {trunc(role.toUpperCase(), 38)}
          </p>

          <div className="mt-2" style={{ borderTop: "1px solid rgba(255,180,0,0.25)", paddingTop: 6 }}>
            <p className="text-[8px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>
              {type === "student" ? "Student ID" : "Employee ID"}
            </p>
            <p className="font-mono font-bold text-white text-xs">{idNumber}</p>
            <span className="inline-block mt-1.5 text-[8px] font-bold px-2 py-0.5 rounded"
              style={{ background: "rgba(255,160,0,0.15)", border: "1px solid rgba(255,180,0,0.4)", color: "rgba(255,200,0,0.85)" }}>
              {type === "student" ? "STUDENT" : "FACULTY MEMBER"}
            </span>
          </div>
        </div>

        {/* QR */}
        {qrBase64 && (
          <div className="shrink-0 flex flex-col items-center gap-1">
            <div className="rounded-xl p-1.5 bg-white shadow-lg" style={{ width: 88, height: 88 }}>
              <img src={`data:image/png;base64,${qrBase64}`} alt="QR" className="w-full h-full" />
            </div>
            <p className="text-[7.5px]" style={{ color: "rgba(255,255,255,0.25)" }}>Scan to verify</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2" style={{
        background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.4))",
        borderTop: "1px solid rgba(255,180,0,0.12)"
      }}>
        <p className="text-[7.5px]" style={{ color: "rgba(255,255,255,0.18)" }}>
          URS Property — Return to Registrar if found · URS Faculty Consultation System
        </p>
      </div>
    </div>
  );
}
