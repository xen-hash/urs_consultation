import { useEffect, useRef, useState } from "react";
import { Plus, CheckCircle2, QrCode } from "lucide-react";
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
  const [form, setForm] = useState({ professor_name: "", department: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(null);
  const nameField = useRef(null);

  // Reopening should be a blank form, not the last one's leftovers.
  useEffect(() => {
    if (!open) return;
    setForm({ professor_name: "", department: "" });
    setError(null);
    setAdded(null);
    const t = setTimeout(() => nameField.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  const set = (key) => (e) => {
    setForm(p => ({ ...p, [key]: e.target.value }));
    setError(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    const name = form.professor_name.trim();
    if (!name) return setError("Enter the faculty member's full name.");
    if (!form.department) return setError("Pick a department.");

    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post("/dean/add-teacher", {
        professor_name: name,
        department: form.department,
      });
      setAdded(data);
      // The department stays selected: a department's staff are added in a run,
      // and re-picking it every time is the tedious part.
      setForm(p => ({ ...p, professor_name: "" }));
      addToast("Faculty member added.", "success");
      onAdded?.();
      nameField.current?.focus();
    } catch (err) {
      setError(apiError(err, "Could not add this faculty member."));
    } finally {
      setLoading(false);
    }
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
            disabled={!form.professor_name.trim() || !form.department}>
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

        {error && <Alert tone="danger">{error}</Alert>}

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
