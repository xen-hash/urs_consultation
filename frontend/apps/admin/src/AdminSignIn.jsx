import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Toast, useToastState, Spinner, ConfirmSplash, ErrorSplash, classifyAuthError } from "@urs/shared/SharedUI.jsx";
import SignedOutNotice from "@urs/shared/ui/SignedOutNotice.jsx";
import PortalNav from "@urs/shared/ui/PortalNav.jsx";
import URSBackground from "@urs/shared/URSBackground.jsx";
import SignInLayout, { SignInHeading, publicHome } from "@urs/shared/ui/SignInLayout.jsx";
import api, { apiError } from "@urs/shared/lib/httpClient.js";
import { setSession } from "@urs/shared/lib/auth.js";

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
    <URSBackground>
      <Toast toasts={toasts} removeToast={removeToast} />
      <ConfirmSplash
        open={splash}
        title="Signed in"
        subtitle="Administration"
        onDone={() => navigate("/dashboard", { replace: true })}
      />
      <ErrorSplash
        open={!!failure}
        kind={failure?.kind}
        detail={failure?.detail}
        onClose={() => setFailure(null)}
      />

      {/* The same frame as the student and faculty sign-ins.
          This screen used to be a different design entirely: a 420px navy
          panel on the left carrying an icon, a paragraph and a four-item list
          of what the office does, beside a light form on the right. All of it
          was `hidden lg:flex`, so an administrator on a phone — which is most
          of them, most of the time — got a bare username box on an empty
          canvas with no heading of consequence and no statement that the page
          is restricted. The content that only desktop saw is now a note under
          the form that everybody gets, and the page is no longer the one
          screen in the system that looks like it came from somewhere else. */}
      <SignInLayout back={{ href: publicHome() }} width="md">
        <div className="animate-rise">
          <span className="icon-tile icon-tile-role mb-4">
            <Shield size={22} aria-hidden="true" />
          </span>
          <SignInHeading title="Administrator sign in">
            Faculty credentials, consultation activity and reporting.
          </SignInHeading>

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

          {/* Not a card: the form above it is the only thing on this screen to
              press, and a second white surface under it reads as a second one.
              Same inset-rule treatment the other two sign-ins use for the note
              that is not an option. */}
          <div className="mt-7 pl-3.5 border-l-2 border-on-backdrop/25">
            <p className="text-sm font-semibold text-on-backdrop/90">
              Restricted — authorised personnel only
            </p>
            <p className="text-sm text-on-backdrop/65 mt-1 leading-relaxed">
              This is where Faculty ID cards are issued and revoked, consultation
              activity is monitored and the audit trail is reviewed. Every action
              taken here is recorded against this account.
            </p>
          </div>

          <PortalNav current="admin" hide={["Who's available"]} className="mt-8" />
        </div>
      </SignInLayout>
    </URSBackground>
  );
}
