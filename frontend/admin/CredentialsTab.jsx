import { useCallback, useEffect, useState } from "react";
import {
  QrCode, KeyRound, Ban, Undo2, Search, Printer, Download, AlertTriangle,
  CheckCircle2, CircleSlash, Clock, ShieldCheck, Trash2, X,
} from "lucide-react";
import {
  Card, Button, Modal, ConfirmModal, EmptyState, Skeleton, Alert, ConfirmMark,
} from "../SharedUI.jsx";
import { shortDepartment } from "../ui/DepartmentIcon.jsx";
import DepartmentChips, { DepartmentTile } from "./DepartmentChips.jsx";
import RemoveTeacherModal from "./RemoveTeacherModal.jsx";
import { useDebounced } from "./hooks.js";
import { DEPARTMENTS } from "../constants.js";
import api, { apiError } from "../httpClient.js";

/**
 * Faculty credential management.
 *
 * This is where issuing a Faculty ID card lives now. It used to be a public
 * endpoint on the teacher portal that handed anyone any professor's login
 * credential, which is the single worst hole this whole change closes.
 *
 * A card encodes a random serial, not the employee ID, and the serial is shown
 * exactly once — in the issue dialog. Issuing again rotates it, so printing a
 * replacement is also how a lost card gets revoked.
 */
export default function CredentialsTab({ addToast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);

  const [dept, setDept] = useState(null);       // null = all
  const [issued, setIssued] = useState(null);   // one-time card view
  const [confirm, setConfirm] = useState(null); // { action, teacher }
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/teachers", { params: { search: debounced } });
      setRows(data || []);
    } catch (e) {
      addToast(apiError(e, "Could not load faculty."), "error");
    } finally {
      setLoading(false);
    }
  }, [debounced, addToast]);

  useEffect(() => { load(); }, [load]);

  // Ordered by the roster in constants, so the chips keep the same order
  // whatever the search returns.
  const present = DEPARTMENTS.filter(d => rows.some(t => t.department === d));
  const cardedIn = d => rows.filter(t => (!d || t.department === d) && t.has_qr).length;
  const countIn  = d => rows.filter(t => !d || t.department === d).length;
  const chips = [null, ...present].map(id => ({ id, count: cardedIn(id), total: countIn(id) }));

  const visible = rows.filter(t => !dept || t.department === dept);

  const issue = async (teacher) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/teachers/${encodeURIComponent(teacher.employee_id)}/issue-qr`);
      setIssued(data);
      setConfirm(null);
      load();
    } catch (e) {
      addToast(apiError(e, "Could not issue the card."), "error");
    } finally { setBusy(false); }
  };

  const runAction = async (action, teacher) => {
    setBusy(true);
    const paths = {
      revoke: [`/admin/teachers/${encodeURIComponent(teacher.employee_id)}/revoke-qr`, {}],
      pin:    [`/admin/teachers/${encodeURIComponent(teacher.employee_id)}/reset-pin`, {}],
      off:    [`/admin/teachers/${encodeURIComponent(teacher.employee_id)}/active`, { active: false }],
      on:     [`/admin/teachers/${encodeURIComponent(teacher.employee_id)}/active`, { active: true }],
    };
    try {
      const [path, body] = paths[action];
      const { data } = await api.post(path, body);
      addToast(data.message, "success");
      setConfirm(null);
      load();
    } catch (e) {
      addToast(apiError(e, "That didn't work."), "error");
    } finally { setBusy(false); }
  };

  const CONFIRMS = {
    issue: {
      title: "Issue a new Faculty ID?",
      body: t => t.has_qr
        ? `${t.professor_name} already has an active card. Issuing a new one immediately stops the old card from working — do this if it was lost.`
        : `This creates ${t.professor_name}'s first Faculty ID card. The QR is shown once, so print or download it before closing.`,
      label: "Issue card", tone: "primary", run: issue,
    },
    revoke: {
      title: "Revoke this card?",
      body: t => `${t.professor_name}'s card will stop working immediately. They can still sign in with their Employee ID and PIN.`,
      label: "Revoke", tone: "danger", run: t => runAction("revoke", t),
    },
    pin: {
      title: "Reset this PIN?",
      body: t => `${t.professor_name}'s PIN will be cleared. They choose a new one the next time they scan their card.`,
      label: "Reset PIN", tone: "danger", run: t => runAction("pin", t),
    },
    off: {
      title: "Deactivate this account?",
      body: t => `${t.professor_name} will not be able to sign in, and their card is revoked at the same time.`,
      label: "Deactivate", tone: "danger", run: t => runAction("off", t),
    },
    on: {
      title: "Reactivate this account?",
      body: t => `${t.professor_name} will be able to sign in again. They will need a new card issued.`,
      label: "Reactivate", tone: "primary", run: t => runAction("on", t),
    },
  };

  const active = confirm ? CONFIRMS[confirm.action] : null;

  return (
    <div className="animate-rise">
      {/* Same search row, same chips, same rows as the Faculty tab. It is the
          same roster being looked at for a different reason, so it should not
          be a different-looking screen. */}
      <div className="relative mb-3 max-w-sm">
        <Search size={17} aria-hidden="true"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle-fg pointer-events-none" />
        <input className="input pl-11 pr-10" placeholder="Search faculty…" value={search}
          onChange={e => setSearch(e.target.value)} aria-label="Search faculty" />
        {search && (
          <button onClick={() => setSearch("")} aria-label="Clear search"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center text-muted-fg hover:text-fg">
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <DepartmentChips chips={chips} value={dept} onChange={setDept}
        label="Filter credentials by department" />

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="No faculty found"
            description={search ? `Nothing matches "${search}".` : "No faculty accounts yet."} />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-border">
            {visible.map(t => (
              <li key={t.employee_id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <DepartmentTile department={t.department} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-fg truncate">{t.professor_name}</p>
                    <p className="text-xs text-muted-fg truncate">
                      <span className="font-mono">{t.employee_id}</span> · {shortDepartment(t.department)}
                    </p>
                  </div>
                  <div className="hidden sm:block shrink-0">
                    <StateBadges teacher={t} />
                  </div>
                </div>

                <div className="sm:hidden mt-2.5 pl-12">
                  <StateBadges teacher={t} />
                </div>

                <div className="mt-2.5 pl-12 sm:pl-0">
                  <RowActions
                    teacher={t}
                    onPick={(action) => action === "remove"
                      ? setRemoving(t)
                      : setConfirm({ action, teacher: t })}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {active && (
        <ConfirmModal
          open
          onClose={() => setConfirm(null)}
          onConfirm={() => active.run(confirm.teacher)}
          title={active.title}
          description={active.body(confirm.teacher)}
          confirmLabel={active.label}
          tone={active.tone}
          loading={busy}
        />
      )}

      <RemoveTeacherModal
        teacher={removing}
        onClose={() => setRemoving(null)}
        onRemoved={(message) => { setRemoving(null); addToast(message, "success"); load(); }}
        addToast={addToast}
      />

      <IssuedCardModal card={issued} onClose={() => setIssued(null)} />
    </div>
  );
}

/**
 * Credential state for one faculty member.
 *
 * These were filled pills sitting inline with the row's buttons, at the same
 * size and roundness — "No card" looked like something you press to fix it.
 * Status now reads as status: no fill, no border, muted label with a coloured
 * icon carrying the meaning, and laid out as a metadata line separated from the
 * actions.
 */
function StateBadges({ teacher }) {
  if (teacher.active === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger">
        <CircleSlash size={14} aria-hidden="true" />
        Deactivated
      </span>
    );
  }

  const states = [
    {
      ok: teacher.has_qr,
      icon: teacher.has_qr ? CheckCircle2 : QrCode,
      label: teacher.has_qr ? "Card active" : "No card yet",
    },
    {
      ok: teacher.has_pin,
      icon: teacher.has_pin ? CheckCircle2 : Clock,
      label: teacher.has_pin ? "PIN set" : "No PIN yet",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {states.map(s => (
        <span key={s.label}
          className={`inline-flex items-center gap-1.5 text-xs font-medium
            ${s.ok ? "text-success" : "text-muted-fg"}`}>
          <s.icon size={14} aria-hidden="true" className="shrink-0" />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function RowActions({ teacher, onPick }) {
  const off = teacher.active === false;
  return (
    <div className="flex flex-wrap gap-1.5">
      {!off && (
        <>
          <Button size="sm" variant="primary" icon={QrCode} onClick={() => onPick("issue")}>
            {teacher.has_qr ? "Reissue" : "Issue card"}
          </Button>
          {teacher.has_qr && (
            <Button size="sm" icon={Ban} onClick={() => onPick("revoke")}>Revoke</Button>
          )}
          {teacher.has_pin && (
            <Button size="sm" icon={KeyRound} onClick={() => onPick("pin")}>Reset PIN</Button>
          )}
          <Button size="sm" icon={CircleSlash} onClick={() => onPick("off")}>Deactivate</Button>
        </>
      )}
      {off && <Button size="sm" icon={Undo2} onClick={() => onPick("on")}>Reactivate</Button>}
      {/* Removal is the one action here with no undo, so it sits apart from the
          rest and states what it is rather than sharing their neutral styling. */}
      <Button size="sm" variant="ghost" icon={Trash2} onClick={() => onPick("remove")}
        className="text-danger hover:bg-danger-50">
        Remove
      </Button>
    </div>
  );
}

/* The one-time card view. Everything needed to hand a physical card over. */
function IssuedCardModal({ card, onClose }) {
  if (!card) return null;

  const download = () => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${card.qr_base64}`;
    a.download = `faculty-id-${card.employee_id}.png`;
    a.click();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          <span className="text-success"><ConfirmMark size={17} /></span>
          Faculty ID issued
        </span>
      }
      label="Faculty ID issued"
      description={card.professor_name}
      size="md"
      footer={
        <>
          <Button icon={Download} onClick={download}>Download QR</Button>
          <Button variant="primary" icon={Printer} onClick={() => window.print()}>Print</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert tone={card.replaced ? "warning" : "info"}
          icon={card.replaced ? AlertTriangle : ShieldCheck}>
          {card.replaced
            ? "The previous card has been revoked and will no longer scan. Make sure this replacement reaches them."
            : "This QR is shown once and cannot be retrieved later. Print or download it now — if it is lost, issue a new card."}
        </Alert>

        {/* The printable card. The .print-card hook is what the print
            stylesheet in index.css isolates; without it the Print button hands
            the printer the whole dashboard. */}
        <div className="print-card rounded-xl border border-border overflow-hidden">
          <div className="bg-brand-900 text-white px-5 py-4">
            <p className="font-semibold text-sm">University of Rizal System</p>
            <p className="text-white/60 text-xs">College of Engineering — Faculty ID</p>
          </div>
          <div className="p-5 flex flex-col xs:flex-row gap-5 items-center bg-surface">
            <img
              src={`data:image/png;base64,${card.qr_base64}`}
              alt={`Faculty ID QR code for ${card.professor_name}`}
              className="w-40 h-40 shrink-0"
            />
            <dl className="text-sm min-w-0 space-y-2 text-center xs:text-left">
              <div>
                <dt className="text-xs text-muted-fg uppercase tracking-wide">Name</dt>
                <dd className="font-semibold text-fg">{card.professor_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-fg uppercase tracking-wide">Employee ID</dt>
                <dd className="font-mono font-semibold text-fg">{card.employee_id}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-fg uppercase tracking-wide">Department</dt>
                <dd className="text-muted-fg">{card.department}</dd>
              </div>
            </dl>
          </div>
        </div>

        <p className="text-xs text-muted-fg">
          Tell them to scan this at the Faculty Portal and set a PIN on first use.
        </p>
      </div>
    </Modal>
  );
}
