import { useEffect, useState } from "react";
import { ScrollText, Search, CloudOff } from "lucide-react";
import { Card, Badge, EmptyState, SkeletonRows, Pagination } from "../SharedUI.jsx";
import { usePagedResource, useDebounced } from "./hooks.js";
import { meta } from "./AuditFeed.jsx";
import { formatWhen, formatDateTime } from "../ui/datetime.js";
import api, { isUnreachable } from "../httpClient.js";

/**
 * The audit trail.
 *
 * Nothing recorded who did what before this, so an account takeover left no
 * trace to investigate. Every login, card issuance, revocation, PIN reset,
 * export and archive lands here with an actor and an IP.
 */

export default function AuditTab() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [actions, setActions] = useState([]);
  const debounced = useDebounced(search);

  const { data, total, pages, page, setPage, loading, limit, error } =
    usePagedResource("/admin/audit", { params: { search: debounced, action }, limit: 25 });
  const offline = !!error && isUnreachable(error);

  // The action list comes back with the first page; keep it stable so the
  // filter dropdown doesn't shrink to whatever the current page happens to hold.
  useEffect(() => {
    api.get("/admin/audit", { params: { limit: 1 } })
      .then(({ data: body }) => setActions(body.actions || []))
      .catch(() => {});
  }, []);

  return (
    <div className="animate-rise">
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={17} aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle-fg pointer-events-none" />
          <input className="input pl-11" placeholder="Search by person…" value={search}
            onChange={e => setSearch(e.target.value)} aria-label="Search audit log" />
        </div>
        <div className="min-w-[180px]">
          <label htmlFor="audit-action" className="sr-only">Filter by action</label>
          <select id="audit-action" className="input" value={action} onChange={e => setAction(e.target.value)}>
            <option value="">All activity</option>
            {actions.map(a => <option key={a} value={a}>{meta(a).label}</option>)}
          </select>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={8} cols={3} />
        ) : data.length === 0 ? (
          offline ? (
            <EmptyState icon={CloudOff} title="Can't reach the server"
              description="The activity log couldn't be loaded. This is not an empty log — nothing answered." />
          ) : (
            <EmptyState icon={ScrollText} title="Nothing recorded yet"
              description={search || action
                ? "No entries match these filters."
                : "Sign-ins, credential changes and exports will appear here."} />
          )
        ) : (
          <ul className="divide-y divide-border">
            {data.map(row => {
              const m = meta(row.action);
              const Icon = m.icon;
              return (
                <li key={row.id} className="px-4 py-3 flex items-start gap-3">
                  <span className={`icon-tile w-9 h-9 shrink-0 badge-${m.tone}`}>
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold text-fg text-sm">{m.label}</span>
                      {row.target && (
                        <span className="font-mono text-xs text-muted-fg truncate">{row.target}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-fg mt-0.5">
                      {row.actor_name || row.actor_id || "Unauthenticated"}
                      {row.actor_role && ` · ${row.actor_role}`}
                      {row.ip && ` · ${row.ip}`}
                    </p>
                    {row.detail && <p className="text-xs text-muted-fg mt-1 italic">{row.detail}</p>}
                  </div>
                  <time className="text-xs text-subtle-fg whitespace-nowrap shrink-0 text-right"
                    dateTime={row.created_at} title={formatDateTime(row.created_at)}>
                    {formatWhen(row.created_at)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination page={page} pages={pages} total={total} pageSize={limit}
          onPage={setPage} noun="entries" />
      </Card>

      <p className="text-xs text-muted-fg mt-3">
        Times are Philippine Standard Time (UTC+8).
      </p>
    </div>
  );
}
