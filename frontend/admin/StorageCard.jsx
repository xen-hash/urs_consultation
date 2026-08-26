import { useCallback, useEffect, useState } from "react";
import { HardDrive, Recycle } from "lucide-react";
import { Card, CardHeader, Button, Skeleton, ConfirmModal } from "../SharedUI.jsx";
import api, { apiError } from "../httpClient.js";

/**
 * What the database is actually holding, and the button that hands space back.
 *
 * Deleting students and requests does not shrink a Postgres database — the rows
 * are marked dead and the file stays the size it was. Nothing in the admin
 * screens said so, which made a filling database look like a system ignoring
 * every deletion. This shows where the space went and reclaims it on demand.
 */

const FREE_TIER_BYTES = 512 * 1024 * 1024;   // Neon's free plan, for the bar.

function readable(bytes) {
  if (!bytes) return "0 MB";
  const mb = bytes / 1024 / 1024;
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

// The tables anyone here would recognise; the rest are lumped into "other" so
// the list stays four rows rather than a schema dump.
const LABELS = {
  students: "Students (photos)",
  teacher_accounts: "Faculty (photos)",
  consultation_requests: "Consultation requests",
  audit_log: "Activity log",
};

export default function StorageCard({ addToast }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/storage");
      setUsage(data);
    } catch { /* keep the last good reading */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reclaim = async () => {
    setWorking(true);
    try {
      const { data } = await api.post("/admin/storage/reclaim");
      const freed = readable(data.freed_bytes);
      addToast?.(
        data.freed_bytes > 0
          ? `${freed} freed${data.audit_rows_pruned ? `, ${data.audit_rows_pruned} old log entries removed` : ""}.`
          : "Nothing left to reclaim — the database is already compact.",
        "success"
      );
      setUsage(u => (u ? { ...u, total_bytes: data.after_bytes } : u));
      load();
    } catch (e) {
      addToast?.(apiError(e, "Could not reclaim space."), "error");
    } finally {
      setWorking(false);
      setAsking(false);
    }
  };

  const total = usage?.total_bytes || 0;
  const pct = Math.min(100, Math.round((total / FREE_TIER_BYTES) * 100));
  const rows = (usage?.tables || [])
    .filter(t => LABELS[t.table] && t.bytes > 0)
    .slice(0, 4);

  return (
    <Card>
      <CardHeader title="Database storage" subtitle="Space used, and freeing it" icon={HardDrive} />

      {loading ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-2xl font-bold text-fg tabular-nums">{readable(total)}</p>
            <p className="text-xs text-muted-fg">{pct}% of 512 MB</p>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500
                ${pct >= 85 ? "bg-danger" : pct >= 60 ? "bg-warning" : "bg-success"}`}
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>

          {rows.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {rows.map(t => (
                <li key={t.table} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-fg truncate">{LABELS[t.table]}</span>
                  <span className="text-fg tabular-nums shrink-0">{readable(t.bytes)}</span>
                </li>
              ))}
            </ul>
          )}

          <Button className="w-full justify-start mt-4" icon={Recycle}
            loading={working} onClick={() => setAsking(true)}>
            Reclaim space
          </Button>

          {/* Says the thing the button cannot: deleting alone never shrinks it. */}
          <p className="text-xs text-muted-fg mt-3 leading-relaxed">
            Deleting students or requests marks the space free but does not hand it
            back. This returns it, and clears activity-log entries older than{" "}
            {usage?.audit?.retention_days ?? 365} days.
          </p>
        </>
      )}

      <ConfirmModal
        open={asking}
        onClose={() => setAsking(false)}
        onConfirm={reclaim}
        loading={working}
        tone="primary"
        title="Reclaim database space?"
        confirmLabel="Reclaim space"
        description={
          "Each table is rewritten to give its free space back, which takes a few " +
          "seconds and briefly locks that table — best done outside consultation hours. " +
          "Nothing that is still in use is deleted. On Neon the figure on your dashboard " +
          "catches up once its history window passes, so it may not drop straight away."
        }
      />
    </Card>
  );
}
