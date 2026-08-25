import { useState } from "react";
import { UserPlus, Plus, CheckCircle2, QrCode } from "lucide-react";
import { Card, CardHeader, Button, Alert } from "../SharedUI.jsx";
import { DEPARTMENTS } from "../constants.js";
import api, { apiError } from "../httpClient.js";

export default function AddTeacherTab({ addToast, onAdded, onGoToCredentials }) {
  const [form, setForm] = useState({ professor_name: "", department: "" });
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(null);

  const submit = async () => {
    if (!form.professor_name.trim() || !form.department) {
      return addToast("Enter a name and pick a department.", "warning");
    }
    setLoading(true);
    try {
      const { data } = await api.post("/dean/add-teacher", {
        professor_name: form.professor_name.trim(),
        department: form.department,
      });
      setAdded(data);
      setForm({ professor_name: "", department: "" });
      addToast("Faculty member added.", "success");
      onAdded?.();
    } catch (e) {
      addToast(apiError(e, "Could not add this faculty member."), "error");
    } finally { setLoading(false); }
  };

  return (
    <div className="animate-rise max-w-xl">
      <Card>
        <CardHeader title="Add a faculty member"
          subtitle="Creates the account. Issue their ID card afterwards."
          icon={UserPlus} />

        <div className="space-y-4">
          <div>
            <label htmlFor="new-name" className="label">Full name</label>
            <input id="new-name" className="input" placeholder="Engr. Maria Santos-Cruz"
              value={form.professor_name} autoCapitalize="words"
              onChange={e => setForm(p => ({ ...p, professor_name: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && submit()} />
            <p className="text-xs text-muted-fg mt-1.5">Include their title — Engr., Dr., Prof., AR.</p>
          </div>
          <div>
            <label htmlFor="new-dept" className="label">Department</label>
            <select id="new-dept" className="input" value={form.department}
              onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
              <option value="">Select a department</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {added && (
            <Alert tone="success" icon={CheckCircle2}>
              <p className="font-semibold">{added.professor_name} added — {added.employee_id}</p>
              <p className="mt-1">
                They cannot sign in until a Faculty ID card is issued.
              </p>
              <button onClick={onGoToCredentials}
                className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-2 mt-2">
                <QrCode size={13} aria-hidden="true" /> Go to Credentials to issue it
              </button>
            </Alert>
          )}

          <Button variant="primary" className="w-full" icon={Plus}
            loading={loading} onClick={submit}
            disabled={!form.professor_name.trim() || !form.department}>
            {loading ? "Adding…" : "Add faculty member"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
