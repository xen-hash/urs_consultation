import { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, UserPlus, Search } from "lucide-react";
import { Card, StatusBadge, EmptyState, Skeleton, Button } from "../SharedUI.jsx";
import DepartmentIcon, { shortDepartment } from "../ui/DepartmentIcon.jsx";

export default function FacultyTab({ departments, loading, onAdd }) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState({});

  const filtered = departments
    .map(d => ({
      ...d,
      professors: d.professors.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())),
    }))
    .filter(d => d.professors.length > 0);

  const total = departments.reduce((a, d) => a + d.professors.length, 0);
  const avail = departments.reduce(
    (a, d) => a + d.professors.filter(p => p.status === "Available").length, 0);

  return (
    <div className="animate-rise">
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={17} aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle-fg pointer-events-none" />
          <input className="input pl-11" placeholder="Search faculty…" value={search}
            onChange={e => setSearch(e.target.value)} aria-label="Search faculty" />
        </div>
        <p className="text-sm text-muted-fg">{avail} of {total} available</p>
        <Button variant="primary" icon={UserPlus} className="ml-auto" onClick={onAdd}>
          Add faculty
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2.5">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={BookOpen} title="No faculty found"
            description={search ? `Nothing matches "${search}".` : "No faculty registered yet."} />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(dept => {
            const open = !collapsed[dept.department];
            const deptAvail = dept.professors.filter(p => p.status === "Available").length;
            return (
              <Card key={dept.department} className="p-0 overflow-hidden">
                <h2>
                  <button
                    onClick={() => setCollapsed(p => ({ ...p, [dept.department]: open }))}
                    aria-expanded={open}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2 transition-colors"
                  >
                    <span className={`icon-tile shrink-0 ${deptAvail > 0 ? "icon-tile-brand" : "icon-tile-muted"}`}>
                      <DepartmentIcon department={dept.department} size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-fg truncate">
                        {shortDepartment(dept.department)}
                      </span>
                      <span className="block text-xs text-muted-fg">
                        {dept.professors.length} faculty · {deptAvail} available
                      </span>
                    </span>
                    {open ? <ChevronDown size={18} className="text-muted-fg shrink-0" aria-hidden="true" />
                          : <ChevronRight size={18} className="text-muted-fg shrink-0" aria-hidden="true" />}
                  </button>
                </h2>
                {open && (
                  <ul className="border-t border-border divide-y divide-border">
                    {dept.professors.map(p => (
                      <li key={p.name} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-fg truncate">{p.name}</p>
                          {p.day_limit > 0 && (
                            <p className="text-xs text-muted-fg">
                              {p.consumed_today} of {p.day_limit} slots used today
                            </p>
                          )}
                        </div>
                        <StatusBadge status={p.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
