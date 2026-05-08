import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { GraduationCap, QrCode, Hash, ArrowRight, UserPlus, Delete, ChevronLeft, Lock, ShieldCheck } from "lucide-react";
import QRScanner from "../components/QRScanner.jsx";
import { Toast, useToastState, Spinner } from "../components/SharedUI.jsx";
import URSBackground from "../components/URSBackground.jsx";
import { API_BASE } from "../constants.js";
import ursLogo from "../URS_LOGO.png";

/* ── Shared styles ─────────────────────────────────────────────────── */
const PIN_STYLES = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    20%{transform:translateX(-8px)} 40%{transform:translateX(8px)}
    60%{transform:translateX(-6px)} 80%{transform:translateX(6px)}
  }
  .pin-shake { animation: shake 0.5s ease; }
  @keyframes popIn { from{transform:scale(0.5);opacity:0} to{transform:scale(1);opacity:1} }
  .pin-dot-filled { animation: popIn 0.15s ease; }
`;

/* ── Reusable PIN dots display ─────────────────────────────────────── */
function PinDots({ count, shake }) {
  return (
    <div className={`flex justify-center gap-4 mb-5 ${shake ? "pin-shake" : ""}`}>
      {[0,1,2,3].map(i => (
        <div key={i} className={`w-5 h-5 rounded-full border-2 transition-all duration-200
          ${i < count ? "bg-[#ffa000] border-[#ffa000] pin-dot-filled scale-110" : "bg-transparent border-white/40"}`} />
      ))}
    </div>
  );
}

/* ── Reusable Number Pad ───────────────────────────────────────────── */
function NumPad({ onKey, onDelete, onSubmit, disabled }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-3">
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => onKey(String(n))} disabled={disabled}
            className="h-14 bg-white/15 hover:bg-white/25 active:scale-95 active:bg-white/30
                       text-white font-bold text-xl rounded-2xl transition-all border border-white/10
                       hover:border-white/30 shadow disabled:opacity-40">
            {n}
          </button>
        ))}
        <div />
        <button onClick={() => onKey("0")} disabled={disabled}
          className="h-14 bg-white/15 hover:bg-white/25 active:scale-95
                     text-white font-bold text-xl rounded-2xl transition-all border border-white/10
                     hover:border-white/30 shadow disabled:opacity-40">
          0
        </button>
        <button onClick={onDelete} disabled={disabled}
          className="h-14 bg-white/10 hover:bg-red-500/30 active:scale-95
                     text-white/60 hover:text-white rounded-2xl transition-all border border-white/10
                     flex items-center justify-center disabled:opacity-40">
          <Delete size={20} />
        </button>
      </div>
    </>
  );
}

/* ── PIN Entry (for students who already have a PIN) ───────────────── */
function PinEnter({ studentName, onSuccess, onBack, loading, error }) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (error) {
      setShake(true);
      setPin("");
      const t = setTimeout(() => setShake(false), 600);
      return () => clearTimeout(t);
    }
  }, [error]);

  return (
    <div className="animate-slide-up">
      <style>{PIN_STYLES}</style>
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-6">
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-[#003366] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <GraduationCap size={26} className="text-white" />
          </div>
          <p className="text-white font-display font-bold text-lg">Welcome back!</p>
          <p className="text-white/60 text-sm mt-0.5">{studentName}</p>
          <p className="text-white/40 text-xs mt-1">Enter your 4-digit PIN</p>
        </div>

        <PinDots count={pin.length} shake={shake} />
        {error && <p className="text-red-400 text-xs text-center mb-4 font-semibold">{error}</p>}

        <NumPad
          onKey={d => { if (pin.length < 4) setPin(p => p + d); }}
          onDelete={() => setPin(p => p.slice(0, -1))}
          disabled={loading}
        />

        <button onClick={() => pin.length === 4 && onSuccess(pin)}
          disabled={pin.length < 4 || loading}
          className="w-full flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080]
                     text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg
                     disabled:opacity-40 active:scale-[0.98]">
          {loading ? <Spinner size={4} light /> : <ArrowRight size={16} />}
          {loading ? "Verifying..." : "Confirm PIN"}
        </button>

        <button onClick={onBack}
          className="w-full mt-3 flex items-center justify-center gap-1.5
                     text-white/40 hover:text-white text-sm py-2 transition-colors">
          <ChevronLeft size={14} /> Use a different account
        </button>
      </div>
    </div>
  );
}

/* ── Set PIN First (for existing students with no PIN) ─────────────── */
function SetPinFirst({ studentName, studentId, onDone, onBack }) {
  const [step, setStep]   = useState("set");
  const [pin, setPin]     = useState("");
  const [first, setFirst] = useState("");
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToastState?.() || { addToast: () => {} };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleNext = async () => {
    if (pin.length < 4) return;
    if (step === "set") {
      setFirst(pin); setPin(""); setStep("confirm"); setError(null);
      return;
    }
    if (pin !== first) {
      setError("PINs do not match. Try again.");
      setPin(""); triggerShake(); return;
    }
    setSaving(true);
    try {
      await axios.post(`${API_BASE}/student/set-pin`, { student_id: studentId, pin });
      const res = await axios.post(`${API_BASE}/auth/student/login`, { student_id: studentId, pin });
      onDone(res.data.student);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to set PIN. Try again.");
      setPin(""); triggerShake();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-slide-up">
      <style>{PIN_STYLES}</style>
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-6">
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-[#ffa000] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Lock size={24} className="text-white" />
          </div>
          <p className="text-white font-display font-bold text-lg">
            {step === "set" ? "Create Your PIN" : "Confirm PIN"}
          </p>
          <p className="text-white/60 text-sm mt-0.5">{studentName}</p>
          <p className="text-white/40 text-xs mt-1">
            {step === "set"
              ? "You don't have a PIN yet — set one now to secure your account"
              : "Re-enter your PIN to confirm"}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 mb-5">
          <div className="w-2 h-2 rounded-full bg-[#ffa000]" />
          <div className={`w-2 h-2 rounded-full transition-colors ${step === "confirm" ? "bg-[#ffa000]" : "bg-white/20"}`} />
          <p className="text-white/30 text-[10px] ml-1">{step === "set" ? "Step 1 of 2" : "Step 2 of 2"}</p>
        </div>
        <PinDots count={pin.length} shake={shake} />
        {error && <p className="text-red-400 text-xs text-center mb-4 font-semibold">{error}</p>}
        <NumPad
          onKey={d => { if (pin.length < 4) setPin(p => p + d); }}
          onDelete={() => setPin(p => p.slice(0, -1))}
          disabled={saving}
        />
        <button onClick={handleNext} disabled={pin.length < 4 || saving}
          className="w-full flex items-center justify-center gap-2 bg-[#ffa000] hover:bg-[#e69000]
                     text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg
                     disabled:opacity-40 active:scale-[0.98]">
          {saving ? <Spinner size={4} light /> : step === "set" ? <ArrowRight size={16} /> : <ShieldCheck size={16} />}
          {saving ? "Setting PIN..." : step === "set" ? "Next — Confirm PIN" : "Set PIN & Log In"}
        </button>
        {step === "confirm" && (
          <button onClick={() => { setStep("set"); setPin(""); setFirst(""); setError(null); }}
            className="w-full mt-2 text-white/40 hover:text-white text-xs py-2 transition-colors text-center">
            ← Change PIN
          </button>
        )}
        <button onClick={onBack}
          className="w-full mt-2 flex items-center justify-center gap-1.5
                     text-white/30 hover:text-white text-xs py-2 transition-colors">
          <ChevronLeft size={13} /> Use a different account
        </button>
      </div>
    </div>
  );
}

/* ── Keyboard layout defs ──────────────────────────────────────────── */
const L_ROW1 = ["q","w","e","r","t","y","u","i","o","p"];
const L_ROW2 = ["a","s","d","f","g","h","j","k","l"];
const L_ROW3 = ["z","x","c","v","b","n","m"];
const N_ROW1 = ["1","2","3","4","5","6","7","8","9","0"];
const N_ROW2 = ["-","/",":",";","(",")","%","@",'"',"'"];
const N_ROW3 = [".",",","?","!","#","&","_"];

function KbKey({ label, icon, onPress, accent, danger, dark, narrow, cls = "" }) {
  const base =
    "flex items-center justify-center select-none rounded-[12px] border-b-[4px] " +
    "text-[17px] font-bold cursor-pointer touch-none active:border-b-0 active:translate-y-[4px] " +
    "transition-transform duration-75 h-[58px] ";
  const color = accent ? "bg-[#003366] border-[#001f44] text-white "
    : danger  ? "bg-[#c0392b] border-[#922b21] text-white "
    : dark    ? "bg-[#151f2e] border-[#0a1018] text-white/50 "
    :           "bg-[#2c3e52] border-[#1a2535] text-white ";
  const width = narrow ? "w-[46px] shrink-0 " : "flex-1 ";
  return (
    <button onPointerDown={e => { e.preventDefault(); onPress(); }}
      className={base + color + width + cls}>
      {icon || label}
    </button>
  );
}

function FloatingKeyboard({ value = "", onChange, onDone, maxLength = 40 }) {
  const [caps, setCaps]       = useState(false);
  const [shift, setShift]     = useState(false);
  const [numMode, setNumMode] = useState(false); // default letters — numbers via 123 toggle
  const bspRef = useRef(null);

  const lr1 = (caps || shift) ? L_ROW1.map(k => k.toUpperCase()) : L_ROW1;
  const lr2 = (caps || shift) ? L_ROW2.map(k => k.toUpperCase()) : L_ROW2;
  const lr3 = (caps || shift) ? L_ROW3.map(k => k.toUpperCase()) : L_ROW3;

  const tap = useCallback((char) => {
    if (value.length >= maxLength) return;
    onChange(value + char);
    if (shift) setShift(false);
  }, [value, onChange, shift, maxLength]);

  const backspace = useCallback(() => { onChange(value.slice(0, -1)); }, [value, onChange]);
  useEffect(() => () => clearInterval(bspRef.current), []);

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] select-none"
      style={{
        background: "linear-gradient(160deg,#10192a 0%,#0d1520 100%)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        animation: "kbUp 0.2s cubic-bezier(0.22,1,0.36,1) both",
      }}>
      <style>{`@keyframes kbUp{from{transform:translateY(100%);opacity:0}to{transform:none;opacity:1}}`}</style>
      <div className="px-3 pt-3 pb-3 flex flex-col gap-[8px]">
        {numMode ? (
          <>
            <div className="flex gap-[6px]">
              {N_ROW1.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}
            </div>
            <div className="flex gap-[6px]">
              {N_ROW2.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}
            </div>
            <div className="flex gap-[6px]">
              <KbKey label="#+=" dark narrow onPress={() => {}} />
              <div className="flex flex-1 gap-[6px]">
                {N_ROW3.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}
              </div>
              <KbKey icon={<Delete size={17} />} danger narrow onPress={backspace} />
            </div>
            <div className="flex gap-[6px]">
              <KbKey label="ABC" dark narrow onPress={() => setNumMode(false)} />
              <KbKey label="space" dark onPress={() => tap(" ")} />
              <KbKey label="." dark narrow onPress={() => tap(".")} />
              <KbKey label="Done ✓" accent narrow onPress={() => onDone?.()} cls="!w-[72px]" />
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-[6px]">
              {lr1.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}
            </div>
            <div className="flex gap-[6px] px-[3.8%]">
              {lr2.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}
            </div>
            <div className="flex gap-[6px]">
              <KbKey
                label={caps ? "⇪" : "⇧"}
                dark={!caps && !shift} accent={caps || shift}
                narrow
                onPress={() => {
                  if (caps)       { setCaps(false); setShift(false); }
                  else if (shift) { setCaps(true);  setShift(false); }
                  else            { setShift(true); }
                }}
              />
              <div className="flex flex-1 gap-[6px]">
                {lr3.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}
              </div>
              <KbKey icon={<Delete size={17} />} danger narrow onPress={backspace} />
            </div>
            <div className="flex gap-[6px]">
              <KbKey label="123" dark narrow onPress={() => setNumMode(true)} />
              <KbKey label="space" dark onPress={() => tap(" ")} />
              <KbKey label="." dark narrow onPress={() => tap(".")} />
              <KbKey label="Done ✓" accent narrow onPress={() => onDone?.()} cls="!w-[72px]" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main Portal ───────────────────────────────────────────────────── */
export default function StudentPortal() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToastState();

  const [mode, setMode]             = useState(null);
  const [studentId, setStudentId]   = useState("");
  const [loading, setLoading]       = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError]     = useState(null);
  const [pendingStudent, setPendingStudent] = useState(null);
  const [kbOpen, setKbOpen]         = useState(false);

  const findStudent = async (id) => {
    const sid = (id || studentId).trim();
    if (!sid) return addToast("Please enter your Student ID.", "warning");
    setKbOpen(false);
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/student/find`, { student_id: sid });
      setPendingStudent(res.data);
      setPinError(null);
      setMode(res.data.has_pin ? "pin" : "setpin");
    } catch (e) {
      addToast(e.response?.data?.error || "Student not found. Please register first.", "error");
    } finally {
      setLoading(false);
    }
  };

  const verifyPin = async (pin) => {
    setPinLoading(true); setPinError(null);
    try {
      const res = await axios.post(`${API_BASE}/auth/student/login`, {
        student_id: pendingStudent.student_id, pin
      });
      doLogin(res.data.student);
    } catch (e) {
      setPinError(e.response?.data?.error || "Incorrect PIN. Try again.");
      setPinLoading(false);
    }
  };

  const doLogin = (student) => {
    sessionStorage.setItem("student", JSON.stringify(student));
    addToast("Welcome, " + student.full_name + "!", "success");
    setTimeout(() => navigate("/student/dashboard"), 500);
  };

  const resetToHome = () => {
    setMode(null); setStudentId(""); setPendingStudent(null);
    setPinError(null); setLoading(false); setPinLoading(false); setKbOpen(false);
  };

  return (
    <URSBackground>
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/15 shadow-lg">
        <div className="flex items-center px-6 sm:px-10 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-md overflow-hidden">
              <img src={ursLogo} alt="URS" className="w-full h-full object-contain p-0.5"
                onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="flex"; }} />
              <span className="text-[#003366] font-display font-black text-lg leading-none hidden items-center justify-center">U</span>
            </div>
            <div>
              <p className="text-white font-display font-bold text-sm leading-tight">University of Rizal System</p>
              <p className="text-white/40 text-xs">Student Portal — College of Engineering</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Page body — shifts up when keyboard open */}
      <div
        className="flex-1 flex items-center justify-center px-4 transition-all duration-300"
        style={{ paddingTop: "40px", paddingBottom: kbOpen ? "300px" : "40px" }}>
        <div className="w-full max-w-sm">

          {/* QR Scan */}
          {mode === "qr" && (
            <div className="animate-slide-up">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-[#003366] rounded-xl flex items-center justify-center">
                    <QrCode size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-xl text-white">Scan QR Code</h2>
                    <p className="text-white/50 text-xs">Hold your student QR code to the camera</p>
                  </div>
                </div>
                {loading
                  ? <div className="flex justify-center py-8"><Spinner size={10} light /></div>
                  : <QRScanner onScan={val => findStudent(val)} onError={msg => addToast(msg, "error")} />
                }
                <button onClick={resetToHome} className="w-full mt-4 text-white/40 hover:text-white text-sm py-2 transition-colors">
                  ← Back
                </button>
              </div>
            </div>
          )}

          {/* Manual ID — tap-target + floating keyboard */}
          {mode === "manual" && (
            <div className="animate-slide-up">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-[#003366] rounded-xl flex items-center justify-center">
                    <Hash size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-xl text-white">Enter Student ID</h2>
                    <p className="text-white/50 text-xs">Type your ID number to continue</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Tap-to-type field */}
                  <div
                    onClick={() => setKbOpen(true)}
                    className={`w-full rounded-2xl px-4 py-3.5 cursor-pointer transition-all
                      flex items-center gap-2 min-h-[52px]
                      ${kbOpen
                        ? "bg-white/25 border-2 border-white ring-2 ring-white/20"
                        : "bg-white/15 border border-white/25 hover:bg-white/20 hover:border-white/40"}`}>
                    <Hash size={15} className="text-white/50 shrink-0" />
                    <span className={`flex-1 font-mono tracking-wider text-sm
                      ${studentId ? "text-white" : "text-white/40"}`}>
                      {studentId || "M2022-0247"}
                      {kbOpen && (
                        <span className="inline-block w-0.5 h-4 bg-[#ffa000] ml-0.5 align-middle animate-pulse" />
                      )}
                    </span>
                    {studentId.length > 0 && (
                      <button
                        onPointerDown={e => { e.preventDefault(); setStudentId(""); }}
                        className="text-white/40 hover:text-white transition-colors shrink-0 text-xs">
                        ✕
                      </button>
                    )}
                  </div>

                  <button onClick={() => findStudent()} disabled={loading || !studentId.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080]
                               text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg
                               disabled:opacity-60 active:scale-[0.98]">
                    {loading ? <Spinner size={4} light /> : <ArrowRight size={16} />}
                    {loading ? "Finding account..." : "Continue"}
                  </button>
                </div>

                <button onClick={resetToHome} className="w-full mt-4 text-white/40 hover:text-white text-sm py-2 transition-colors">
                  ← Back
                </button>
                <p className="text-center text-sm text-white/40 mt-2">
                  Not registered?{" "}
                  <Link to="/student/register" className="text-white/70 hover:text-white underline">Create account</Link>
                </p>
              </div>
            </div>
          )}

          {/* PIN Entry */}
          {mode === "pin" && pendingStudent && (
            <PinEnter
              studentName={pendingStudent.full_name}
              onSuccess={verifyPin}
              onBack={resetToHome}
              loading={pinLoading}
              error={pinError}
            />
          )}

          {/* Set PIN First */}
          {mode === "setpin" && pendingStudent && (
            <SetPinFirst
              studentName={pendingStudent.full_name}
              studentId={pendingStudent.student_id}
              onDone={doLogin}
              onBack={resetToHome}
            />
          )}

          {/* Home */}
          {!mode && (
            <div className="animate-slide-up">
              <div className="text-center mb-7">
                <div className="w-16 h-16 bg-white/15 backdrop-blur-sm border border-white/25 rounded-3xl
                               flex items-center justify-center mx-auto mb-4 shadow-xl">
                  <GraduationCap size={30} className="text-white" />
                </div>
                <h1 className="font-display font-black text-3xl text-white mb-1">Student Login</h1>
                <p className="text-white/50 text-sm">Sign in to access faculty consultations</p>
              </div>
              <div className="space-y-3">
                <button onClick={() => setMode("qr")}
                  className="w-full flex items-center gap-4 p-5 bg-[#003366] hover:bg-[#004080]
                             text-white rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-[0.98] group">
                  <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <QrCode size={22} />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold">Scan QR Code</p>
                    <p className="text-white/50 text-xs mt-0.5">Use your saved student QR code</p>
                  </div>
                  <ArrowRight size={16} className="text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </button>

                <button onClick={() => setMode("manual")}
                  className="w-full flex items-center gap-4 p-5 bg-white/10 hover:bg-white/20
                             border border-white/20 hover:border-white/40 text-white rounded-2xl
                             transition-all active:scale-[0.98] group">
                  <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Hash size={20} />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold">Enter Student ID</p>
                    <p className="text-white/50 text-xs mt-0.5">Type your ID number manually</p>
                  </div>
                  <ArrowRight size={16} className="text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </button>

                <Link to="/student/register"
                  className="w-full flex items-center justify-between p-4 bg-white/8 hover:bg-white/15
                             border border-white/15 hover:border-white/30 rounded-2xl transition-all group">
                  <div>
                    <p className="text-white font-semibold text-sm">New student?</p>
                    <p className="text-white/40 text-xs">Create account & get your QR code</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white text-[#003366] text-xs font-bold px-3 py-1.5 rounded-xl group-hover:bg-blue-50 transition-colors">
                    <UserPlus size={13} /> Register
                  </div>
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Dim backdrop — tap to close keyboard */}
      {kbOpen && (
        <div className="fixed inset-0 z-[99] bg-black/10" onClick={() => setKbOpen(false)} />
      )}

      {/* Floating keyboard — only shown during manual ID entry */}
      {mode === "manual" && kbOpen && (
        <FloatingKeyboard
          value={studentId}
          onChange={v => setStudentId(v.slice(0, 40))}
          onDone={() => setKbOpen(false)}
          maxLength={40}
        />
      )}
    </URSBackground>
  );
}