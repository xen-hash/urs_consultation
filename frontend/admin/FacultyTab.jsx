import { useState } from "react";
import { BookOpen, UserPlus, Search, X } from "lucide-react";
import { Card, StatusBadge, EmptyState, Skeleton, Button } from "../SharedUI.jsx";
import DepartmentIcon, { shortDepartment, departmentColor } from "../ui/DepartmentIcon.jsx";

/**
 * Faculty availability.
 *
 * Departments used to be collapsible sections — six accordions to open and
 * close, where the answer to "who is free in Computer Engineering" took two
 * taps and hid the other five. Filtering is what that interaction was actually
 * for, so it is a row of chips: one tap, current state visible without opening
 * anything, and the counts readable before you choose.
 */
export default function FacultyTab({ departments, loading, onAdd }) {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState(null);   // null = all

  const all = departments.flatMap(d =>
    d.professors.map(p => ({ ...p, department: d.department })));

  const visible = all.filter(p =>
    (!dept || p.department === dept) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase())));

  const availableIn = d =>
    all.filter(p => (!d || p.department === d) && p.status === "Available").length;
  const countIn = d => all.filter(p => !d || p.department === d).length;

  const chips = [{ id: null, label: "All" },
                 ...departments.map(d => ({ id: d.department, label: shortDepartment(d.department) }))];

  return (
    <div className="animate-rise">
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <div className="relative flex-1 min-w-[190px] max-w-sm">
          <Search size={17} aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle-fg pointer-events-none" />
          <input className="input pl-11 pr-10" placeholder="Search faculty…" value={search}
            onChange={e => setSearch(e.target.value)} aria-label="Search faculty" />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear search"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center text-muted-fg hover:text-fg">
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <Button variant="primary" icon={UserPlus} className="ml-auto" onClick={onAdd}>
          Add faculty
        </Button>
      </div>

      {/* Chips scroll rather than wrap: a wrapping row changes height as you
          filter, which shifts the list under your thumb mid-tap. */}
      <div role="tablist" aria-label="Filter by department"
        className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-4">
        {chips.map(chip => {
          const selected = chip.id === dept;
          const color = departmentColor(chip.id);
          return (
            <button
              key={chip.label}
              role="tab"
              aria-selected={selected}
              onClick={() => setDept(chip.id)}
              className={`shrink-0 inline-flex items-center gap-2 pl-2.5 pr-3 min-h-[40px] rounded-full
                border text-sm font-medium transition-colors duration-150
                ${selected
                  ? "border-transparent text-white bg-brand"
                  : "border-border bg-surface text-fg hover:bg-surface-2"}`}
            >
              {chip.id && (
                <span className="w-5 h-5 rounded-full grid place-items-center shrink-0"
                  style={selected
                    ? { background: "rgb(255 255 255 / 0.22)", color: "#fff" }
                    : { background: color.tint, color: color.ink }}>
                  <DepartmentIcon department={chip.id} size={12} />
                </span>
              )}
              {chip.label}
              <span className={`text-xs tabular-nums ${selected ? "text-white/75" : "text-muted-fg"}`}>
                {availableIn(chip.id)}/{countIn(chip.id)}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState icon={BookOpen} title="No faculty found"
            description={search ? `Nothing matches "${search}".` : "No faculty in this department yet."} />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-border">
            {visible.map(p => {
              const color = departmentColor(p.department);
              return (
                <li key={`${p.department}-${p.name}`}
                  className="px-4 py-3 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg grid place-items-center shrink-0"
                    style={{ background: color.tint, color: color.ink }}>
                    <DepartmentIcon department={p.department} size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-fg truncate">{p.name}</p>
                    <p className="text-xs text-muted-fg truncate">
                      {shortDepartment(p.department)}
                      {p.day_limit > 0 && ` · ${p.consumed_today}/${p.day_limit} slots used today`}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
