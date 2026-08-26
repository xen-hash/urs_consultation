import { useCallback, useEffect, useRef, useState } from "react";
import { Users, Circle, RefreshCw } from "lucide-react";
import { Card, CardHeader, Button, Skeleton, EmptyState, Alert } from "../SharedUI.jsx";
import { formatAgo, formatDuration, formatDateTime } from "../ui/datetime.js";
import api, { isUnreachable } from "../httpClient.js";

/**
 * Who is on the system right now, and how long they have been.
 *
 * The dashboard could say how many students had accounts and how many requests
 * they had filed, but nothing about whether anyone was using it — so a quiet
 * afternoon and an outage looked the same from here, and there was no way to
 * tell whether it was worth watching the queue.
 *
 * "Online" is the last few minutes of actual API activity, written on any
 * authenticated student request. It is not a socket: a phone that locks, a tab
 * that closes and a student who walks away all drop off the list by
 * themselves, which is the behaviour that matches what an administrator means
 * by the question.
 */

const POLL_MS = 30000;

/**
 * Faculty and administrators are not counted — this is deliberately students.
 *
 * `offline` is the whole dashboard already reporting that nothing reached the
 * server. This card then says nothing about it: five panels each announcing the
 * same outage in their own words is noise, and it buries the one message that
 * explains all of them.
 */
export default function ActiveStudentsCard({ offline = false }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  // A ref rather than state, for the same reason StorageCard uses one: reading
  // the loaded data inside the callback would change its identity on every
  // success and re-fire the effect that depends on it.
  const everLoaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/active-students");
      setUsage(data);
      everLoaded.current = true;
      setUnavailable(false);
    } catch (e) {
      // A 404 is this card's own problem to explain: right after a merge Vercel
      // has the new frontend while Render is still serving the previous
      // backend, so the route genuinely is not there yet. Anything that never
      // reached a server is the dashboard's outage, not this card's, and the
      // banner above already says so.
      if (!everLoaded.current) setUnavailable(!isUnreachable(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, [load]);

  const online = usage?.online ?? 0;
  const rows = usage?.students || [];

  if (loading) {
    return (
      <Card>
        <CardHeader title="Students online" subtitle="Right now" icon={Users} />
        <Skeleton className="h-24 rounded-lg" />
      </Card>
    );
  }

  if (offline) {
    return (
      <Card>
        <CardHeader title="Students online" subtitle="Right now" icon={Users} />
        <p className="text-sm text-muted-fg">Waiting for the server.</p>
      </Card>
    );
  }

  if (unavailable) {
    return (
      <Card>
        <CardHeader title="Students online" subtitle="Right now" icon={Users} />
        <Alert tone="warning">
          Activity figures aren't available from the server yet. If the backend was
          just updated it may still be restarting.
        </Alert>
        <Button className="w-full justify-start mt-3" icon={RefreshCw}
          onClick={() => { setLoading(true); load(); }}>
          Try again
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-5 pb-0">
        <CardHeader
          title="Students online"
          subtitle={`Active in the last ${usage?.window_minutes ?? 5} minutes`}
          icon={Users}
          action={
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold
              ${online > 0 ? "text-success" : "text-muted-fg"}`}>
              <Circle size={8} aria-hidden="true"
                className={online > 0 ? "fill-current animate-pulse" : "fill-current"} />
              {online > 0 ? "Live" : "Quiet"}
            </span>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-5">
          <Figure label="Online now" value={online} />
          <Figure label="Today" value={usage?.today ?? 0} />
          <Figure label="Past 7 days" value={usage?.week ?? 0} />
          <Figure label="Avg. visit today"
            value={formatDuration(usage?.avg_minutes_today)} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="Nobody has signed in yet"
          description="Students appear here as soon as they start using the app." />
      ) : (
        <ul className="divide-y divide-border border-t border-border max-h-80 overflow-y-auto">
          {rows.map(s => (
            <li key={s.student_id} className="px-5 py-2.5 flex items-center gap-3">
              <Circle
                size={8} aria-hidden="true"
                className={`shrink-0 fill-current ${s.online ? "text-success" : "text-subtle-fg"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg truncate">
                  {s.full_name}
                  {!s.verified && (
                    <span className="ml-2 text-[11px] font-semibold text-warning-fg">
                      not confirmed
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-fg truncate">
                  {s.student_id}{s.course ? ` · ${s.course}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                {/* On for a live session, the length of the last one otherwise —
                    an administrator reading this wants the duration either way. */}
                <p className={`text-xs tabular-nums ${s.online ? "text-success" : "text-muted-fg"}`}>
                  {formatDuration(s.minutes_active)}
                </p>
                <p className="text-[11px] text-subtle-fg" title={formatDateTime(s.last_seen)}>
                  {s.online ? "on now" : formatAgo(s.last_seen)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-fg px-5 py-3 border-t border-border leading-relaxed">
        Counted from real activity, not from open tabs — a student who closes the
        app drops off within {usage?.window_minutes ?? 5} minutes. A visit ends
        after 15 minutes of nothing.
      </p>
    </Card>
  );
}

function Figure({ label, value }) {
  return (
    <div>
      <p className="text-2xl font-bold text-fg tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-fg uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}
