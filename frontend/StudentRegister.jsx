import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, GraduationCap, ArrowRight, Check, Delete } from "lucide-react";
import { Toast, useToastState, Spinner } from "../components/SharedUI.jsx";
import QRDisplay from "../components/QRDisplay.jsx";
import URSBackground from "../components/URSBackground.jsx";
import { API_BASE, DEPARTMENTS, YEAR_LEVELS } from "../constants.js";
import ursLogo from "../URS_LOGO.png";

// ── Keyboard rows ─────────────────────────────────────────────────────────────
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

// Fixed-bottom floating keyboard — same as StudentPortal
function FloatingKeyboard({ value = "", onChange, onDone, maxLength = 100, defaultNum = false }) {
  const [caps, setCaps]       = useState(!defaultNum);
  const [shift, setShift]     = useState(false);
  const [numMode, setNumMode] = useState(defaultNum);
  const bspRef = useRef(null);

  const lr1 = (caps || shift) ? L_ROW1.map(k => k.toUpperCase()) : L_ROW1;
  const lr2 = (caps || shift) ? L_ROW2.map(k => k.toUpperCase()) : L_ROW2;
  const lr3 = (caps || shift) ? L_ROW3.map(k => k.toUpperCase()) : L_ROW3;

  const tap = useCallback((char) => {
    if (value.length >= maxLength) return;
    onChange(value + char);
    if (shift) { setShift(false); setCaps(false); }
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
            <div className="flex gap-[6px]">{N_ROW1.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}</div>
            <div className="flex gap-[6px]">{N_ROW2.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}</div>
            <div className="flex gap-[6px]">
              <KbKey label="#+=" dark narrow onPress={() => {}} />
              <div className="flex flex-1 gap-[6px]">{N_ROW3.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}</div>
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
            <div className="flex gap-[6px]">{lr1.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}</div>
            <div className="flex gap-[6px] px-[3.8%]">{lr2.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}</div>
            <div className="flex gap-[6px]">
              <KbKey label={caps ? "⇪" : "⇧"} dark={!caps && !shift} accent={caps || shift} narrow
                onPress={() => {
                  if (caps)       { setCaps(false); setShift(false); }
                  else if (shift) { setCaps(true);  setShift(false); }
                  else            { setShift(true); }
                }} />
              <div className="flex flex-1 gap-[6px]">{lr3.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}</div>
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function StudentRegister() {
  const { toasts, addToast, removeToast } = useToastState();
  const [form, setForm] = useState({
    student_id: "", full_name: "", course: "", year_level: "", department: DEPARTMENTS[0]
  });
  const [loading, setLoading]         = useState(false);
  const [qrData, setQrData]           = useState(null);
  const [activeField, setActiveField] = useState(null);
  const [step, setStep]               = useState(1);
  const [pin, setPin]                 = useState("");
  const [pinConfirm, setPinConfirm]   = useState("");
  const fieldRefs = useRef({});

  const tapField = (key) => {
    setActiveField(key);
    setTimeout(() => {
      fieldRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const FIELDS = [
    { key: "full_name",  label: "Full Name",        placeholder: "Juan Dela Cruz",          maxLength: 80,  defaultNum: false },
    { key: "student_id", label: "Student ID",        placeholder: "2024-01234",              maxLength: 20,  defaultNum: true  },
    { key: "course",     label: "Course / Program",  placeholder: "BS Computer Engineering", maxLength: 100, defaultNum: false },
  ];

  const activeCfg = FIELDS.find(f => f.key === activeField);

  const handleNext = () => {
    setActiveField(null);
    if (!form.student_id.trim() || !form.full_name.trim() || !form.course.trim() || !form.year_level)
      return addToast("Please fill in all required fields.", "warning");
    setStep(2);
  };

  const handleSubmit = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin))
      return addToast("PIN must be exactly 4 digits.", "warning");
    if (pin !== pinConfirm)
      return addToast("PINs do not match. Please try again.", "warning");
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/student/register`, { ...form, pin });
      setQrData(res.data);
    } catch (e) { addToast(e.response?.data?.error || "Registration failed.", "error"); }
    finally { setLoading(false); }
  };

  const kbOpen = !!activeField;

  return (
    <URSBackground>
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/15 shadow-lg">
        <div className="flex items-center px-6 sm:px-10 py-4">
          <Link to="/student" className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors mr-4">
            <ArrowLeft size={15} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-md overflow-hidden">
              <img src={ursLogo} alt="URS" className="w-full h-full object-contain p-0.5"
                onError={e => { e.target.style.display = "none"; }} />
            </div>
            <div>
              <p className="text-white font-display font-bold text-sm leading-tight">University of Rizal System</p>
              <p className="text-white/40 text-xs">Student Registration</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Page body — shifts up when keyboard open */}
      <div
        className="flex-1 flex items-start justify-center px-5 sm:px-8 py-8 overflow-y-auto transition-all duration-300"
        style={{ paddingBottom: kbOpen ? "340px" : "40px" }}>
        <div className="w-full max-w-md">

          {!qrData ? (
            step === 1 ? (
            <div className="animate-slide-up">
              <div className="mb-6">
                <div className="w-14 h-14 bg-white/15 backdrop-blur-sm border border-white/25 rounded-3xl
                               flex items-center justify-center mb-4 shadow-xl">
                  <GraduationCap size={26} className="text-white" />
                </div>
                <h2 className="font-display font-bold text-3xl text-white mb-1">Create Account</h2>
                <p className="text-white/50 text-sm">Fill in your details to get started</p>
              </div>

              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-6 space-y-4">

                {/* Full Name */}
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 block">Full Name *</label>
                  <div ref={el => { fieldRefs.current["full_name"] = el; }} onClick={() => tapField("full_name")}
                    className={`w-full rounded-2xl px-4 py-3 text-sm cursor-pointer transition-all flex items-center justify-between min-h-[46px]
                      ${activeField === "full_name"
                        ? "bg-white/25 border-2 border-white ring-2 ring-white/20"
                        : "bg-white/15 border border-white/25 hover:bg-white/20"}`}>
                    <span className={form.full_name ? "text-white" : "text-white/40"}>
                      {form.full_name || "Juan Dela Cruz"}
                      {activeField === "full_name" && <span className="inline-block w-0.5 h-4 bg-[#ffa000] ml-0.5 align-middle animate-pulse" />}
                    </span>
                    {form.full_name && activeField === "full_name" && (
                      <button onPointerDown={e => { e.preventDefault(); e.stopPropagation(); set("full_name",""); }}
                        className="text-white/40 hover:text-white text-xs ml-2 shrink-0">✕</button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Student ID */}
                  <div>
                    <label className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 block">Student ID *</label>
                    <div ref={el => { fieldRefs.current["student_id"] = el; }} onClick={() => tapField("student_id")}
                      className={`w-full rounded-2xl px-4 py-3 text-sm cursor-pointer transition-all flex items-center justify-between min-h-[46px]
                        ${activeField === "student_id"
                          ? "bg-white/25 border-2 border-white ring-2 ring-white/20"
                          : "bg-white/15 border border-white/25 hover:bg-white/20"}`}>
                      <span className={form.student_id ? "text-white font-mono" : "text-white/40"}>
                        {form.student_id || "2024-01234"}
                        {activeField === "student_id" && <span className="inline-block w-0.5 h-4 bg-[#ffa000] ml-0.5 align-middle animate-pulse" />}
                      </span>
                      {form.student_id && activeField === "student_id" && (
                        <button onPointerDown={e => { e.preventDefault(); e.stopPropagation(); set("student_id",""); }}
                          className="text-white/40 hover:text-white text-xs ml-1 shrink-0">✕</button>
                      )}
                    </div>
                  </div>

                  {/* Year Level */}
                  <div>
                    <label className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 block">Year Level *</label>
                    <select
                      className="w-full bg-white/15 border border-white/25 text-white rounded-2xl px-4 py-3 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
                      value={form.year_level}
                      onChange={e => { set("year_level", e.target.value); setActiveField(null); }}>
                      <option value="" className="text-gray-800">Select Year</option>
                      {YEAR_LEVELS.map(y => <option key={y} className="text-gray-800">{y}</option>)}
                    </select>
                  </div>
                </div>

                {/* Course */}
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 block">Course / Program *</label>
                  <div ref={el => { fieldRefs.current["course"] = el; }} onClick={() => tapField("course")}
                    className={`w-full rounded-2xl px-4 py-3 text-sm cursor-pointer transition-all flex items-center justify-between min-h-[46px]
                      ${activeField === "course"
                        ? "bg-white/25 border-2 border-white ring-2 ring-white/20"
                        : "bg-white/15 border border-white/25 hover:bg-white/20"}`}>
                    <span className={form.course ? "text-white" : "text-white/40"}>
                      {form.course || "BS Computer Engineering"}
                      {activeField === "course" && <span className="inline-block w-0.5 h-4 bg-[#ffa000] ml-0.5 align-middle animate-pulse" />}
                    </span>
                    {form.course && activeField === "course" && (
                      <button onPointerDown={e => { e.preventDefault(); e.stopPropagation(); set("course",""); }}
                        className="text-white/40 hover:text-white text-xs ml-2 shrink-0">✕</button>
                    )}
                  </div>
                </div>

                {/* Department */}
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 block">Department *</label>
                  <select
                    className="w-full bg-white/15 border border-white/25 text-white rounded-2xl px-4 py-3 text-sm
                               focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
                    value={form.department}
                    onChange={e => { set("department", e.target.value); setActiveField(null); }}>
                    {DEPARTMENTS.map(d => <option key={d} className="text-gray-800">{d}</option>)}
                  </select>
                </div>

                <button onClick={handleNext} disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080]
                             text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg
                             disabled:opacity-60 active:scale-[0.98]">
                  <ArrowRight size={16} />
                  Next — Set PIN
                </button>

                <p className="text-center text-sm text-white/40">
                  Already registered?{" "}
                  <Link to="/student" className="text-white/70 hover:text-white underline font-semibold">Log in here</Link>
                </p>
              </div>
            </div>
          ) : (
            /* ── Step 2: Set PIN ── */
            <div className="animate-slide-up">
              <div className="mb-6">
                <button onClick={() => setStep(1)} className="flex items-center gap-1 text-white/50 hover:text-white text-sm mb-4">
                  <ArrowLeft size={14} /> Back
                </button>
                <div className="w-14 h-14 bg-white/15 backdrop-blur-sm border border-white/25 rounded-3xl
                               flex items-center justify-center mb-4 shadow-xl">
                  <GraduationCap size={26} className="text-white" />
                </div>
                <h2 className="font-display font-bold text-3xl text-white mb-1">Set Your PIN</h2>
                <p className="text-white/50 text-sm">Choose a 4-digit PIN to secure your account</p>
              </div>
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-6 space-y-5">

                {/* PIN */}
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-3 block">Enter PIN</label>
                  <div className="flex gap-3 justify-center">
                    {[0,1,2,3].map(i => (
                      <div key={i} className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-2xl font-bold text-white">
                        {pin[i] ? "●" : ""}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Confirm PIN */}
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-3 block">Confirm PIN</label>
                  <div className="flex gap-3 justify-center">
                    {[0,1,2,3].map(i => (
                      <div key={i} className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl font-bold text-white
                        ${pinConfirm.length > 0 && pin.slice(0, pinConfirm.length) !== pinConfirm.slice(0, pin.length)
                          ? "bg-red-500/20 border-red-400/50"
                          : "bg-white/15 border-white/25"}`}>
                        {pinConfirm[i] ? "●" : ""}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Number pad */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                  {[1,2,3,4,5,6,7,8,9].map(n => (
                    <button key={n} onPointerDown={e => { e.preventDefault();
                      if (pin.length < 4) setPin(p => p + n);
                      else if (pinConfirm.length < 4) setPinConfirm(p => p + n);
                    }}
                      className="h-14 rounded-2xl bg-white/15 border border-white/20 text-white text-xl font-bold
                                 active:bg-white/30 transition-colors">
                      {n}
                    </button>
                  ))}
                  <button onPointerDown={e => { e.preventDefault();
                    if (pinConfirm.length > 0) setPinConfirm(p => p.slice(0,-1));
                    else if (pin.length > 0) { setPin(p => p.slice(0,-1)); setPinConfirm(""); }
                  }}
                    className="h-14 rounded-2xl bg-white/10 border border-white/15 text-white text-xl
                               active:bg-white/20 transition-colors flex items-center justify-center">
                    <Delete size={20} />
                  </button>
                  <button onPointerDown={e => { e.preventDefault();
                    if (pin.length < 4) setPin(p => p + "0");
                    else if (pinConfirm.length < 4) setPinConfirm(p => p + "0");
                  }}
                    className="h-14 rounded-2xl bg-white/15 border border-white/20 text-white text-xl font-bold
                               active:bg-white/30 transition-colors">
                    0
                  </button>
                  <button onPointerDown={e => { e.preventDefault(); setPin(""); setPinConfirm(""); }}
                    className="h-14 rounded-2xl bg-white/10 border border-white/15 text-white/50 text-xs
                               active:bg-white/20 transition-colors">
                    CLR
                  </button>
                </div>

                <button onClick={handleSubmit} disabled={loading || pin.length < 4 || pinConfirm.length < 4}
                  className="w-full flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080]
                             text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg
                             disabled:opacity-40 active:scale-[0.98]">
                  {loading ? <Spinner size={4} light /> : <Check size={16} />}
                  {loading ? "Registering..." : "Complete Registration"}
                </button>
              </div>
            </div>
          )) : (
            <div className="animate-bounce-in">
              <div className="mb-6">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                  <Check size={22} className="text-white" />
                </div>
                <h2 className="font-display font-bold text-3xl text-white mb-1">You're registered!</h2>
                <p className="text-white/60">Welcome, {qrData.full_name}. Save your QR code below.</p>
              </div>
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-6">
                <QRDisplay base64={qrData.qr_base64} label={`Student ID: ${qrData.student_id}`} filename={`${qrData.student_id}-qr.png`} />
                <Link to="/student"
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080]
                             text-white font-semibold py-3 rounded-2xl transition-all text-sm">
                  Go to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dim backdrop — tap to dismiss keyboard */}
      {kbOpen && (
        <div className="fixed inset-0 z-[99] bg-black/10" onClick={() => setActiveField(null)} />
      )}

      {/* Floating keyboard — slides up from bottom */}
      {kbOpen && activeCfg && (
        <FloatingKeyboard
          key={activeField}
          value={form[activeField]}
          onChange={v => set(activeField, v.slice(0, activeCfg.maxLength))}
          onDone={() => setActiveField(null)}
          maxLength={activeCfg.maxLength}
          defaultNum={activeCfg.defaultNum}
        />
      )}
    </URSBackground>
  );
}