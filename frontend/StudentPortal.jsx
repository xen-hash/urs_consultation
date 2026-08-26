import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { QrCode, Keyboard, ArrowLeft, ArrowRight, Lock, Delete, ShieldCheck } from "lucide-react";
import QRScanner from "./QRScanner.jsx";
import { Toast, useToastState, Spinner, Button, Alert, ConfirmSplash, ErrorSplash, classifyAuthError } from "./SharedUI.jsx";
import SignedOutNotice from "./ui/SignedOutNotice.jsx";
import URSBackground from "./URSBackground.jsx";
import SiteFooter from "./ui/SiteFooter.jsx";
import api, { apiError } from "./httpClient.js";
import { setSession } from "./auth.js";
import ursLogo from "./URS_LOGO.png";

export default function StudentPortal() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToastState();

  const [mode, setMode] = useState(null);   // null | qr | manual | pin | setpin
  const [studentId, setStudentId] = useState("");
  const [pending, setPending] = useState(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [splash, setSplash] = useState(null);
  const [failure, setFailure] = useState(null);

  const home = () => { setMode(null); setStudentId(""); setPending(null); setPin(""); setPinError(null); };

  const findStudent = async (id) => {
    const sid = (id || studentId).trim();
    if (!sid) return addToast("Enter your Student ID.", "warning");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/student/find", { student_id: sid });
      setPending(data);
      setPin("");
      setMode(data.has_pin ? "pin" : "setpin");
    } catch (e) {
      setFailure({ kind: "credentials", detail: apiError(e, "Student not found. Please register first.") });
    } finally {
      setLoading(false);
    }
  };

  const submitPin = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/student/login", {
        student_id: pending.student_id, pin,
      });
      setSession("student", data.token, data.student);

      // An account with no PIN — a new one, or one an administrator has just
      // reset — signs in without a PIN being checked. Save the digits just
      // entered as the new PIN, otherwise the account stays permanently
      // PIN-less and anyone who knows the student ID can sign in as them.
      if (!pending.has_pin) {
        try {
          await api.post("/auth/student/set-pin", { pin });
        } catch {
          // Signing in worked; only the PIN did not save. Say so rather than
          // implying the account is protected when it is not.
          addToast("Signed in, but your PIN didn't save. Set it in your profile.", "warning");
        }
      }

      setSplash({ title: `Welcome, ${data.student.full_name.split(" ")[0]}`,
                  subtitle: "Signing you in" });
    } catch (e) {
      setFailure({ kind: classifyAuthError(e), detail: apiError(e, "") });
      setPin("");
      setLoading(false);
    }
  };

  return (
    <URSBackground>
      <Toast toasts={toasts} removeToast={removeToast} />
      <ConfirmSplash
        open={!!splash}
        title={splash?.title}
        subtitle={splash?.subtitle}
        onDone={() => navigate("/student/dashboard", { replace: true })}
      />
      <ErrorSplash
        open={!!failure}
        kind={failure?.kind}
        detail={failure?.detail}
        onClose={() => setFailure(null)}
        onRetry={() => setFailure(null)}
      />

      <nav className="sticky top-0 z-30 bg-surface header-blend pt-safe">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
          <img src={ursLogo} alt="" aria-hidden="true" className="w-8 h-8 object-contain shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-fg truncate">University of Rizal System</p>
            <p className="text-xs text-muted-fg truncate">Student Portal</p>
          </div>
          {mode && (
            <button onClick={home} className="btn btn-ghost btn-sm shrink-0">
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 w-full max-w-sm mx-auto px-4 py-8 sm:py-12 pb-safe">

        {!mode && (
          <div className="animate-rise">
            <SignedOutNotice />
            <header className="mb-7">
              <h1 className="text-title font-bold text-on-backdrop">Student sign in</h1>
              <p className="text-on-backdrop/75 mt-1.5">Scan your student QR code, or enter your ID.</p>
            </header>

            <div className="space-y-3">
              <button onClick={() => setMode("qr")} className="card card-action w-full text-left">
                <span className="icon-tile icon-tile-brand"><QrCode size={22} aria-hidden="true" /></span>
                <span className="font-semibold text-fg">Scan QR code</span>
                <span className="text-sm text-muted-fg">
                Scan it, or upload the picture if it's saved on this phone.
              </span>
              </button>
              <button onClick={() => setMode("manual")} className="card card-action w-full text-left">
                <span className="icon-tile icon-tile-accent"><Keyboard size={22} aria-hidden="true" /></span>
                <span className="font-semibold text-fg">Enter Student ID</span>
                <span className="text-sm text-muted-fg">Type your ID, then your PIN.</span>
              </button>
            </div>

            {/* A note rather than a card, so it is not mistaken for a third
                sign-in option alongside the two above. */}
            <div className="mt-8 pl-3.5 border-l-2 border-on-backdrop/25">
              <p className="text-sm font-semibold text-on-backdrop/90">New here?</p>
              <p className="text-sm text-on-backdrop/65 mt-1 leading-relaxed">
                <Link to="/student/register"
                  className="text-on-backdrop font-semibold underline underline-offset-2 decoration-on-backdrop/40">
                  Register your student account
                </Link>{" "}
                to request consultations.
              </p>
            </div>
          </div>
        )}

        {mode === "qr" && (
          <section className="animate-rise" aria-labelledby="s-scan">
            <header className="mb-6">
              <h1 id="s-scan" className="text-title font-bold text-on-backdrop">Scan your QR code</h1>
              <p className="text-on-backdrop/75 mt-1.5">Hold it inside the frame.</p>
            </header>
            <div className="card">
              {loading
                ? <div className="flex justify-center py-10"><Spinner size={9} /></div>
                : <QRScanner
                    onScan={findStudent}
                    uploadLabel="Upload your QR image"
                    onError={(msg, kind) => kind === "qr_unreadable"
                      ? setFailure({ kind: "qr_unreadable", detail: msg })
                      : addToast(msg, "error")}
                  />}
            </div>
          </section>
        )}

        {mode === "manual" && (
          <section className="animate-rise" aria-labelledby="s-id">
            <header className="mb-6">
              <h1 id="s-id" className="text-title font-bold text-on-backdrop">Enter your Student ID</h1>
            </header>
            <div className="card space-y-4">
              <div>
                <label htmlFor="student-id" className="label">Student ID</label>
                <input id="student-id" className="input font-mono tracking-wide" autoFocus
                  value={studentId} placeholder="e.g. 21-00123"
                  autoCapitalize="characters" spellCheck="false"
                  onChange={e => setStudentId(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && findStudent()} />
              </div>
              <Button variant="primary" className="w-full" loading={loading}
                onClick={() => findStudent()} disabled={!studentId.trim()}>
                Continue {!loading && <ArrowRight size={16} aria-hidden="true" />}
              </Button>
            </div>
          </section>
        )}

        {(mode === "pin" || mode === "setpin") && pending && (
          <StudentPinStep
            student={pending}
            setting={mode === "setpin"}
            pin={pin}
            onPin={setPin}
            loading={loading}
            onSubmit={submitPin}
          />
        )}
      </main>

      <SiteFooter />
    </URSBackground>
  );
}

/* A student with no PIN is a legacy account from before PINs existed. They log
   in on ID alone this once — the server still allows it — and the wording says
   so plainly rather than pretending a PIN was checked. */

function StudentPinStep({ student, setting, pin, onPin, loading, onSubmit }) {
  const press = fn => e => { e.preventDefault(); fn(); };
  const digit = n => press(() => pin.length < 4 && onPin(pin + n));

  return (
    <section className="animate-rise" aria-labelledby="s-pin">
      <header className="mb-6 text-center">
        <span className={`icon-tile mx-auto mb-3 ${setting ? "icon-tile-accent" : "icon-tile-brand"}`}>
          {setting ? <ShieldCheck size={22} aria-hidden="true" /> : <Lock size={22} aria-hidden="true" />}
        </span>
        <h1 id="s-pin" className="text-title font-bold text-on-backdrop">
          Hello, {student.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-on-backdrop/75 mt-1.5">
          {setting ? "This account has no PIN yet — signing in will let you set one."
                   : "Enter your 4-digit PIN."}
        </p>
      </header>

      <div className="card space-y-5">
        <div className="flex gap-3 justify-center" role="status" aria-live="polite"
          aria-label={`${pin.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map(i => (
            <span key={i}
              className={`w-12 h-14 rounded-lg border flex items-center justify-center text-2xl
                ${pin[i] ? "border-brand bg-brand-50 text-brand" : "border-border bg-canvas"}`}>
              {pin[i] ? "•" : ""}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button key={n} onPointerDown={digit(n)} className="keypad-key" aria-label={`Digit ${n}`}>{n}</button>
          ))}
          <button onPointerDown={press(() => onPin(pin.slice(0, -1)))}
            className="keypad-key keypad-key-muted" aria-label="Delete last digit">
            <Delete size={20} aria-hidden="true" />
          </button>
          <button onPointerDown={digit(0)} className="keypad-key" aria-label="Digit 0">0</button>
          <button onPointerDown={press(() => onPin(""))}
            className="keypad-key keypad-key-muted text-xs" aria-label="Clear PIN">CLEAR</button>
        </div>

        <Button variant="primary" className="w-full" loading={loading}
          onClick={onSubmit} disabled={!setting && pin.length < 4}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </div>
    </section>
  );
}
