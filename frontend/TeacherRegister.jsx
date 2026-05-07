import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, BookOpen, UserPlus, Eye, EyeOff } from "lucide-react";
import { Toast, useToastState, PageWrapper, Spinner } from "../components/SharedUI.jsx";
import QRDisplay from "../components/QRDisplay.jsx";
import { API_BASE, DEPARTMENTS, PROFESSOR_LIST } from "../constants.js";

export default function TeacherRegister() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToastState();
  const [form, setForm] = useState({
    employee_id: "", professor_name: "", department: DEPARTMENTS[0], password: "", confirmPassword: ""
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const profOptions = PROFESSOR_LIST[form.department] || [];

  const handleSubmit = async () => {
    if (!form.employee_id.trim() || !form.professor_name || !form.password) {
      return addToast("Please fill in all required fields.", "warning");
    }
    if (form.password !== form.confirmPassword) {
      return addToast("Passwords do not match.", "error");
    }
    if (form.password.length < 6) {
      return addToast("Password must be at least 6 characters.", "warning");
    }
    setLoading(true);
    try {
      const { confirmPassword, ...payload } = form;
      const res = await axios.post(`${API_BASE}/auth/teacher/register`, payload);
      setQrData(res.data);
      addToast("Registered successfully!", "success");
    } catch (e) {
      addToast(e.response?.data?.error || "Registration failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <Toast toasts={toasts} removeToast={removeToast} />
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md animate-slide-up">
          <Link to="/" className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to Home
          </Link>
          <div className="card">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-urs-orange rounded-xl flex items-center justify-center">
                <BookOpen size={20} className="text-white" />
              </div>
              <div>
                <h2 className="font-display font-bold text-xl text-urs-blue">Teacher Registration</h2>
                <p className="text-gray-500 text-xs">Create your account to manage consultations</p>
              </div>
            </div>

            {!qrData ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Department *</label>
                  <select className="input-field" value={form.department}
                    onChange={e => { set("department", e.target.value); set("professor_name", ""); }}>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Professor Name *</label>
                  <select className="input-field" value={form.professor_name} onChange={e => set("professor_name", e.target.value)}>
                    <option value="">Select your name</option>
                    {profOptions.map(p => <option key={p}>{p}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Must match the official faculty list exactly</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Employee ID *</label>
                  <input className="input-field" placeholder="e.g. EMP-2024-001"
                    value={form.employee_id} onChange={e => set("employee_id", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Password *</label>
                  <div className="relative">
                    <input className="input-field pr-10" type={showPass ? "text" : "password"}
                      placeholder="Min 6 characters" value={form.password} onChange={e => set("password", e.target.value)} />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Confirm Password *</label>
                  <input className="input-field" type="password" placeholder="Re-enter password"
                    value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} />
                </div>
                <button onClick={handleSubmit} disabled={loading}
                  className="w-full flex items-center justify-center gap-2 btn-orange mt-2 disabled:opacity-60">
                  {loading ? <Spinner size={5} /> : <UserPlus size={17} />}
                  {loading ? "Registering..." : "Register & Generate QR"}
                </button>
                <p className="text-center text-sm text-gray-500 mt-2">
                  Already registered?{" "}
                  <Link to="/teacher" className="text-urs-blue hover:underline font-semibold">Log in here</Link>
                </p>
              </div>
            ) : (
              <div className="space-y-4 animate-bounce-in">
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <p className="text-green-800 font-semibold text-sm">🎉 Registration Successful!</p>
                  <p className="text-green-700 text-xs mt-1">Welcome, <strong>{qrData.professor_name}</strong>!</p>
                </div>
                <QRDisplay
                  base64={qrData.qr_base64}
                  label={`Employee ID: ${qrData.employee_id}`}
                  filename={`teacher-qr-${qrData.employee_id}.png`}
                />
                <button
                  className="w-full btn-orange text-sm"
                  onClick={() => {
                    sessionStorage.setItem("teacher", JSON.stringify({
                      employee_id: qrData.employee_id,
                      professor_name: qrData.professor_name,
                      department: form.department
                    }));
                    navigate("/teacher/dashboard");
                  }}
                >
                  Go to Dashboard →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
