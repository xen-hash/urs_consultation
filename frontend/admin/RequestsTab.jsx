import { useState } from "react";
import { ClipboardList, Search, Archive, X } from "lucide-react";
import {
  Card, Button, RequestBadge, EmptyState, SkeletonRows, Pagination, Modal, Alert,
} from "../SharedUI.jsx";
import { shortDepartment } from "../ui/DepartmentIcon.jsx";
import { usePagedResource, useDebounced } from "./hooks.js";
import { DEPARTMENTS } from "../constants.js";
import api, { apiError } from "../httpClient.js";

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "done", label: "Done" },
  { value: "declined", label: "Declined" },
  { value: "archived", label: "Archived" },
];

export default function RequestsTab({ addToast, onChanged }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const debounced = useDebounced(search);

  const { data, total, pages, page, setPage, loading, limit, reload } =
    usePagedResource("/dean/requests", {
      params: { search: debounced, status, department, from, to },
    });

  const anyFilter = search || status || department || from || to;
  const clearFilters = () => {
    setSearch(""); setStatus(""); setDepartment(""); setFrom(""); setTo("");
  };

  return (
    <div className="animate-rise">
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[190px] max-w-xs">
          <Search size={17} aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle-fg pointer-events-none" />
          <input className="input pl-11" placeholder="Student or faculty…" value={search}
            onChange={e => setSearch(e.target.value)} aria-label="Search requests" />
        </div>
        <select className="input w-auto min-w-[150px]" value={status}
          onChange={e => setStatus(e.target.value)} aria-label="Filter by status">
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="input w-auto min-w-[160px]" value={department}
          onChange={e => setDepartment(e.target.value)} aria-label="Filter by department">
          <option value="">All departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{shortDepartment(d)}</option>)}
        </select>
        <input type="date" className="input w-auto" value={from}
          onChange={e => setFrom(e.target.value)} aria-label="From date" />
        <input type="date" className="input w-auto" value={to}
          onChange={e => setTo(e.target.value)} aria-label="To date" />
        {anyFilter && (
          <Button icon={X} onClick={clearFilters}>Clear</Button>
        )}
        <Button variant="danger" icon={Archive} className="ml-auto"
          onClick={() => setArchiveOpen(true)}>
          Archive…
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={8} cols={5} />
        ) : data.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No requests"
            description={anyFilter ? "Nothing matches these filters." : "No consultation requests yet."} />
        ) : (
          <>
            <ul className="sm:hidden divide-y divide-border">
              {data.map(r => (
                <li key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-fg truncate">{r.student_name}</p>
                      <p className="text-xs text-muted-fg truncate">to {r.professor_name}</p>
                    </div>
                    <RequestBadge status={r.status} hasAppointment={!!r.appointment_date} />
                  </div>
                  <p className="text-sm text-muted-fg italic line-clamp-2">"{r.purpose}"</p>
                  <p className="text-xs text-subtle-fg mt-1.5">
                    {r.category} · {shortDepartment(r.department)} · {formatWhen(r.request_time)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="hidden sm:block table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">Faculty</th>
                    <th scope="col">Department</th>
                    <th scope="col">Purpose</th>
                    <th scope="col">Status</th>
                    <th scope="col">When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(r => (
                    <tr key={r.id}>
                      <td className="font-semibold">{r.student_name}</td>
                      <td className="text-muted-fg">{r.professor_name}</td>
                      <td className="text-muted-fg">{shortDepartment(r.department)}</td>
                      <td className="max-w-[220px]">
                        <p className="truncate italic text-muted-fg">"{r.purpose}"</p>
                        <p className="text-xs text-subtle-fg">{r.category}</p>
                      </td>
                      <td><RequestBadge status={r.status} hasAppointment={!!r.appointment_date} /></td>
                      <td className="text-xs text-muted-fg whitespace-nowrap">{formatWhen(r.request_time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {/* This pagination used to render outside its tab, so it appeared on
            every screen including the overview. */}
        <Pagination page={page} pages={pages} total={total} pageSize={limit}
          onPage={setPage} noun="requests" />
      </Card>

      <ArchiveModal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        addToast={addToast}
        onDone={() => { reload(); onChanged?.(); }}
      />
    </div>
  );
}

function formatWhen(value) {
  if (!value) return "—";
  return new Date(value.replace(" ", "T")).toLocaleString("en-PH", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Archiving replaces the old "Delete All" button, which called
 * /api/teacher/clear-logs — an endpoint that also emptied teacher_logs, wiping
 * every professor's saved schedule along with the requests. Archived rows drop
 * out of the active views but stay in the database and the exports.
 */
function ArchiveModal({ open, onClose, addToast, onDone }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/requests/archive", { from, to, status });
      addToast(data.message, "success");
      onDone();
      onClose();
    } catch (e) {
      addToast(apiError(e, "Could not archive."), "error");
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Archive consultation requests"
      description="Archived requests leave the active lists but stay in the database and exports."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" onClick={submit} loading={busy}>Archive</Button>
        </>
      }>
      <div className="space-y-4">
        <Alert tone="warning">
          Leave the fields empty to archive every active request. This does not
          touch faculty schedules.
        </Alert>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ar-from" className="label">From</label>
            <input id="ar-from" type="date" className="input" value={from}
              onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="ar-to" className="label">To</label>
            <input id="ar-to" type="date" className="input" value={to}
              onChange={e => setTo(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="ar-status" className="label">Only this status</label>
          <select id="ar-status" className="input" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="pending">Pending</option>
            <option value="done">Done</option>
            <option value="declined">Declined</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
