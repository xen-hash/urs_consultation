import { useEffect, useState } from "react";
import {
  ScrollText, Search, LogIn, QrCode, KeyRound, Ban, FileDown, UserPlus,
  Archive, ShieldAlert, Pencil, Trash2, ScanLine, CircleSlash,
} from "lucide-react";
import { Card, Badge, EmptyState, SkeletonRows, Pagination } from "../SharedUI.jsx";
import { usePagedResource, useDebounced } from "./hooks.js";
import api from "../httpClient.js";

/**
 * The audit trail.
 *
 * Nothing recorded who did what before this, so an account takeover left no
 * trace to investigate. Every login, card issuance, revocation, PIN reset,
 * export and archive lands here with an actor and an IP.
 */

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

export default function AuditTab() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [actions, setActions] = useState([]);
  const debounced = useDebounced(search);

  const { data, total, pages, page, setPage, loading, limit } =
    usePagedResource("/admin/audit", { params: { search: debounced, action }, limit: 25 });

  // The action list comes back with the first page; keep it stable so the
  // filter dropdown doesn't shrink to whatever the current page happens to hold.
  useEffect(() => {
    api.get("/admin/audit", { params: { limit: 1 } })
      .then(({ data: body }) => setActions(body.actions || []))
      .catch(() => {});
  }, []);

  return (
    <div className="animate-rise">
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={17} aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle-fg pointer-events-none" />
          <input className="input pl-11" placeholder="Search by person…" value={search}
            onChange={e => setSearch(e.target.value)} aria-label="Search audit log" />
        </div>
        <div className="min-w-[180px]">
          <label htmlFor="audit-action" className="sr-only">Filter by action</label>
          <select id="audit-action" className="input" value={action} onChange={e => setAction(e.target.value)}>
            <option value="">All activity</option>
            {actions.map(a => <option key={a} value={a}>{meta(a).label}</option>)}
          </select>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={8} cols={3} />
        ) : data.length === 0 ? (
          <EmptyState icon={ScrollText} title="Nothing recorded yet"
            description={search || action
              ? "No entries match these filters."
              : "Sign-ins, credential changes and exports will appear here."} />
        ) : (
          <ul className="divide-y divide-border">
            {data.map(row => {
              const m = meta(row.action);
              const Icon = m.icon;
              return (
                <li key={row.id} className="px-4 py-3 flex items-start gap-3">
                  <span className={`icon-tile w-9 h-9 shrink-0 badge-${m.tone}`}>
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold text-fg text-sm">{m.label}</span>
                      {row.target && (
                        <span className="font-mono text-xs text-muted-fg truncate">{row.target}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-fg mt-0.5">
                      {row.actor_name || row.actor_id || "Unauthenticated"}
                      {row.actor_role && ` · ${row.actor_role}`}
                      {row.ip && ` · ${row.ip}`}
                    </p>
                    {row.detail && <p className="text-xs text-muted-fg mt-1 italic">{row.detail}</p>}
                  </div>
                  <time className="text-xs text-subtle-fg whitespace-nowrap shrink-0 tabular-nums"
                    dateTime={row.created_at}>
                    {row.created_at?.slice(5, 16).replace(" ", " · ")}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination page={page} pages={pages} total={total} pageSize={limit}
          onPage={setPage} noun="entries" />
      </Card>

      <p className="text-xs text-muted-fg mt-3">
        Times are UTC, matching how the database records them.
      </p>
    </div>
  );
}
