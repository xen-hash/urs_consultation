import { useState } from "react";
import { ClipboardList, Search, Archive, X, Trash2, HardDrive } from "lucide-react";
import {
  Card, Button, IconButton, RequestBadge, EmptyState, SkeletonRows, Pagination,
  Modal, ConfirmModal, Alert,
} from "../SharedUI.jsx";
import { shortDepartment } from "../ui/DepartmentIcon.jsx";
import { formatWhen } from "../ui/datetime.js";
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
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const debounced = useDebounced(search);

  const { data, total, pages, page, setPage, loading, limit, reload } =
    usePagedResource("/dean/requests", {
      params: { search: debounced, status, department, from, to },
    });

  const removeRow = async (row) => {
    setDeleteBusy(true);
    try {
      const { data } = await api.delete(`/teacher/requests/${row.id}`);
      addToast(data.message, "success");
      setConfirmDelete(null);
      reload(); onChanged?.();
    } catch (e) {
      addToast(apiError(e, "Could not delete that request."), "error");
    } finally { setDeleteBusy(false); }
  };

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
        <div className="ml-auto flex gap-2">
          <Button icon={Archive} onClick={() => setArchiveOpen(true)}>Archive…</Button>
          <Button variant="danger" icon={HardDrive} onClick={() => setPurgeOpen(true)}>
            Free space…
          </Button>
        </div>
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
                  <div className="flex items-end justify-between gap-3 mt-1.5">
                    <p className="text-xs text-subtle-fg min-w-0">
                      {r.category} · {shortDepartment(r.department)} · {formatWhen(r.request_time)}
                    </p>
                    <IconButton icon={Trash2} label={`Delete ${r.student_name}'s request`}
                      onClick={() => setConfirmDelete(r)}
                      className="shrink-0 -mr-2 -mb-2 hover:text-danger hover:bg-danger-50" size={16} />
                  </div>
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
                    <th scope="col"><span className="sr-only">Actions</span></th>
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
                      <td>
                        <IconButton icon={Trash2} label={`Delete ${r.student_name}'s request`}
                          onClick={() => setConfirmDelete(r)}
                          className="hover:text-danger hover:bg-danger-50" size={16} />
                      </td>
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

      <PurgeModal
        open={purgeOpen}
        onClose={() => setPurgeOpen(false)}
        addToast={addToast}
        onDone={() => { reload(); onChanged?.(); }}
      />

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => removeRow(confirmDelete)}
        title="Delete this request?"
        description={confirmDelete
          ? `${confirmDelete.student_name}'s request to ${confirmDelete.professor_name} will be removed for good, and will not appear in exports afterwards.`
          : ""}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteBusy}
      />
    </div>
  );
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

/**
 * The permanent half of archiving.
 *
 * Archiving is the right default — those rows are a record of consultations
 * that happened, and they stay in the exports. But it does not reclaim
 * anything, and on a free-tier database the ceiling is real. This is the
 * deliberate other option, with the same filters and no undo.
 *
 * A date range is required. An unbounded delete here would empty the table on
 * one mis-click, and "everything before last year" is what freeing space
 * actually means. The server enforces this too — the button is not the only
 * thing standing in front of it.
 */
function PurgeModal({ open, onClose, addToast, onDone }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/admin/requests/delete", { from, to, status });
      addToast(data.message, data.deleted ? "success" : "info");
      onDone();
      onClose();
    } catch (err) {
      addToast(apiError(err, "Could not delete those requests."), "error");
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} onSubmit={submit} anchor="center"
      title="Delete old requests"
      description="Frees the space they take up. There is no undo."
      footer={
        <>
          <Button type="button" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="danger" icon={Trash2} loading={busy}
            disabled={!from && !to}>
            {busy ? "Deleting…" : "Delete permanently"}
          </Button>
        </>
      }>
      <div className="space-y-4">
        <Alert tone="danger">
          These rows are removed from the database for good — they will not appear
          in exports or reports afterwards. To clear the lists while keeping the
          records, use Archive instead.
        </Alert>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pg-from" className="label">From</label>
            <input id="pg-from" type="date" className="input" value={from}
              onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pg-to" className="label">To</label>
            <input id="pg-to" type="date" className="input" value={to}
              onChange={e => setTo(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-fg -mt-1">
          Give at least one date. Everything on or before the "to" date is the
          usual way to clear out an old semester.
        </p>
        <div>
          <label htmlFor="pg-status" className="label">Only this status</label>
          <select id="pg-status" className="input" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="pending">Pending</option>
            <option value="done">Done</option>
            <option value="declined">Declined</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
