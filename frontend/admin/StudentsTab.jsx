import { useState } from "react";
import { GraduationCap, Search, KeyRound, Trash2, CheckCircle2, Clock } from "lucide-react";
import {
  Card, Badge, Button, ConfirmModal, EmptyState, SkeletonRows, Pagination,
} from "../SharedUI.jsx";
import DepartmentIcon, { shortDepartment, departmentColor } from "../ui/DepartmentIcon.jsx";
import { usePagedResource, useDebounced } from "./hooks.js";
import api, { apiError } from "../httpClient.js";

/**
 * Student accounts.
 *
 * Students self-register, so there is no card to issue — but a forgotten PIN
 * used to lock someone out with nobody able to help, since only the account
 * holder could set one. These give the administrator the same recourse they
 * have for faculty.
 */
export default function StudentsTab({ addToast }) {
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const debounced = useDebounced(search);
  const { data, total, pages, page, setPage, loading, limit, reload } =
    usePagedResource("/dean/students", { params: { search: debounced } });

  const run = async (action, student) => {
    setBusy(true);
    try {
      const path = `/admin/students/${encodeURIComponent(student.student_id)}`;
      const { data: body } = action === "pin"
        ? await api.post(`${path}/reset-pin`)
        : await api.delete(path);
      addToast(body.message, "success");
      setConfirm(null);
      reload();
    } catch (e) {
      addToast(apiError(e, "That didn't work."), "error");
    } finally { setBusy(false); }
  };

  const CONFIRMS = {
    pin: {
      title: "Reset this PIN?",
      body: s => `${s.full_name}'s PIN will be cleared. They choose a new one the next time they sign in — no one else can sign in as them in the meantime, because the account has no PIN to guess.`,
      label: "Reset PIN", tone: "danger",
    },
    remove: {
      title: "Remove this student?",
      body: s => `${s.full_name} and their consultation history will be deleted permanently. This cannot be undone; only the audit entry will remain.`,
      label: "Remove", tone: "danger",
    },
  };
  const active = confirm ? CONFIRMS[confirm.action] : null;

  return (
    <div className="animate-rise">
      <div className="relative mb-4 max-w-sm">
        <Search size={17} aria-hidden="true"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle-fg pointer-events-none" />
        {/* Searching queries the server. It used to filter only the twenty rows
            already loaded, so a student on page three was unfindable. */}
        <input className="input pl-11" placeholder="Search name or student ID…" value={search}
          onChange={e => setSearch(e.target.value)} aria-label="Search students" />
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={8} cols={4} />
        ) : data.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No students found"
            description={search ? `Nothing matches "${search}".` : "No students have registered yet."} />
        ) : (
          <>
            <ul className="sm:hidden divide-y divide-border">
              {data.map(s => (
                <li key={s.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-fg truncate">{s.full_name}</p>
                      <p className="text-xs font-mono text-muted-fg mt-0.5">{s.student_id}</p>
                    </div>
                    <Badge tone="info">{s.year_level}</Badge>
                  </div>
                  <p className="text-xs text-muted-fg mt-1.5 truncate">
                    {s.course} · {shortDepartment(s.department)}
                  </p>
                  <div className="mt-2"><PinState student={s} /></div>
                  <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-1.5">
                    <StudentActions student={s} onPick={a => setConfirm({ action: a, student: s })} />
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden sm:block table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Student ID</th>
                    <th scope="col">Name</th>
                    <th scope="col">Course</th>
                    <th scope="col">Year</th>
                    <th scope="col">Department</th>
                    <th scope="col">PIN</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(s => (
                    <tr key={s.id}>
                      <td className="font-mono text-xs font-semibold text-brand">{s.student_id}</td>
                      <td className="font-semibold">{s.full_name}</td>
                      <td className="text-muted-fg max-w-[180px] truncate">{s.course}</td>
                      <td><Badge tone="info">{s.year_level}</Badge></td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium"
                          style={{ background: departmentColor(s.department).tint,
                                   color: departmentColor(s.department).ink }}>
                          <DepartmentIcon department={s.department} size={13} />
                          {shortDepartment(s.department)}
                        </span>
                      </td>
                      <td><PinState student={s} /></td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <StudentActions student={s}
                            onPick={a => setConfirm({ action: a, student: s })} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <Pagination page={page} pages={pages} total={total} pageSize={limit}
          onPage={setPage} noun="students" />
      </Card>

      {active && (
        <ConfirmModal
          open
          onClose={() => setConfirm(null)}
          onConfirm={() => run(confirm.action, confirm.student)}
          title={active.title}
          description={active.body(confirm.student)}
          confirmLabel={active.label}
          tone={active.tone}
          loading={busy}
        />
      )}
    </div>
  );
}

/** Whether the account has a PIN — the thing a reset actually changes. */
function PinState({ student }) {
  const set = student.has_pin;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium
      ${set ? "text-success" : "text-muted-fg"}`}>
      {set ? <CheckCircle2 size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}
      {set ? "PIN set" : "No PIN yet"}
    </span>
  );
}

function StudentActions({ student, onPick }) {
  return (
    <>
      {student.has_pin && (
        <Button size="sm" icon={KeyRound} onClick={() => onPick("pin")}>Reset PIN</Button>
      )}
      <Button size="sm" icon={Trash2} onClick={() => onPick("remove")}>Remove</Button>
    </>
  );
}
