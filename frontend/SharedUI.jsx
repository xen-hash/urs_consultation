import { useEffect, useState } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, LogOut, Home } from "lucide-react";
import { Link } from "react-router-dom";
import ursLogo from "./URS_LOGO.png";


// ── URS Logo Badge (used in headers) ─────────────────────────────────────────
function URSLogoBadge() {
  const [err, setErr] = useState(false);
  return (
    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md shrink-0 overflow-hidden">
      {!err
        ? <img src={ursLogo} alt="URS" className="w-full h-full object-contain p-0.5"
            onError={() => setErr(true)} />
        : <span className="text-[#003366] font-black text-base leading-none">U</span>
      }
    </div>
  );
}

// ── Glassmorphism Top Nav ─────────────────────────────────────────────────────
export function GlassNav({ title, subtitle, user, onLogout, backTo = "/" }) {
  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between px-5 sm:px-8 py-4
                    bg-white/10 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <Link to={backTo} className="flex items-center gap-3 group">
          <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-md
                         group-hover:scale-105 transition-transform">
            <URSLogoBadge />
          </div>
          <div>
            <p className="text-white font-display font-black text-sm leading-tight tracking-wide">UNIVERSITY OF RIZAL SYSTEM</p>
            {subtitle && <p className="text-white/60 text-xs font-bold">{subtitle}</p>}
          </div>
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <div className="hidden sm:block text-right">
            <p className="text-white text-sm font-black leading-tight tracking-wide">{user.name}</p>
            <p className="text-white/70 text-xs font-bold">{user.sub}</p>
          </div>
        )}
        {onLogout && (
          <button onClick={onLogout}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-semibold
                       bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-xl transition-all">
            <LogOut size={13} /> Logout
          </button>
        )}
        {!onLogout && (
          <Link to="/"
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm
                       bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-xl transition-all">
            <Home size={13} /> Home
          </Link>
        )}
      </div>
    </nav>
  );
}

// ── Legacy header kept for backward compat ────────────────────────────────────
export function URSHeader({ subtitle, user, onLogout, accent }) {
  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between px-5 sm:px-8 py-4
                    bg-white/10 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <URSLogoBadge />
        <div>
          <p className="text-white font-display font-black text-sm leading-tight tracking-wide">UNIVERSITY OF RIZAL SYSTEM</p>
          {subtitle && <p className="text-white/60 text-xs font-bold">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {onLogout && (
          <button onClick={onLogout}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-semibold
                       bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-xl transition-all">
            <LogOut size={13} /> Logout
          </button>
        )}
        {!onLogout && (
          <Link to="/"
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm
                       bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-xl transition-all">
            <Home size={13} /> Home
          </Link>
        )}
      </div>
    </nav>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const cfg = {
    Available:    { cls: "status-available",   dot: "bg-emerald-500", ping: true },
    Unavailable:  { cls: "status-unavailable", dot: "bg-slate-400",   ping: false },
    "On Leave":   { cls: "status-on-leave",    dot: "bg-amber-500",   ping: false },
    "In Meeting": { cls: "status-in-meeting",  dot: "bg-orange-500",  ping: false },
  };
  const c = cfg[status] || cfg["Unavailable"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.cls}`}>
      <span className="relative flex h-1.5 w-1.5">
        {c.ping && <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${c.dot}`} />
      </span>
      {status || "Unavailable"}
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
const TOAST_CONFIG = {
  success: { icon: <CheckCircle size={16} />,  cls: "bg-emerald-50 border-emerald-200 text-emerald-800", icon_cls: "text-emerald-500" },
  error:   { icon: <AlertCircle size={16} />,  cls: "bg-red-50 border-red-200 text-red-800",             icon_cls: "text-red-500" },
  info:    { icon: <Info size={16} />,          cls: "bg-blue-50 border-blue-200 text-blue-800",          icon_cls: "text-blue-500" },
  warning: { icon: <AlertTriangle size={16} />, cls: "bg-amber-50 border-amber-200 text-amber-800",       icon_cls: "text-amber-500" },
};

export function Toast({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      {toasts.map(t => {
        const cfg = TOAST_CONFIG[t.type] || TOAST_CONFIG.info;
        return (
          <div key={t.id}
            className={`flex items-start gap-3 p-3.5 rounded-2xl border shadow-xl pointer-events-auto animate-slide-down ${cfg.cls}`}>
            <span className={`shrink-0 mt-0.5 ${cfg.icon_cls}`}>{cfg.icon}</span>
            <p className="text-sm flex-1 leading-snug">{t.message}</p>
            <button onClick={() => removeToast(t.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity mt-0.5">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToastState() {
  const [toasts, setToasts] = useState([]);
  const addToast = (message, type = "info", duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));
  return { toasts, addToast, removeToast };
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = "md" }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  const sizes = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl", "2xl": "max-w-2xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-3xl shadow-2xl w-full ${sizes[size]} animate-bounce-in`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-display font-bold text-lg text-[#003366]">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <X size={14} className="text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Page Wrapper with blue bg ─────────────────────────────────────────────────
export function PageWrapper({ children, className = "" }) {
  return (
    <div className={`relative min-h-screen flex flex-col animate-fade-in ${className}`}>
      <div className="fixed inset-0 z-0" style={{ background: "linear-gradient(135deg,#001240 0%,#003366 50%,#001240 100%)" }} />
      <div className="fixed inset-0 z-0 dot-pattern" />
      <div className="relative z-10 flex flex-col flex-1">
        {children}
      </div>
    </div>
  );
}

// ── Light content area (white/gray cards on blue bg) ─────────────────────────
export function ContentArea({ children, className = "" }) {
  return (
    <div className={`flex-1 px-4 sm:px-6 py-6 max-w-5xl mx-auto w-full ${className}`}>
      {children}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 5, light = false }) {
  return (
    <div className={`w-${size} h-${size} border-2 rounded-full animate-spin shrink-0
      ${light ? "border-white/30 border-t-white" : "border-[#003366]/20 border-t-[#003366]"}`} />
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, desc }) {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-3">{icon || "📭"}</div>
      <p className="font-semibold text-gray-500 text-sm">{title}</p>
      {desc && <p className="text-gray-400 text-xs mt-1">{desc}</p>}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({ icon, value, label, sub, color = "blue" }) {
  const colors = {
    blue:   "from-[#003366] to-[#0055aa]",
    orange: "from-[#c45000] to-[#ff6f00]",
    green:  "from-[#065f46] to-[#059669]",
    purple: "from-[#4c1d95] to-[#7c3aed]",
    slate:  "from-[#1e293b] to-[#334155]",
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-3xl p-5 text-white shadow-lg`}>
      <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center mb-4">{icon}</div>
      <p className="text-3xl font-display font-black tracking-tight">{value}</p>
      <p className="text-sm font-semibold opacity-90 mt-1">{label}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Glass Card ────────────────────────────────────────────────────────────────
export function GlassCard({ children, className = "" }) {
  return (
    <div className={`bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

// ── White Card (for content on blue bg) ───────────────────────────────────────
export function WhiteCard({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-3xl shadow-sm border border-gray-100/80 ${className}`}>
      {children}
    </div>
  );
}
