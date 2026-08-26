import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { QrCode, ScanLine, ChevronLeft, Lock, Delete, ArrowRight, ShieldCheck } from "lucide-react";
import QRScanner from "./QRScanner.jsx";
import { Toast, useToastState, Spinner, ConfirmSplash, ErrorSplash, classifyAuthError } from "./SharedUI.jsx";
import SignedOutNotice from "./ui/SignedOutNotice.jsx";
import PortalNav, { BackLink } from "./ui/PortalNav.jsx";
import URSBackground from "./URSBackground.jsx";
import HomeBrand from "./ui/HomeBrand.jsx";
import api, { apiError } from "./httpClient.js";
import { setSession } from "./auth.js";

// This screen used to offer a third option, "Get My ID", which let anyone pick
// any professor from a list and receive that professor's employee ID and login
// QR. It also carried an "Admin Dashboard" card that minted the administrator
// token in the browser. Both were unauthenticated account takeover, so both are
// gone: faculty credentials are issued by an administrator and handed over in
// person, and /dean is the only administrator entry point.

export default function TeacherPortal() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToastState();

  const [view, setView] = useState("home");   // home | scanqr | pinlogin | setpin
  const [pinEmpId, setPinEmpId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [splash, setSplash] = useState(null);
  const [failure, setFailure] = useState(null);

  // Set-PIN step, shown right after a QR login when no PIN exists yet. A printed
  // card on its own is a single factor that survives being photographed, so a
  // PIN gets set before the dashboard opens.
  const [newPin, setNewPin] = useState("");
  const [pendingTeacher, setPendingTeacher] = useState(null);

  const goHome = () => {
    setView("home"); setPin(""); setPinEmpId(""); setNewPin(""); setPendingTeacher(null);
  };

  // The splash holds the confirmation while the route changes underneath it,
  // which a toast cannot do — navigation unmounts the toast host.
  const enterDashboard = (teacher, message) => {
    setSplash({ title: message, subtitle: teacher?.department });
  };

  // An issued serial is 32 URL-safe characters. Anything else came from a
  // different QR entirely — a student card, a Wi-Fi code, a poster — and saying
  // so beats sending it to the server to be told it is unrecognised.
  const looksLikeFacultyCard = (value) => /^[A-Za-z0-9_-]{20,64}$/.test(value);

  const handleTeacherQRScan = async (value) => {
    if (!looksLikeFacultyCard(value)) {
      return setFailure({ kind: "qr_foreign" });
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/teacher/qr-login", { qr_token: value });
      setSession("teacher", data.token, data.teacher);
      if (!data.teacher.has_pin) {
        setPendingTeacher(data.teacher);
        setView("setpin");
        addToast("Welcome! Set a PIN to finish securing your account.", "info");
      } else {
        enterDashboard(data.teacher, `Welcome back, ${data.teacher.professor_name}`);
      }
    } catch (e) {
      setFailure({ kind: classifyAuthError(e), detail: apiError(e, "") });
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async () => {
    if (!pinEmpId.trim()) return addToast("Enter your Employee ID.", "warning");
    if (pin.length !== 4) return addToast("Enter your 4-digit PIN.", "warning");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/teacher/pin-login", {
        employee_id: pinEmpId.trim().toUpperCase(), pin,
      });
      setSession("teacher", data.token, data.teacher);
      enterDashboard(data.teacher, `Welcome, ${data.teacher.professor_name}`);
    } catch (e) {
      setFailure({ kind: classifyAuthError(e), detail: apiError(e, "") });
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPin = async () => {
    if (newPin.length !== 4) return addToast("Choose a 4-digit PIN.", "warning");
    setLoading(true);
    try {
      await api.post("/auth/teacher/set-pin", { pin: newPin });
      enterDashboard(pendingTeacher, "PIN set");
    } catch (e) {
      setFailure({ kind: "credentials", detail: apiError(e, "Could not set your PIN.") });
      setNewPin("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <URSBackground>
      <ConfirmSplash
        open={!!splash}
        title={splash?.title}
        subtitle={splash?.subtitle}
        onDone={() => navigate("/teacher/dashboard", { replace: true })}
      />
      <ErrorSplash
        open={!!failure}
        kind={failure?.kind}
        detail={failure?.detail}
        onClose={() => { setFailure(null); setView("home"); }}
        onRetry={() => setFailure(null)}
      />
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Full width, not a centred column: on a desktop the centred bar put the
          logo out in the middle of the screen, nowhere near the corner people
          look for it. */}
      <nav className="sticky top-0 z-30 bg-surface header-blend pt-safe">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 w-full">
          <HomeBrand subtitle="Faculty Portal" className="flex-1" />
          {/* Back was only drawn once a panel was open, so the first screen —
              the one people land on — had no way out at all. Choosing a PIN is
              the exception: the card scan has already signed you in, and there
              is nothing behind it to go back to. */}
          {view === "home" ? (
            <Link to="/" className="btn btn-ghost btn-sm shrink-0">
              <ChevronLeft size={16} aria-hidden="true" /> Back
            </Link>
          ) : view !== "setpin" ? (
            <button onClick={goHome} className="btn btn-ghost btn-sm shrink-0">
              <ChevronLeft size={16} aria-hidden="true" /> Back
            </button>
          ) : null}
        </div>
      </nav>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 flex flex-col justify-center
                       pt-8 sm:pt-10 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(3rem+env(safe-area-inset-bottom,0px))]">

        {view === "home" && (
          <div className="animate-rise">
            <SignedOutNotice />
            <header className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-on-backdrop tracking-tight">Faculty sign in</h1>
              <p className="text-on-backdrop/75 mt-1.5">Scan your Faculty ID card, or use your Employee ID and PIN.</p>
            </header>

            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={() => setView("scanqr")} className="card card-action text-left">
                <span className="icon-tile icon-tile-brand"><QrCode size={22} aria-hidden="true" /></span>
                <span className="font-semibold text-fg">Scan Faculty ID</span>
                <span className="text-sm text-muted-fg">
                  Point your camera at it, or upload the picture if it's saved on this phone.
                </span>
              </button>

              <button onClick={() => setView("pinlogin")} className="card card-action text-left">
                <span className="icon-tile icon-tile-accent"><Lock size={22} aria-hidden="true" /></span>
                <span className="font-semibold text-fg">Employee ID + PIN</span>
                <span className="text-sm text-muted-fg">Use the PIN you set on this account.</span>
              </button>
            </div>

            {/* Not a card. The two above it are white cards that are buttons, so
                anything sharing that treatment reads as a third thing to press.
                This is a note: no surface of its own, no icon tile, just an
                inset rule and quieter text. */}
            <div className="mt-8 pl-3.5 border-l-2 border-on-backdrop/25">
              <p className="text-sm font-semibold text-on-backdrop/90">
                Don't have a Faculty ID card yet?
              </p>
              <p className="text-sm text-on-backdrop/65 mt-1 leading-relaxed">
                Cards are issued by the admin office. Ask them to print yours — for
                security, they can no longer be generated from this page.
              </p>
            </div>

            <PortalNav current="/teacher" hide={["/availability"]} className="mt-8" />
          </div>
        )}

        {view === "scanqr" && (
          <section className="animate-rise" aria-labelledby="scan-heading">
            <BackLink onClick={goHome}>Sign-in options</BackLink>
            <header className="mb-6 mt-2">
              <h1 id="scan-heading" className="text-2xl font-bold text-on-backdrop tracking-tight">Scan your Faculty ID</h1>
              <p className="text-on-backdrop/75 mt-1.5">
                Hold the QR code on your card inside the frame — or, if the card is
                saved on this phone, upload the picture instead.
              </p>
            </header>
            <div className="card">
              <QRScanner
                onScan={handleTeacherQRScan}
                uploadLabel="Upload your ID card image"
                onError={(msg, kind) => kind === "qr_unreadable"
                  ? setFailure({ kind: "qr_unreadable", detail: msg })
                  : addToast(msg, "error")}
              />
              {loading && (
                <p className="text-center text-sm text-muted-fg mt-3 flex items-center justify-center gap-2">
                  <Spinner size={4} /> Signing you in…
                </p>
              )}
            </div>
          </section>
        )}

        {(view === "pinlogin" || view === "setpin") && (
          <PinPanel
            onBack={goHome}
            mode={view}
            teacher={pendingTeacher}
            employeeId={pinEmpId}
            onEmployeeId={setPinEmpId}
            pin={view === "setpin" ? newPin : pin}
            onPin={view === "setpin" ? setNewPin : setPin}
            loading={loading}
            onSubmit={view === "setpin" ? handleSetPin : handlePinLogin}
          />
        )}
      </main>
    </URSBackground>
  );
}

/* ── PIN entry ─────────────────────────────────────────────────────────────
   One keypad serving both "log in with my PIN" and "choose a PIN". The keys use
   onPointerDown so a tap registers without waiting for the click that follows a
   touch, which is what made the old keypad feel laggy on a phone. */

function PinPanel({ mode, teacher, employeeId, onEmployeeId, pin, onPin, loading, onSubmit, onBack }) {
  const setting = mode === "setpin";
  const press = (fn) => (e) => { e.preventDefault(); fn(); };
  const digit = (n) => press(() => pin.length < 4 && onPin(pin + n));

  return (
    <section className="animate-rise max-w-sm mx-auto w-full" aria-labelledby="pin-heading">
      {/* Choosing a PIN happens after a card scan has already signed you in, so
          there is nothing to go back to — every other panel gets a way out. */}
      {!setting && <BackLink onClick={onBack}>Sign-in options</BackLink>}
      <header className="mb-6 mt-2 text-center">
        <span className={`icon-tile mx-auto mb-3 ${setting ? "icon-tile-accent" : "icon-tile-brand"}`}>
          {setting ? <ShieldCheck size={22} aria-hidden="true" /> : <Lock size={22} aria-hidden="true" />}
        </span>
        <h1 id="pin-heading" className="text-2xl font-bold text-on-backdrop tracking-tight">
          {setting ? "Choose a PIN" : "Employee ID + PIN"}
        </h1>
        <p className="text-on-backdrop/75 mt-1.5">
          {setting
            ? `Welcome, ${teacher?.professor_name || "there"}. Pick a 4-digit PIN so you can sign in without your card.`
            : "Enter your Employee ID and 4-digit PIN."}
        </p>
      </header>

      <div className="card space-y-5">
        {!setting && (
          <div>
            <label htmlFor="employee-id" className="label">Employee ID</label>
            <input
              id="employee-id"
              className="input font-mono tracking-widest uppercase"
              value={employeeId}
              onChange={e => onEmployeeId(e.target.value.toUpperCase())}
              placeholder="T-48291"
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck="false"
            />
          </div>
        )}

        <div>
          <span className="label" id="pin-label">{setting ? "New PIN" : "PIN"}</span>
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

        <button onClick={onSubmit}
          disabled={loading || pin.length < 4 || (!setting && !employeeId.trim())}
          className="btn btn-primary w-full">
          {loading ? <Spinner size={4} light /> : setting ? <ShieldCheck size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
          {loading ? "Please wait…" : setting ? "Set PIN and continue" : "Sign in"}
        </button>

        {!setting && (
          <p className="text-center text-xs text-muted-fg">
            No PIN yet? Scan your Faculty ID card first — you'll be asked to choose one.
          </p>
        )}
      </div>
    </section>
  );
}
