import { usePagedResource } from "./hooks.js";
import { EmptyState, SkeletonRows } from "../SharedUI.jsx";
import {
  ScrollText, LogIn, QrCode, KeyRound, Ban, FileDown, UserPlus,
  Archive, ShieldAlert, Pencil, Trash2, ScanLine, CircleSlash,
} from "lucide-react";

// Each action gets an icon and a tone so a page of rows is scannable — the
// security-relevant ones (failures, revocations, throttling) read as warnings.
const ACTION_META = {
  "admin.login":              { icon: LogIn,       tone: "info",    label: "Admin signed in" },
  "admin.login_failed":       { icon: ShieldAlert, tone: "danger",  label: "Admin sign-in failed" },
  "admin.login_throttled":    { icon: ShieldAlert, tone: "danger",  label: "Admin sign-in throttled" },
  "admin.issue_qr":           { icon: QrCode,      tone: "success", label: "Faculty ID issued" },
  "admin.revoke_qr":          { icon: Ban,         tone: "warning", label: "Faculty ID revoked" },
  "admin.reset_pin":          { icon: KeyRound,    tone: "warning", label: "PIN reset" },
  "admin.set_active":         { icon: CircleSlash, tone: "warning", label: "Account status changed" },
  "admin.add_teacher":        { icon: UserPlus,    tone: "info",    label: "Faculty added" },
  "admin.export":             { icon: FileDown,    tone: "info",    label: "Data exported" },
  "admin.archive_requests":   { icon: Archive,     tone: "warning", label: "Requests archived" },
  "admin.clear_requests":     { icon: Trash2,      tone: "danger",  label: "Requests deleted" },
  "teacher.login":            { icon: LogIn,       tone: "neutral", label: "Faculty signed in" },
  "teacher.login_throttled":  { icon: ShieldAlert, tone: "danger",  label: "Faculty sign-in throttled" },
  "teacher.qr_login_failed":  { icon: ScanLine,    tone: "warning", label: "Unrecognised card scanned" },
  "teacher.set_pin":          { icon: KeyRound,    tone: "neutral", label: "Faculty set a PIN" },
  "teacher.rename":           { icon: Pencil,      tone: "neutral", label: "Faculty renamed" },
  "student.login":            { icon: LogIn,       tone: "neutral", label: "Student signed in" },
  "student.register":         { icon: UserPlus,    tone: "neutral", label: "Student registered" },
  "student.set_pin":          { icon: KeyRound,    tone: "neutral", label: "Student set a PIN" },
  "biometric.enroll":         { icon: ScanLine,    tone: "neutral", label: "Biometrics enrolled" },
  "biometric.delete":         { icon: Trash2,      tone: "warning", label: "Biometrics removed" },
};

const meta = (action) =>
  ACTION_META[action] || { icon: ScrollText, tone: "neutral", label: action };


export { ACTION_META, meta };

/**
 * The most recent activity, for the dashboard.
 *
 * Shares its action vocabulary with the full audit tab so the two cannot
 * describe the same event differently.
 */
export default function AuditFeed({ limit = 6 }) {
  const { data, loading } = usePagedResource("/admin/audit", { limit });

  if (loading) return <SkeletonRows rows={4} cols={2} />;
  if (!data.length) {
    return (
      <EmptyState icon={ScrollText} title="Nothing recorded yet"
        description="Sign-ins, credential changes and exports appear here." />
    );
  }

  return (
    <ul className="divide-y divide-border border-t border-border">
      {data.map(row => {
        const m = meta(row.action);
        const Icon = m.icon;
        return (
          <li key={row.id} className="px-5 py-2.5 flex items-center gap-3">
            <span className={`icon-tile w-8 h-8 shrink-0 badge-${m.tone}`}>
              <Icon size={14} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg truncate">{m.label}</p>
              <p className="text-xs text-muted-fg truncate">
                {row.actor_name || row.actor_id || "Unauthenticated"}
                {row.target && ` · ${row.target}`}
              </p>
            </div>
            <time className="text-xs text-subtle-fg whitespace-nowrap shrink-0 tabular-nums"
              dateTime={row.created_at}>
              {row.created_at?.slice(5, 16).replace(" ", " · ")}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
