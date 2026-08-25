import {
  BookOpen, GraduationCap, Activity, CheckCircle2, ChevronRight, ClipboardList,
  TrendingUp, PieChart, Download, ScrollText,
} from "lucide-react";
import { Card, CardHeader, RequestBadge, EmptyState, Skeleton, Button } from "../SharedUI.jsx";
import { shortDepartment } from "../ui/DepartmentIcon.jsx";
import { TrendChart, StatusDonut } from "./Charts.jsx";
import AuditFeed from "./AuditFeed.jsx";

/** Headline numbers. These come from /admin/stats — SQL counts over the whole
 *  table. They used to be `students.length` on the current page, so every
 *  figure was wrong the moment there was more than one page of data. */
function StatCard({ icon: Icon, label, value, sub, loading }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-fg mb-2">
        <Icon size={15} aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      {loading
        ? <Skeleton className="h-8 w-16" />
        : <p className="text-2xl sm:text-3xl font-bold text-fg tabular-nums">{value?.toLocaleString() ?? "—"}</p>}
      {sub && <p className="text-xs text-muted-fg mt-1">{sub}</p>}
    </Card>
  );
}

function DepartmentBar({ dept }) {
  const total = dept.professors.length;
  const avail = dept.professors.filter(p => p.status === "Available").length;
  const pct = total ? Math.round((avail / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <p className="text-sm font-medium text-fg truncate">{shortDepartment(dept.department)}</p>
        <p className="text-xs text-muted-fg tabular-nums shrink-0">{avail}/{total} available</p>
      </div>
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden"
        role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
        aria-label={`${shortDepartment(dept.department)}: ${pct}% available`}>
        <div className="h-full rounded-full bg-brand transition-[width] duration-500"
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function OverviewTab({
  stats, statsLoading, departments, requests, onSeeAll, onExport,
}) {
  const categories = stats?.categories || [];
  const maxCategory = Math.max(1, ...categories.map(c => c.count));

  const statusSegments = [
    { key: "pending",  label: "Pending",  value: stats?.pending  || 0 },
    { key: "done",     label: "Done",     value: stats?.done     || 0 },
    { key: "declined", label: "Declined", value: stats?.declined || 0 },
    { key: "archived", label: "Archived", value: stats?.archived || 0 },
  ];

  return (
    <div className="space-y-5 animate-rise">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={BookOpen} label="Faculty" value={stats?.teachers}
          sub={`${stats?.with_qr ?? 0} with an active card`} loading={statsLoading} />
        <StatCard icon={GraduationCap} label="Students" value={stats?.students}
          sub="registered accounts" loading={statsLoading} />
        <StatCard icon={Activity} label="Today" value={stats?.today}
          sub="consultation requests" loading={statsLoading} />
        <StatCard icon={CheckCircle2} label="Completed" value={stats?.done}
          sub={`${stats?.pending ?? 0} still pending`} loading={statsLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Requests over time"
            subtitle="Last 14 days" icon={TrendingUp} />
          {statsLoading
            ? <Skeleton className="h-40 rounded-lg" />
            : <TrendChart data={stats?.daily || []} />}
        </Card>

        <Card>
          <CardHeader title="By status" subtitle="All requests" icon={PieChart} />
          {statsLoading
            ? <Skeleton className="h-40 rounded-lg" />
            : <StatusDonut segments={statusSegments} />}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Availability by department"
            subtitle="Live faculty status" icon={BookOpen} />
          {departments.length === 0
            ? <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-8" />)}</div>
            : <div className="space-y-4">
                {departments.map(d => <DepartmentBar key={d.department} dept={d} />)}
              </div>}
        </Card>

        <Card>
          <CardHeader title="Requests by category" subtitle="All time" icon={ClipboardList} />
          {categories.length === 0 ? (
            <p className="text-sm text-muted-fg py-6 text-center">No data yet</p>
          ) : (
            <div className="space-y-3">
              {categories.map(c => (
                <div key={c.category}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-fg font-medium">{c.category}</span>
                    <span className="text-fg font-semibold tabular-nums">{c.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full rounded-full bg-brand-400"
                      style={{ width: `${(c.count / maxCategory) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-border text-center">
            {[["Pending", stats?.pending], ["Done", stats?.done], ["Declined", stats?.declined]].map(([l, v]) => (
              <div key={l}>
                <p className="text-lg font-bold text-fg tabular-nums">{v ?? 0}</p>
                <p className="text-[11px] text-muted-fg uppercase tracking-wide">{l}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="p-5 pb-0">
            <CardHeader title="Recent activity"
              subtitle="Sign-ins, credentials and exports" icon={ScrollText} />
          </div>
          <AuditFeed limit={6} />
        </Card>

        <Card>
          <CardHeader title="Export" subtitle="Download as a spreadsheet" icon={Download} />
          <div className="space-y-2">
            <Button className="w-full justify-start" icon={Download}
              onClick={() => onExport?.("today")}>Today's records</Button>
            <Button className="w-full justify-start" icon={Download}
              onClick={() => onExport?.("all")}>All records</Button>
          </div>
          <p className="text-xs text-muted-fg mt-3">
            Every export is recorded in the activity log above.
          </p>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-5 pb-0">
          <CardHeader
            title="Recent consultations"
            subtitle="Latest eight requests"
            icon={ClipboardList}
            action={
              <Button size="sm" onClick={onSeeAll}>
                View all <ChevronRight size={14} aria-hidden="true" />
              </Button>
            }
          />
        </div>
        {requests.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No requests yet"
            description="Consultation requests will appear here as students file them." />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {requests.slice(0, 8).map(r => (
              <li key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-fg truncate">{r.student_name}</p>
                  <p className="text-xs text-muted-fg truncate">
                    to {r.professor_name} · {r.category}
                  </p>
                </div>
                <RequestBadge status={r.status} hasAppointment={!!r.appointment_date} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
