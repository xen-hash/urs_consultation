import { useState } from "react";
import { GraduationCap, Search } from "lucide-react";
import { Card, Badge, EmptyState, SkeletonRows, Pagination } from "../SharedUI.jsx";
import { shortDepartment } from "../ui/DepartmentIcon.jsx";
import { usePagedResource, useDebounced } from "./hooks.js";

export default function StudentsTab() {
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const { data, total, pages, page, setPage, loading, limit } =
    usePagedResource("/dean/students", { params: { search: debounced } });

  return (
    <div className="animate-rise">
      <div className="relative mb-4 max-w-sm">
        <Search size={17} aria-hidden="true"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle-fg pointer-events-none" />
        {/* Searching queries the server. It used to filter only the twenty rows
            already loaded, so a student on page three was unfindable. */}
        <input className="input pl-11" placeholder="Search name or student ID…" value={search}
          onChange={e => setSearch(e.target.value)} aria-label="Search students" />
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={8} cols={4} />
        ) : data.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No students found"
            description={search ? `Nothing matches "${search}".` : "No students have registered yet."} />
        ) : (
          <>
            <ul className="sm:hidden divide-y divide-border">
              {data.map(s => (
                <li key={s.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-fg truncate">{s.full_name}</p>
                      <p className="text-xs font-mono text-muted-fg mt-0.5">{s.student_id}</p>
                    </div>
                    <Badge tone="info">{s.year_level}</Badge>
                  </div>
                  <p className="text-xs text-muted-fg mt-1.5 truncate">
                    {s.course} · {shortDepartment(s.department)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="hidden sm:block table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Student ID</th>
                    <th scope="col">Name</th>
                    <th scope="col">Course</th>
                    <th scope="col">Year</th>
                    <th scope="col">Department</th>
                    <th scope="col">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(s => (
                    <tr key={s.id}>
                      <td className="font-mono text-xs font-semibold text-brand">{s.student_id}</td>
                      <td className="font-semibold">{s.full_name}</td>
                      <td className="text-muted-fg max-w-[180px] truncate">{s.course}</td>
                      <td><Badge tone="info">{s.year_level}</Badge></td>
                      <td className="text-muted-fg">{shortDepartment(s.department)}</td>
                      <td className="text-xs text-muted-fg whitespace-nowrap">
                        {s.created_at
                          ? new Date(s.created_at.replace(" ", "T"))
                              .toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <Pagination page={page} pages={pages} total={total} pageSize={limit}
          onPage={setPage} noun="students" />
      </Card>
    </div>
  );
}
