import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Delete, Download, ShieldCheck, GraduationCap } from "lucide-react";
import { Toast, useToastState, Button, Alert, ConfirmSplash } from "./SharedUI.jsx";
import URSBackground from "./URSBackground.jsx";
import SiteFooter from "./ui/SiteFooter.jsx";
import api, { apiError } from "./httpClient.js";
import { setSession } from "./auth.js";
import { DEPARTMENTS, YEAR_LEVELS } from "./constants.js";
import ursLogo from "./URS_LOGO.png";

export default function StudentRegister() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToastState();
  const [form, setForm] = useState({
    student_id: "", full_name: "", course: "", year_level: "", department: DEPARTMENTS[0],
  });
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [splash, setSplash] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const next = () => {
    if (!form.student_id.trim() || !form.full_name.trim() || !form.course.trim() || !form.year_level)
      return addToast("Fill in all fields to continue.", "warning");
    setStep(2);
  };

  const submit = async () => {
    if (!/^\d{4}$/.test(pin)) return addToast("Your PIN must be exactly 4 digits.", "warning");
    if (pin !== pinConfirm)   return addToast("The two PINs do not match.", "warning");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/student/register", { ...form, pin });
      // Registration signs you in — the server returns a session token with it.
      setSession("student", data.token, data.student);
      setSplash(true);
      setResult(data);
    } catch (e) {
      addToast(apiError(e, "Registration failed."), "error");
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${result.qr_base64}`;
    a.download = `urs-student-${result.student_id}.png`;
    a.click();
  };

  return (
    <URSBackground>
      <Toast toasts={toasts} removeToast={removeToast} />
      <ConfirmSplash
        open={splash}
        title="Account created"
        subtitle={form.full_name || undefined}
        onDone={() => setSplash(false)}
      />

      <nav className="sticky top-0 z-30 bg-surface header-blend pt-safe">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
          <img src={ursLogo} alt="" aria-hidden="true" className="w-8 h-8 object-contain shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-fg truncate">Student registration</p>
            <p className="text-xs text-muted-fg truncate">College of Engineering</p>
          </div>
          <Link to="/student" className="btn btn-ghost btn-sm shrink-0">
            <ArrowLeft size={15} aria-hidden="true" /> Back
          </Link>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-md mx-auto px-4 py-8 sm:py-12 pb-safe">

        {result ? (
          <section className="animate-rise text-center" aria-labelledby="done">
            <span className="icon-tile icon-tile-brand mx-auto mb-4 w-14 h-14">
              <Check size={26} aria-hidden="true" />
            </span>
            <h1 id="done" className="text-title font-bold text-on-backdrop">You're registered</h1>
            <p className="text-on-backdrop/75 mt-1.5">Welcome, {result.full_name}.</p>

            <div className="card mt-6">
              <img
                src={`data:image/png;base64,${result.qr_base64}`}
                alt={`QR code for student ID ${result.student_id}`}
                className="w-44 h-44 mx-auto"
              />
              <p className="font-mono font-semibold text-fg mt-3">{result.student_id}</p>
              <p className="text-sm text-muted-fg mt-1">
                Save this QR code — scanning it is the quick way back in. You'll still
                need your PIN.
              </p>
              <Button className="mt-4 w-full" icon={Download} onClick={downloadQR}>
                Download QR code
              </Button>
            </div>

            <Button variant="primary" className="w-full mt-3"
              onClick={() => navigate("/student/dashboard", { replace: true })}>
              Go to my dashboard <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </section>
        ) : (
          <>
            <header className="mb-6">
              <span className="icon-tile icon-tile-brand mb-3"><GraduationCap size={22} aria-hidden="true" /></span>
              <h1 className="text-title font-bold text-on-backdrop">Create your account</h1>
              <p className="text-on-backdrop/75 mt-1.5">Step {step} of 2 — {step === 1 ? "your details" : "choose a PIN"}</p>
              <div className="flex gap-1.5 mt-4" aria-hidden="true">
                {[1, 2].map(s => (
                  <span key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-accent" : "bg-on-backdrop/25"}`} />
                ))}
              </div>
            </header>

            {step === 1 ? (
              <div className="card space-y-4 animate-rise">
                <Field label="Student ID" id="reg-id" value={form.student_id}
                  onChange={v => set("student_id", v)} placeholder="e.g. 21-00123"
                  className="font-mono" autoCapitalize="characters" />
                <Field label="Full name" id="reg-name" value={form.full_name}
                  onChange={v => set("full_name", v)} placeholder="Juan Dela Cruz"
                  autoComplete="name" autoCapitalize="words" />
                <Field label="Course" id="reg-course" value={form.course}
                  onChange={v => set("course", v)} placeholder="BS Computer Engineering" />
                <div>
                  <label htmlFor="reg-year" className="label">Year level</label>
                  <select id="reg-year" className="input" value={form.year_level}
                    onChange={e => set("year_level", e.target.value)}>
                    <option value="">Select year level</option>
                    {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-dept" className="label">Department</label>
                  <select id="reg-dept" className="input" value={form.department}
                    onChange={e => set("department", e.target.value)}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <Button variant="primary" className="w-full" onClick={next}>
                  Continue <ArrowRight size={16} aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <div className="card space-y-5 animate-rise">
                <Alert tone="info" icon={ShieldCheck}>
                  Your PIN protects your consultation history. Choose 4 digits you'll remember.
                </Alert>
                <PinField label="Choose a PIN" value={pin} onChange={setPin} autoFocus />
                <PinField label="Confirm PIN" value={pinConfirm} onChange={setPinConfirm} />
                {pinConfirm.length === 4 && pin !== pinConfirm && (
                  <Alert tone="danger">Those PINs don't match.</Alert>
                )}
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => setStep(1)} disabled={loading}>Back</Button>
                  <Button variant="primary" className="flex-1" loading={loading}
                    onClick={submit} disabled={pin.length < 4 || pinConfirm.length < 4}>
                    {loading ? "Creating…" : "Create account"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <SiteFooter />
    </URSBackground>
  );
}

function Field({ label, id, value, onChange, className = "", ...rest }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} className={`input ${className}`} value={value}
        onChange={e => onChange(e.target.value)} spellCheck="false" {...rest} />
    </div>
  );
}

/* A numeric field rather than a keypad: this screen already has a keyboard open
   for the text fields above it, so a second input paradigm would only confuse.
   inputMode="numeric" gets the digit pad on a phone. */
function PinField({ label, value, onChange, autoFocus }) {
  const id = `pin-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          className="input font-mono tracking-[0.5em] text-center text-lg"
          type="password"
          inputMode="numeric"
          pattern="\d*"
          maxLength={4}
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
          aria-describedby={`${id}-hint`}
        />
        {value && (
          <button type="button" onClick={() => onChange("")}
            aria-label={`Clear ${label}`}
            className="w-11 h-11 grid place-items-center rounded-lg text-muted-fg hover:text-fg hover:bg-surface-2">
            <Delete size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      <p id={`${id}-hint`} className="sr-only">Four digits</p>
    </div>
  );
}
