import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, GraduationCap, ArrowRight, Check, Delete } from "lucide-react";
import { Toast, useToastState, Spinner } from "./SharedUI.jsx";
import QRDisplay from "./QRDisplay.jsx";
import URSBackground from "./URSBackground.jsx";
import { API_BASE, DEPARTMENTS, YEAR_LEVELS } from "./constants.js";
import ursLogo from "./URS_LOGO.png";

export default function StudentRegister() {
  const { toasts, addToast, removeToast } = useToastState();
  const [form, setForm] = useState({
    student_id: "", full_name: "", course: "", year_level: "", department: DEPARTMENTS[0]
  });
  const [loading, setLoading]       = useState(false);
  const [qrData, setQrData]         = useState(null);
  const [step, setStep]             = useState(1);
  const [pin, setPin]               = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleNext = () => {
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
    } catch (e) {
      addToast(e.response?.data?.error || "Registration failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full border border-white/20 bg-white/15 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/50 focus:bg-white/20 transition-all";

  return (
    <URSBackground>
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/15 shadow-lg">
        <div className="flex items-center px-4 sm:px-8 py-4 gap-3">
          <Link to="/student" className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition-colors">
            <ArrowLeft size={15} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-md overflow-hidden shrink-0">
              <img src={ursLogo} alt="URS" className="w-full h-full object-contain p-0.5"
                onError={e => { e.target.style.display = "none"; }} />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">University of Rizal System</p>
              <p className="text-white/40 text-xs">Student Registration</p>
            </div>
          </div>
          {!qrData && (
            <div className="ml-auto flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${step >= 1 ? "bg-[#ffa000] text-white" : "bg-white/20 text-white/50"}`}>1</span>
              <div className={`w-6 h-0.5 rounded-full transition-all ${step >= 2 ? "bg-[#ffa000]" : "bg-white/20"}`} />
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${step >= 2 ? "bg-[#ffa000] text-white" : "bg-white/20 text-white/50"}`}>2</span>
            </div>
          )}
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8">
        <div className="w-full max-w-md mx-auto">

          {/* SUCCESS */}
          {qrData ? (
            <div>
              <div className="mb-6">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                  <Check size={22} className="text-white" />
                </div>
                <h2 className="font-bold text-3xl text-white mb-1">You're registered!</h2>
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

          /* STEP 1 */
          ) : step === 1 ? (
            <div>
              <div className="mb-6">
                <div className="w-14 h-14 bg-white/15 border border-white/25 rounded-3xl flex items-center justify-center mb-4 shadow-xl">
                  <GraduationCap size={26} className="text-white" />
                </div>
                <h2 className="font-bold text-3xl text-white mb-1">Create Account</h2>
                <p className="text-white/50 text-sm">Fill in your details to get started</p>
              </div>
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 block">Full Name *</label>
                  <input type="text" className={inputCls} placeholder="Juan Dela Cruz"
                    value={form.full_name} onChange={e => set("full_name", e.target.value)} autoComplete="name" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 block">Student ID *</label>
                    <input type="text" className={inputCls + " font-mono"} placeholder="2024-01234"
                      value={form.student_id} onChange={e => set("student_id", e.target.value)} maxLength={20} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 block">Year Level *</label>
                    <select className={inputCls} value={form.year_level} onChange={e => set("year_level", e.target.value)}>
                      <option value="" className="text-gray-800">Select Year</option>
                      {YEAR_LEVELS.map(y => <option key={y} className="text-gray-800">{y}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 block">Course / Program *</label>
                  <input type="text" className={inputCls} placeholder="BS Computer Engineering"
                    value={form.course} onChange={e => set("course", e.target.value)} maxLength={100} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 block">Department *</label>
                  <select className={inputCls} value={form.department} onChange={e => set("department", e.target.value)}>
                    {DEPARTMENTS.map(d => <option key={d} className="text-gray-800">{d}</option>)}
                  </select>
                </div>
                <button onClick={handleNext}
                  className="w-full flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080]
                             text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg active:scale-[0.98]">
                  <ArrowRight size={16} /> Next — Set PIN
                </button>
                <p className="text-center text-sm text-white/40">
                  Already registered?{" "}
                  <Link to="/student" className="text-white/70 hover:text-white underline font-semibold">Log in here</Link>
                </p>
              </div>
            </div>

          /* STEP 2 */
          ) : (
            <div>
              <div className="mb-6">
                <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm mb-4 transition-colors">
                  <ArrowLeft size={14} /> Back
                </button>
                <div className="w-14 h-14 bg-white/15 border border-white/25 rounded-3xl flex items-center justify-center mb-4 shadow-xl">
                  <GraduationCap size={26} className="text-white" />
                </div>
                <h2 className="font-bold text-3xl text-white mb-1">Set Your PIN</h2>
                <p className="text-white/50 text-sm">Choose a 4-digit PIN to secure your account</p>
              </div>
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-5 space-y-5">
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
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-3 block">Confirm PIN</label>
                  <div className="flex gap-3 justify-center">
                    {[0,1,2,3].map(i => (
                      <div key={i} className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl font-bold text-white
                        ${pinConfirm.length > 0 && pin !== pinConfirm.slice(0,pin.length) && i < pinConfirm.length
                          ? "bg-red-500/20 border-red-400/50" : "bg-white/15 border-white/25"}`}>
                        {pinConfirm[i] ? "●" : ""}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[1,2,3,4,5,6,7,8,9].map(n => (
                    <button key={n} onPointerDown={e => { e.preventDefault();
                      if (pin.length < 4) setPin(p => p + n);
                      else if (pinConfirm.length < 4) setPinConfirm(p => p + n);
                    }}
                      className="h-14 rounded-2xl bg-white/15 border border-white/20 text-white text-xl font-bold active:bg-white/30 transition-colors">
                      {n}
                    </button>
                  ))}
                  <button onPointerDown={e => { e.preventDefault();
                    if (pinConfirm.length > 0) setPinConfirm(p => p.slice(0,-1));
                    else if (pin.length > 0) { setPin(p => p.slice(0,-1)); setPinConfirm(""); }
                  }}
                    className="h-14 rounded-2xl bg-white/10 border border-white/15 text-white text-xl active:bg-white/20 transition-colors flex items-center justify-center">
                    <Delete size={20} />
                  </button>
                  <button onPointerDown={e => { e.preventDefault();
                    if (pin.length < 4) setPin(p => p + "0");
                    else if (pinConfirm.length < 4) setPinConfirm(p => p + "0");
                  }}
                    className="h-14 rounded-2xl bg-white/15 border border-white/20 text-white text-xl font-bold active:bg-white/30 transition-colors">
                    0
                  </button>
                  <button onPointerDown={e => { e.preventDefault(); setPin(""); setPinConfirm(""); }}
                    className="h-14 rounded-2xl bg-white/10 border border-white/15 text-white/50 text-xs active:bg-white/20 transition-colors">
                    CLR
                  </button>
                </div>
                <button onClick={handleSubmit} disabled={loading || pin.length < 4 || pinConfirm.length < 4}
                  className="w-full flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080]
                             text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg disabled:opacity-40 active:scale-[0.98]">
                  {loading ? <Spinner size={4} light /> : <Check size={16} />}
                  {loading ? "Registering..." : "Complete Registration"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </URSBackground>
  );
}