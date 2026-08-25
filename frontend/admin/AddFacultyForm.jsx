import { useEffect, useRef, useState } from "react";
import { UserPlus, Plus, CheckCircle2, QrCode, X } from "lucide-react";
import { Button, IconButton, Alert } from "../SharedUI.jsx";
import { DEPARTMENTS } from "../constants.js";
import api, { apiError } from "../httpClient.js";

/**
 * Adding a faculty member, as a form on the page.
 *
 * This used to be a modal, which on a phone meant a sheet covering the roster
 * with two fields floating in it — the keyboard then took most of what was
 * left, so the submit button sat under it and the list you were adding to was
 * hidden behind. A form belongs in the page: it opens above the roster, scrolls
 * with it, and closes back to the list it just changed.
 *
 * A real <form>, too, not a div with a button: Enter submits, the browser
 * handles required fields, and password managers and autofill behave.
 */
export default function AddFacultyForm({ onClose, addToast, onAdded, onGoToCredentials }) {
  const [form, setForm] = useState({ professor_name: "", department: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(null);
  const panel = useRef(null);
  const nameField = useRef(null);

  // Opening it from a button lower down the page would otherwise leave the form
  // off-screen above you, looking like nothing happened.
  useEffect(() => {
    panel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    nameField.current?.focus({ preventScroll: true });
  }, []);

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
      // The department stays selected: adding a department's staff is done in a
      // run, and re-picking it every time is the tedious part.
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
    <section ref={panel} className="card p-0 overflow-hidden mb-4 animate-rise"
      aria-labelledby="add-faculty-heading">
      <form onSubmit={submit} noValidate>
        <header className="flex items-start gap-3 px-4 sm:px-5 py-4 border-b border-border">
          <span className="icon-tile icon-tile-brand w-10 h-10 shrink-0">
            <UserPlus size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="add-faculty-heading" className="font-semibold text-fg">Add a faculty member</h3>
            <p className="text-sm text-muted-fg mt-0.5">
              Creates the account. Issue their ID card afterwards.
            </p>
          </div>
          <IconButton icon={X} label="Cancel" onClick={onClose} type="button"
            className="-mr-2 -mt-1.5" size={17} />
        </header>

        <div className="px-4 sm:px-5 py-5 space-y-4">
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

        <div className="px-4 sm:px-5 py-4 border-t border-border bg-surface-2/50
                        flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" onClick={onClose} disabled={loading}>
            {added ? "Done" : "Cancel"}
          </Button>
          <Button type="submit" variant="primary" icon={Plus} loading={loading}
            disabled={!form.professor_name.trim() || !form.department}>
            {loading ? "Adding…" : "Add faculty member"}
          </Button>
        </div>
      </form>
    </section>
  );
}
