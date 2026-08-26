import { useState } from "react";
import { BookOpen, UserPlus, Search, X } from "lucide-react";
import { Card, StatusBadge, EmptyState, Skeleton, Button } from "../SharedUI.jsx";
import { shortDepartment } from "../ui/DepartmentIcon.jsx";
import DepartmentChips, { DepartmentTile } from "./DepartmentChips.jsx";
import AddFacultyForm from "./AddFacultyForm.jsx";

/**
 * Faculty availability.
 *
 * Departments used to be collapsible sections — six accordions to open and
 * close, where the answer to "who is free in Computer Engineering" took two
 * taps and hid the other five. Filtering is what that interaction was actually
 * for, so it is a row of chips: one tap, current state visible without opening
 * anything, and the counts readable before you choose.
 */
export default function FacultyTab({
  departments, loading, addToast, onAdded, onGoToCredentials,
}) {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState(null);   // null = all
  const [adding, setAdding] = useState(false);

  const all = departments.flatMap(d =>
    d.professors.map(p => ({ ...p, department: d.department })));

  const visible = all.filter(p =>
    (!dept || p.department === dept) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase())));

  const availableIn = d =>
    all.filter(p => (!d || p.department === d) && p.status === "Available").length;
  const countIn = d => all.filter(p => !d || p.department === d).length;

  const chips = [null, ...departments.map(d => d.department)].map(id => ({
    id, count: availableIn(id), total: countIn(id),
  }));

  return (
    <div className="animate-rise">
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <div className="relative flex-1 min-w-[190px] max-w-md">
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
        <Button variant="primary" icon={UserPlus} className="shrink-0"
          onClick={() => setAdding(true)}>
          Add faculty
        </Button>
      </div>

      <AddFacultyForm
        open={adding}
        onClose={() => setAdding(false)}
        addToast={addToast}
        onAdded={onAdded}
        onGoToCredentials={onGoToCredentials}
      />

      <DepartmentChips chips={chips} value={dept} onChange={setDept} />

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
              return (
                <li key={`${p.department}-${p.name}`}
                  className="px-4 py-3 flex items-center gap-3">
                  <DepartmentTile department={p.department} />
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
