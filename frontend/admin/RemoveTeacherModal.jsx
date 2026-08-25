import { useEffect, useRef, useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Modal, Button, Alert } from "../SharedUI.jsx";
import api, { apiError } from "../httpClient.js";

/**
 * Removing a faculty account, with the reason on the record.
 *
 * The reason is required, not optional. This is the one action in the dashboard
 * that cannot be undone from the dashboard, and "why is this professor gone" is
 * a question asked months later, by which time whoever did it has forgotten. So
 * it is asked at the time and written into the audit log beside who did it.
 *
 * The quick reasons are shortcuts into the same field, not a fixed list —
 * circumstances are rarely one of five options, and a free-text line that can be
 * edited afterwards beats a dropdown that forces the nearest wrong answer.
 */

const QUICK = ["Resigned", "Retired", "Transferred to another campus",
               "No longer teaching", "Added by mistake"];

export default function RemoveTeacherModal({ teacher, onClose, onRemoved }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const field = useRef(null);

  useEffect(() => {
    if (!teacher) return;
    setReason(""); setError(null);
    const t = setTimeout(() => field.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [teacher]);

  if (!teacher) return null;

  const submit = async (e) => {
    e.preventDefault();
    const why = reason.trim();
    if (why.length < 4) return setError("Say why this account is being removed.");

    setLoading(true);
    setError(null);
    try {
      const { data } = await api.delete(
        `/admin/teachers/${encodeURIComponent(teacher.employee_id)}`,
        { data: { reason: why } }
      );
      onRemoved(data.message);
    } catch (err) {
      setError(apiError(err, "Could not remove this account."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      onSubmit={submit}
      anchor="center"
      size="md"
      title={`Remove ${teacher.professor_name}?`}
      description={`${teacher.employee_id} · ${teacher.department}`}
      footer={
        <>
          <Button type="button" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" variant="danger" icon={Trash2} loading={loading}
            disabled={reason.trim().length < 4}>
            {loading ? "Removing…" : "Remove account"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert tone="warning" icon={AlertTriangle}>
          Their card and PIN stop working immediately and they disappear from the
          faculty list. Consultations they have already handled stay in the
          records — those are the students' history too.
        </Alert>

        <div>
          <label htmlFor="remove-reason" className="label">
            Why are you removing this account?
          </label>
          <input
            id="remove-reason"
            ref={field}
            className="input"
            value={reason}
            onChange={e => { setReason(e.target.value); setError(null); }}
            placeholder="e.g. Resigned at the end of the semester"
            maxLength={500}
            aria-describedby="remove-reason-hint"
          />
          <p id="remove-reason-hint" className="text-xs text-muted-fg mt-1.5">
            Saved to the audit log with your name and the date.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {QUICK.map(q => (
            <button key={q} type="button" onClick={() => { setReason(q); setError(null); }}
              className={`px-3 min-h-[36px] rounded-full border text-xs font-medium
                transition-colors duration-150
                ${reason === q
                  ? "border-transparent bg-brand text-white"
                  : "border-border bg-surface text-muted-fg hover:bg-surface-2 hover:text-fg"}`}>
              {q}
            </button>
          ))}
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
