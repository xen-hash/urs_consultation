// Shared UI primitives.
//
// Buttons, cards, badges and tables used to be hand-rolled in every file with
// slightly different classes each time. These are the single implementation;
// the visual rules live in index.css so the markup here stays about structure
// and accessibility.

import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, Clock, CheckCircle2, XCircle, CalendarCheck, Inbox, AlertTriangle,
  Archive, CircleDot,
} from "lucide-react";

/* ── Button ───────────────────────────────────────────────────────────────── */

export function Button({
  variant = "secondary", size = "md", icon: Icon, children,
  className = "", loading = false, confirmed = false, disabled, ...rest
}) {
  // `confirmed` swaps the icon for a drawn check for a moment after the action
  // lands, so the confirmation appears where the press happened rather than
  // only in a corner of the screen.
  const glyph = loading
    ? <Spinner size={4} light={variant === "primary" || variant === "danger"} />
    : confirmed
    ? <ConfirmMark size={size === "sm" ? 14 : 16} ring={false} />
    : Icon
    ? <Icon size={size === "sm" ? 14 : 16} aria-hidden="true" />
    : null;

  return (
    <button
      className={`btn btn-${variant} ${size === "sm" ? "btn-sm" : ""} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {glyph}
      {children}
    </button>
  );
}

/** Tracks a short-lived "just succeeded" flag for the Button above. */
export function useConfirmed(ms = 1600) {
  const [confirmed, setConfirmed] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const confirm = () => {
    setConfirmed(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setConfirmed(false), ms);
  };
  return [confirmed, confirm];
}

/** Icon-only button. Always needs a label — the icon alone tells a screen
 *  reader nothing, and the old codebase had a dozen of these unlabelled. */
export function IconButton({ icon: Icon, label, className = "", size = 18, ...rest }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`w-11 h-11 grid place-items-center rounded-lg text-muted-fg
                  hover:text-fg hover:bg-surface-2 transition-colors duration-200
                  disabled:opacity-40 disabled:pointer-events-none ${className}`}
      {...rest}
    >
      <Icon size={size} aria-hidden="true" />
    </button>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────────── */

export function Card({ children, className = "", as: Tag = "div", ...rest }) {
  return <Tag className={`card ${className}`} {...rest}>{children}</Tag>;
}

export function CardHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && <span className="icon-tile icon-tile-muted"><Icon size={18} aria-hidden="true" /></span>}
        <div className="min-w-0">
          <h2 className="font-semibold text-fg">{title}</h2>
          {subtitle && <p className="text-sm text-muted-fg mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ── Status badge ─────────────────────────────────────────────────────────────
   Icon *and* text, always. Colour alone can't carry meaning — it fails for
   colour-blind users and disappears in print. The old badges were emoji glyphs
   ("⏳ Pending"), which screen readers announce as "hourglass not done". */

const REQUEST_STATUS = {
  pending:     { label: "Pending",     icon: Clock,         cls: "badge-warning" },
  done:        { label: "Done",        icon: CheckCircle2,  cls: "badge-success" },
  declined:    { label: "Declined",    icon: XCircle,       cls: "badge-danger" },
  archived:    { label: "Archived",    icon: Archive,       cls: "badge-neutral" },
  appointment: { label: "Appointment", icon: CalendarCheck, cls: "badge-accent" },
};

const AVAILABILITY = {
  "Available":   { icon: CheckCircle2, cls: "badge-success" },
  "Unavailable": { icon: CircleDot,    cls: "badge-neutral" },
  "On Leave":    { icon: CalendarCheck, cls: "badge-warning" },
  "In Meeting":  { icon: Clock,        cls: "badge-accent" },
};

export function StatusBadge({ status }) {
  const meta = AVAILABILITY[status] || AVAILABILITY.Unavailable;
  const Icon = meta.icon;
  return (
    <span className={`badge ${meta.cls}`}>
      <Icon size={13} aria-hidden="true" />{status || "Unavailable"}
    </span>
  );
}

export function RequestBadge({ status, hasAppointment = false }) {
  const key  = hasAppointment && status === "pending" ? "appointment" : status;
  const meta = REQUEST_STATUS[key] || REQUEST_STATUS.pending;
  const Icon = meta.icon;
  return (
    <span className={`badge ${meta.cls}`}>
      <Icon size={13} aria-hidden="true" />{meta.label}
    </span>
  );
}

export function Badge({ children, tone = "neutral", icon: Icon }) {
  return (
    <span className={`badge badge-${tone}`}>
      {Icon && <Icon size={13} aria-hidden="true" />}{children}
    </span>
  );
}

/* ── Confirmation ─────────────────────────────────────────────────────────── */

/**
 * A check that draws itself, for the moment an action completes.
 *
 * Success used to look identical to every other toast — same corner, same
 * shape, just different words — so a completed action was something you had to
 * read to notice. The stroke animating in is caught peripherally, which is the
 * point: confirmation should not require reading.
 */
export function ConfirmMark({ size = 18, ring = true }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {ring && (
        <span
          aria-hidden="true"
          className="confirm-ring absolute inset-0 rounded-full border-2 border-current"
        />
      )}
      <svg
        className="confirm-mark relative"
        width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

/**
 * The same stroke, drawn as a cross, for the moment an action fails.
 *
 * A failed sign-in used to arrive as a small card while a success took over the
 * screen, so the two outcomes of the same tap looked like they came from
 * different apps. Sharing the mark — same disc, same draw, same beat — makes
 * the failure as legible as the success, and the shape carries which one it is
 * before any of the words are read.
 */
export function AlertMark({ size = 18, ring = true }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {ring && (
        <span
          aria-hidden="true"
          className="confirm-ring absolute inset-0 rounded-full border-2 border-current"
        />
      )}
      <svg
        className="confirm-mark mark-cross relative"
        width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </span>
  );
}

/* ── Feedback ─────────────────────────────────────────────────────────────── */

export function Spinner({ size = 5, light = false }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block rounded-full border-2 animate-spin shrink-0
        ${light ? "border-white/30 border-t-white" : "border-brand/25 border-t-brand"}`}
      style={{ width: `${size * 0.25}rem`, height: `${size * 0.25}rem` }}
    />
  );
}

/** Grey blocks standing in for content that is still loading. Reserving the
 *  space keeps the page from jumping when the data lands. */
export function Skeleton({ className = "h-4 w-full" }) {
  return <span aria-hidden="true" className={`block rounded bg-surface-2 animate-shimmer ${className}`} />;
}

export function SkeletonRows({ rows = 5, cols = 4 }) {
  return (
    <div className="p-4 space-y-3" role="status" aria-label="Loading data">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? "w-1/3" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** An empty state should say what happened and what to do next, not just be
 *  blank space. */
export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="text-center py-14 px-6">
      <span className="icon-tile icon-tile-muted mx-auto mb-3 w-12 h-12">
        <Icon size={22} aria-hidden="true" />
      </span>
      <p className="font-semibold text-fg">{title}</p>
      {description && <p className="text-sm text-muted-fg mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "warning", icon: Icon = AlertTriangle, children }) {
  const tones = {
    warning: "bg-warning-50 text-warning-fg",
    danger:  "bg-danger-50 text-danger",
    info:    "bg-info-50 text-info",
    success: "bg-success-50 text-success",
  };
  return (
    <div role="status" className={`flex gap-2.5 items-start rounded-lg px-3.5 py-3 text-sm ${tones[tone]}`}>
      <Icon size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ── Scroll lock ──────────────────────────────────────────────────────────────
   `body { overflow: hidden }` does not hold on iOS Safari — the page behind a
   modal keeps rubber-banding. Pinning the body with position:fixed does, at the
   cost of having to restore the scroll position by hand afterwards. */

export function useScrollLock(active) {
  useLayoutEffect(() => {
    if (!active) return undefined;
    const y = window.scrollY;
    const { body } = document;
    const prev = {
      position: body.style.position, top: body.style.top,
      width: body.style.width, overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      Object.assign(body.style, prev);
      window.scrollTo(0, y);
    };
  }, [active]);
}

/* ── Modal ────────────────────────────────────────────────────────────────── */

export function Modal({ open, onClose, title, description, children, footer, size = "md", label }) {
  useScrollLock(open);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    // Move focus into the dialog so keyboard users are not left behind it.
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const sizes = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-2xl" };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-brand-900/50 animate-fade" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label || (typeof title === "string" ? title : undefined)}
        tabIndex={-1}
        className={`relative bg-surface w-full ${sizes[size]} shadow-lg animate-rise
                    rounded-t-xl sm:rounded-xl flex flex-col max-h-[92dvh] focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold text-fg">{title}</h2>
            {description && <p className="text-sm text-muted-fg mt-0.5">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2 -mt-1.5" size={17} />
        </div>
        {/* The body scrolls, not the page: on a landscape phone a tall modal
            would otherwise put its buttons off-screen with no way to reach. */}
        <div className="px-5 py-4 overflow-y-auto grow">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-border flex gap-2 justify-end shrink-0 pb-safe">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Confirmation for destructive actions. Returns the modal; caller owns state. */
export function ConfirmModal({
  open, onClose, onConfirm, title, description,
  confirmLabel = "Confirm", tone = "danger", loading = false,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }>
      <p className="text-sm text-muted-fg">{description}</p>
    </Modal>
  );
}

/* ── Drawer ───────────────────────────────────────────────────────────────────
   Off-canvas navigation for small screens. The admin sidebar used to expand on
   hover only, which does not exist on touch — the hamburger dimmed the screen
   and nothing else. */

export function Drawer({ open, onClose, children, label = "Navigation" }) {
  useScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-brand-900/50 lg:hidden transition-opacity duration-200
          ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal={open || undefined}
        aria-label={label}
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-50 w-[268px] max-w-[85vw] lg:hidden
          bg-brand-900 flex flex-col transition-transform duration-250 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {children}
      </aside>
    </>
  );
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */

export function Tabs({ tabs, active, onChange, className = "" }) {
  return (
    <div role="tablist" className={`flex gap-1 overflow-x-auto -mx-1 px-1 ${className}`}>
      {tabs.map(tab => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 px-3.5 min-h-[40px] rounded-lg text-sm font-semibold
              transition-colors duration-200 inline-flex items-center gap-2
              ${selected ? "bg-brand text-white" : "text-muted-fg hover:text-fg hover:bg-surface-2"}`}
          >
            {tab.icon && <tab.icon size={15} aria-hidden="true" />}
            {tab.label}
            {tab.badge > 0 && (
              <span className={`text-[11px] font-bold px-1.5 rounded-full
                ${selected ? "bg-white/20" : "bg-accent-50 text-accent-fg"}`}>{tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Pagination ───────────────────────────────────────────────────────────── */

export function Pagination({ page, pages, total, pageSize, onPage, noun = "items" }) {
  if (!total || total <= pageSize) return null;
  const first = (page - 1) * pageSize + 1;
  const last  = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
      <p className="text-xs text-muted-fg">
        {first}–{last} of {total} {noun}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}>
          Previous
        </Button>
        <span className="text-xs text-muted-fg tabular-nums px-1">{page} / {pages || 1}</span>
        <Button size="sm" onClick={() => onPage(page + 1)} disabled={page >= (pages || 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

/* ── Toasts ───────────────────────────────────────────────────────────────── */

export function useToastState() {
  const [toasts, setToasts] = useState([]);
  const removeToast = id => setToasts(t => t.filter(x => x.id !== id));
  const addToast = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  };
  return { toasts, addToast, removeToast };
}

const TOAST_TONE = {
  success: { cls: "bg-success-50 text-success border-success/20",  icon: CheckCircle2, confirm: true },
  error:   { cls: "bg-danger-50 text-danger border-danger/20",     icon: XCircle },
  warning: { cls: "bg-warning-50 text-warning-fg border-warning-fg/20", icon: AlertTriangle },
  info:    { cls: "bg-surface text-fg border-border",              icon: Inbox },
};

export function Toast({ toasts, removeToast }) {
  return createPortal(
    <div
      className="fixed top-0 inset-x-0 z-[100] pt-safe px-4 pointer-events-none
                 flex flex-col items-center gap-2 sm:items-end sm:px-6"
      role="region"
      aria-label="Notifications"
    >
      <div className="w-full max-w-sm space-y-2 mt-3">
        {toasts.map(t => {
          const tone = TOAST_TONE[t.type] || TOAST_TONE.info;
          const Icon = tone.icon;
          return (
            <div
              key={t.id}
              role="status"
              aria-live="polite"
              onClick={() => removeToast(t.id)}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border
                          px-3.5 py-3 text-sm shadow-lg animate-rise cursor-pointer ${tone.cls}`}
            >
              {tone.confirm
                ? <span className="mt-0.5"><ConfirmMark size={16} /></span>
                : <Icon size={16} className="shrink-0 mt-0.5" aria-hidden="true" />}
              <span className="min-w-0 font-medium">{t.message}</span>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
