import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, Eye, EyeOff, ArrowLeft, Lock, ArrowRight } from "lucide-react";
import { Toast, useToastState, Spinner } from "./SharedUI.jsx";
import FaceLoginPanel from "./FaceLoginPanel.jsx";

const DEAN_USER = "dean";
const DEAN_PASS = "dean2024";

export default function DeanLogin() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToastState();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [faceMode, setFaceMode] = useState(false);

  const handleLogin = () => {
    if (!username || !password) return addToast("Please fill in all fields.", "warning");
    setLoading(true);
    setTimeout(() => {
      if (username.trim() === DEAN_USER && password === DEAN_PASS) {
        sessionStorage.setItem("dean", JSON.stringify({ username: DEAN_USER, name: "Administrator" }));
        navigate("/dean/dashboard");
      } else {
        addToast("Invalid credentials.", "error");
        setLoading(false);
      }
    }, 700);
  };

  return (
    <div className="min-h-screen flex">
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Left — dark panel */}
      <div className="hidden lg:flex flex-col w-[420px] shrink-0 bg-hero-dean dot-pattern text-white p-10 relative overflow-hidden">
        <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-white/3" />
        <div className="absolute top-40 -left-10 w-40 h-40 rounded-full bg-white/3" />

        <Link to="/" className="flex items-center gap-2 text-white/40 hover:text-white text-sm transition-colors mb-auto">
          <ArrowLeft size={15} /> Back to Home
        </Link>

        <div className="mb-auto">
          <div className="w-16 h-16 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center mb-8 shadow-2xl animate-float">
            <Shield size={30} className="text-white" />
          </div>
          <h1 className="font-display font-black text-4xl leading-tight mb-4">
            Dean's<br />Office
          </h1>
          <p className="text-white/50 text-base leading-relaxed">
            Administrative portal for the College of Engineering. Full visibility into faculty and student consultation data.
          </p>
        </div>

        <div className="space-y-3 mt-10">
          {["View all faculty availability","Monitor consultation activity","Access student registry","Export reports & analytics"].map(f => (
            <div key={f} className="flex items-center gap-3 text-white/50 text-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-white/30 shrink-0" />
              {f}
            </div>
          ))}
        </div>
        <p className="text-white/15 text-xs mt-10">Restricted access — authorized personnel only</p>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 bg-hero dot-pattern">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-6">
            <Link to="/" className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm transition-colors">
              <ArrowLeft size={15} /> Back
            </Link>
          </div>

          <div className="mb-8 animate-slide-up">
            <div className="w-12 h-12 bg-[#1e293b] rounded-2xl flex items-center justify-center mb-5 shadow-lg">
              <Shield size={22} className="text-white" />
            </div>
            <h2 className="font-display font-bold text-3xl text-white mb-1">Administrative Login</h2>
            <p className="text-white/50">Access the Dean's dashboard and reports</p>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/30 p-6 animate-slide-up delay-100 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Username</label>
              <input className="input-field" placeholder="dean"
                value={username} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()} autoFocus />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Password</label>
              <div className="relative">
                <input className="input-field pr-11" type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button onClick={handleLogin} disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#1e293b] hover:bg-[#0f172a] text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-[0.97] disabled:opacity-50 mt-1">
              {loading ? <Spinner size={4} light /> : <Lock size={15} />}
              {loading ? "Verifying..." : "Sign In"}
              {!loading && <ArrowRight size={15} />}
            </button>

            <div className="border-t border-gray-100 pt-3">
              <button onClick={() => setFaceMode(v => !v)}
                className="w-full flex items-center justify-center gap-2 text-sm text-gray-500
                           hover:text-gray-800 transition-colors py-1">
                <span>👁</span>
                {faceMode ? "Use username + password instead" : "Or login with Face + Eye biometrics"}
              </button>
            </div>

            {faceMode && (
              <div className="border-t border-gray-100 pt-4">
                <FaceLoginPanel
                  onSuccess={(data) => {
                    if (data.type === "teacher" || data.recognized) {
                      sessionStorage.setItem("dean", JSON.stringify({ username: "dean", name: "Administrator" }));
                      navigate("/dean/dashboard");
                    } else {
                      addToast("Biometric matched but admin account not linked.", "error");
                    }
                  }}
                  onError={(msg) => addToast(msg, "error")}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}