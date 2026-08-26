import { useEffect, useRef, useState } from "react";
import { Plus, CheckCircle2, QrCode, AlertTriangle, Undo2 } from "lucide-react";
import { Modal, Button, Alert } from "../SharedUI.jsx";
import { DEPARTMENTS } from "../constants.js";
import api, { apiError } from "../httpClient.js";

/**
 * Adding a faculty member: a form, in a modal.
 *
 * A real <form> rather than a box with a button — the modal panel *is* the form
 * element, so Enter submits from either field, the footer's button belongs to
 * the fields above it, and the browser's own autofill behaves. Validation
 * speaks in the form, next to what is wrong, rather than as a toast in a corner
 * that has to be read before it fades.
 *
 * Centred rather than rising from the bottom edge: an edge-anchored panel reads
 * as an action sheet, and it puts the fields exactly where the phone keyboard
 * opens.
 */
export default function AddFacultyForm({ open, onClose, addToast, onAdded, onGoToCredentials }) {
  const [form, setForm] = useState({
    professor_name: "", department: "", email: "", staff_no: "", position: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(null);
  // Set when the name matches an account that was removed on purpose. Bringing
  // it back is a decision, not a side effect of typing the same name again.
  const [removed, setRemoved] = useState(null);
  const nameField = useRef(null);

  // Reopening should be a blank form, not the last one's leftovers.
  useEffect(() => {
    if (!open) return;
    setForm({ professor_name: "", department: "", email: "", staff_no: "", position: "" });
    setError(null);
    setAdded(null);
    setRemoved(null);
    const t = setTimeout(() => nameField.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  const set = (key) => (e) => {
    setForm(p => ({ ...p, [key]: e.target.value }));
    setError(null);
  };

  const send = async (extra = {}) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post("/dean/add-teacher", {
        professor_name: form.professor_name.trim(),
        department: form.department,
        email: form.email.trim(),
        staff_no: form.staff_no.trim(),
        position: form.position.trim(),
        ...extra,
      });
      setAdded(data);
      setRemoved(null);
      // The department stays selected: a department's staff are added in a run,
      // and re-picking it every time is the tedious part.
      setForm(p => ({ ...p, professor_name: "", email: "", staff_no: "" }));
      addToast(data.message, "success");
      onAdded?.();
      nameField.current?.focus();
    } catch (err) {
      // The server distinguishes "this name is taken" from "this name belonged
      // to someone you removed", and only the second one offers a way forward.
      const payload = err?.response?.data;
      if (payload?.removed_account) setRemoved(payload.removed_account);
      setError(apiError(err, "Could not add this faculty member."));
    } finally {
      setLoading(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.professor_name.trim()) return setError("Enter the faculty member's full name.");
    if (!form.department) return setError("Pick a department.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Enter their work email address.");
    if (!form.staff_no.trim()) return setError("Enter their staff or employee number.");
    send();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      onSubmit={submit}
      anchor="center"
      title="Add a faculty member"
      description="Creates the account. Issue their ID card afterwards."
      footer={
        <>
          <Button type="button" onClick={onClose} disabled={loading}>
            {added ? "Done" : "Cancel"}
          </Button>
          <Button type="submit" variant="primary" icon={Plus} loading={loading}
            disabled={!form.professor_name.trim() || !form.department
                      || !form.email.trim() || !form.staff_no.trim()}>
            {loading ? "Adding…" : "Add faculty member"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="new-name" className="label">Full name</label>
          <input
            id="new-name"
            ref={nameField}
            className="input"
            placeholder="Engr. Maria Santos-Cruz"
            value={form.professor_name}
            onChange={set("professor_name")}
            autoCapitalize="words"
            autoComplete="off"
            spellCheck="false"
            aria-describedby="new-name-hint"
          />
          <p id="new-name-hint" className="text-xs text-muted-fg mt-1.5">
            Include their title — Engr., Dr., Prof., AR.
          </p>
        </div>

        <div>
          <label htmlFor="new-dept" className="label">Department</label>
          <select id="new-dept" className="input" value={form.department}
            onChange={set("department")}>
            <option value="">Select a department</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* A name is not an identity: two professors can share one, and the
            account ID is built from the name and department. These are what
            keep them apart, so both are required. */}
        <div>
          <label htmlFor="new-email" className="label">Work email</label>
          <input id="new-email" type="email" className="input"
            placeholder="m.santos@urs.edu.ph"
            value={form.email} onChange={set("email")}
            autoComplete="off" autoCapitalize="none" spellCheck="false" />
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
          <div>
            <label htmlFor="new-staff" className="label">Staff number</label>
            <input id="new-staff" className="input font-mono" placeholder="URS-2019-0412"
              value={form.staff_no} onChange={set("staff_no")}
              autoComplete="off" autoCapitalize="characters" spellCheck="false" />
          </div>
          <div>
            <label htmlFor="new-position" className="label">
              Position <span className="font-normal normal-case text-subtle-fg">(optional)</span>
            </label>
            <input id="new-position" className="input" placeholder="Associate Professor"
              value={form.position} onChange={set("position")}
              autoComplete="off" autoCapitalize="words" />
          </div>
        </div>

        {error && <Alert tone="danger">{error}</Alert>}

        {removed && (
          <Alert tone="warning" icon={AlertTriangle}>
            <p className="font-semibold">
              This account was removed on {removed.removed_at}
              {removed.removed_reason ? ` — "${removed.removed_reason}"` : ""}
            </p>
            <p className="mt-1">
              Restoring brings back {removed.professor_name}'s old account and its
              history. They will have no card and no PIN. If this is a different
              person with the same name, close this and add their middle initial
              so the two can be told apart.
            </p>
            <Button type="button" size="sm" variant="primary" icon={Undo2}
              className="mt-2.5" loading={loading}
              onClick={() => send({ restore: true })}>
              Restore this account
            </Button>
          </Alert>
        )}

        {added && (
          <Alert tone="success" icon={CheckCircle2}>
            <p className="font-semibold">{added.professor_name} added — {added.employee_id}</p>
            <p className="mt-1">They cannot sign in until a Faculty ID card is issued.</p>
            <button type="button" onClick={onGoToCredentials}
              className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-2 mt-2">
              <QrCode size={13} aria-hidden="true" /> Go to Credentials to issue it
            </button>
          </Alert>
        )}
      </div>
    </Modal>
  );
}
