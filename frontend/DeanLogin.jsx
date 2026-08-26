import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, Eye, EyeOff, ArrowLeft, ArrowRight } from "lucide-react";
import { Toast, useToastState, Spinner, ConfirmSplash, ErrorSplash, classifyAuthError } from "./SharedUI.jsx";
import SignedOutNotice from "./ui/SignedOutNotice.jsx";
import PortalNav from "./ui/PortalNav.jsx";
import api, { apiError } from "./httpClient.js";
import { setSession } from "./auth.js";

// The credentials this screen used to check (`dean` / `dean2024`) were two
// constants in this file, which meant they shipped in the JavaScript bundle and
// anyone who opened DevTools was an administrator. Verification now happens on
// the server against a bcrypt hash, and the response carries a signed token
// that every admin API route re-checks.

export default function DeanLogin() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToastState();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [splash, setSplash] = useState(false);
  const [failure, setFailure] = useState(null);

  const handleLogin = async () => {
    if (!username || !password) return addToast("Enter your username and password.", "warning");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/admin/login", { username: username.trim(), password });
      setSession("admin", data.token, data.admin);
      setSplash(true);
    } catch (e) {
      setFailure({ kind: classifyAuthError(e), detail: apiError(e, "") });
      setPassword("");
      setLoading(false);
    }
  };

  const onEnter = e => { if (e.key === "Enter") handleLogin(); };

  return (
    <div className="min-h-dvh flex bg-canvas">
      <Toast toasts={toasts} removeToast={removeToast} />
      <ConfirmSplash
        open={splash}
        title="Signed in"
        subtitle="Administration"
        onDone={() => navigate("/dean/dashboard", { replace: true })}
      />
      <ErrorSplash
        open={!!failure}
        kind={failure?.kind}
        detail={failure?.detail}
        onClose={() => setFailure(null)}
      />

      {/* Context panel — desktop only; the form is the whole page on mobile. */}
      <aside className="hidden lg:flex flex-col w-[420px] shrink-0 bg-brand-900 text-white p-10">
        <Link to="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-auto w-fit">
          <ArrowLeft size={15} aria-hidden="true" /> Back to home
        </Link>
        <div className="mb-auto">
          <span className="icon-tile bg-white/10 text-white mb-6"><Shield size={22} aria-hidden="true" /></span>
          <h2 className="text-3xl font-bold tracking-tight leading-tight">Administration</h2>
          <p className="text-white/60 mt-3 leading-relaxed">
            College of Engineering. Faculty credentials, consultation activity and reporting.
          </p>
          <ul className="mt-8 space-y-2.5 text-sm text-white/60">
            {["Issue and revoke Faculty ID cards",
              "Monitor consultation activity",
              "Review the audit trail",
              "Export reports"].map(f => (
              <li key={f} className="flex items-center gap-2.5">
                <span className="w-1 h-1 rounded-full bg-white/40 shrink-0" aria-hidden="true" />{f}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-white/30 text-xs">Restricted — authorised personnel only</p>
      </aside>

      <main className="flex-1 flex flex-col justify-center px-5 py-10 pt-safe
                       pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="w-full max-w-sm mx-auto">
          <Link to="/" className="lg:hidden inline-flex items-center gap-1.5 text-muted-fg hover:text-fg text-sm mb-8">
            <ArrowLeft size={15} aria-hidden="true" /> Back
          </Link>

          <header className="mb-6">
            <span className="icon-tile icon-tile-brand mb-4 lg:hidden"><Shield size={22} aria-hidden="true" /></span>
            <h1 className="text-2xl font-bold text-fg tracking-tight">Administrator sign in</h1>
            <p className="text-muted-fg mt-1.5">Access the administration dashboard.</p>
          </header>

          <SignedOutNotice />

          <div className="card space-y-4">
            <div>
              <label htmlFor="admin-user" className="label">Username</label>
              <input id="admin-user" className="input" value={username} autoFocus
                autoComplete="username" spellCheck="false"
                onChange={e => setUsername(e.target.value)} onKeyDown={onEnter} />
            </div>
            <div>
              <label htmlFor="admin-pass" className="label">Password</label>
              <div className="relative">
                <input id="admin-pass" className="input pr-12"
                  type={showPass ? "text" : "password"} value={password}
                  autoComplete="current-password"
                  onChange={e => setPassword(e.target.value)} onKeyDown={onEnter} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center
                             text-muted-fg hover:text-fg rounded-lg">
                  {showPass ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </div>
            </div>
            <button onClick={handleLogin} disabled={loading} className="btn btn-primary w-full">
              {loading ? <Spinner size={4} light /> : null}
              {loading ? "Verifying…" : "Sign in"}
              {!loading && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          </div>

          <PortalNav current="/dean" hide={["/availability"]} tone="light" className="mt-8" />
        </div>
      </main>
    </div>
  );
}
