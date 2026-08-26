import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { Search, X, Users, CheckCircle2, Layers, RefreshCw, ArrowLeft, Radio } from "lucide-react";
import { Card, StatusBadge, EmptyState, Skeleton, Toast, useToastState } from "./SharedUI.jsx";
import { shortDepartment } from "./ui/DepartmentIcon.jsx";
import DepartmentChips, { DepartmentTile } from "./admin/DepartmentChips.jsx";
import api from "./httpClient.js";
import { SOCKET_URL } from "./constants.js";

let socket = null;

/**
 * The live availability board.
 *
 * Open to anyone: checking whether one professor is in is the most common
 * thing people come here for, and it should not need an account. It reads the
 * public teacher-logs feed, polls it, and listens on the socket, so a professor
 * flipping their status shows up here within seconds.
 *
 * Laid out exactly like the Faculty tab in the admin dashboard — same search,
 * same department chips, same rows. It is the same roster answering the same
 * question, so learning one teaches you the other; the accordion-and-stat-grid
 * version this replaces was a third layout for no reason.
 */
export default function AvailabilityBoard() {
  const { toasts, removeToast } = useToastState();
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState(null);      // null = all
  const [availOnly, setAvailOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  const searchRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const { data } = await api.get("/teacher-logs");
      setDepartments(data || []);
      setLastUpdate(new Date());
    } catch { /* the board keeps showing the last good data */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const poll = setInterval(fetchData, 30000);
    const clock = setInterval(() => setNow(new Date()), 30000);
    socket = io(SOCKET_URL || window.location.origin, {
      transports: ["polling"], reconnectionAttempts: 3,
    });
    socket.on("status_update", fetchData);
    // Shown as a live indicator: a board that has quietly stopped updating
    // looks exactly like a board where nothing has changed.
    socket.on("connect", () => setLive(true));
    socket.on("disconnect", () => setLive(false));
    return () => { clearInterval(poll); clearInterval(clock); socket?.disconnect(); };
  }, [fetchData]);

  const all = departments.flatMap(d =>
    d.professors.map(p => ({ ...p, department: d.department })));

  const visible = all.filter(p =>
    (!dept || p.department === dept) &&
    (!availOnly || p.status === "Available") &&
    (!search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.department.toLowerCase().includes(search.toLowerCase())));

  const availableIn = d =>
    all.filter(p => (!d || p.department === d) && p.status === "Available").length;
  const countIn = d => all.filter(p => !d || p.department === d).length;

  const chips = [null, ...departments.map(d => d.department)]
    .map(id => ({ id, count: availableIn(id), total: countIn(id) }));

  const totalAvail = availableIn(null);

  const stats = [
    { label: "Faculty",     value: all.length,         icon: Users },
    { label: "Available",   value: totalAvail,         icon: CheckCircle2, highlight: true },
    { label: "Departments", value: departments.length, icon: Layers },
    { label: "Updated",     value: lastUpdate.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }), icon: RefreshCw },
  ];

  return (
    <div className="min-h-dvh bg-canvas flex flex-col">
      <Toast toasts={toasts} removeToast={removeToast} />

      <header className="bg-brand-900 text-white pt-safe shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 max-w-6xl mx-auto w-full">
          <div className="min-w-0">
            <h1 className="font-bold text-base sm:text-lg leading-tight truncate">
              Who is available right now
            </h1>
            <p className="text-white/60 text-xs truncate flex items-center gap-1.5">
              <Radio size={12} aria-hidden="true"
                className={live ? "text-success" : "text-white/40"} />
              {live ? "Live — updating automatically" : "Reconnecting…"}
              <span className="hidden sm:inline">· No sign-in needed</span>
            </p>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="text-right leading-tight">
              <p className="text-lg sm:text-2xl font-bold tabular-nums">
                {now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-white/50 text-[11px] hidden xs:block">
                {now.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}
              </p>
            </div>
            <Link to="/" className="btn btn-sm bg-white/10 text-white hover:bg-white/20">
              <ArrowLeft size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 pb-safe">
        {/* One column on a phone, four on a wall display — this was a hard
            grid-cols-4 that crushed on anything small. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
          {stats.map(s => (
            <div key={s.label}
              className={`card p-3.5 sm:p-4 ${s.highlight ? "bg-success-50 border-success/20" : ""}`}>
              <div className="flex items-center gap-2 text-muted-fg mb-1">
                <s.icon size={14} aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wide truncate">{s.label}</span>
              </div>
              <p className={`text-xl sm:text-2xl font-bold tabular-nums ${s.highlight ? "text-success" : "text-fg"}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center mb-3">
          <div className="relative flex-1 min-w-[190px] max-w-sm">
            <Search size={17} aria-hidden="true"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle-fg pointer-events-none" />
            <input
              ref={searchRef}
              className="input pl-11 pr-10"
              placeholder="Search faculty…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search faculty"
            />
            {search && (
              <button onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center text-muted-fg hover:text-fg">
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* The question most people are here to answer, as one tap. */}
          <button
            onClick={() => setAvailOnly(v => !v)}
            aria-pressed={availOnly}
            className={`inline-flex items-center gap-2 px-3 min-h-[44px] rounded-lg border
              text-sm font-semibold transition-colors duration-150 ml-auto
              ${availOnly
                ? "border-transparent bg-success text-white"
                : "border-border bg-surface text-fg hover:bg-surface-2"}`}
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            Available only
          </button>
        </div>

        <DepartmentChips chips={chips} value={dept} onChange={setDept} />

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : visible.length === 0 ? (
          <Card>
            <EmptyState icon={Search}
              title={availOnly && !search ? "Nobody is free right now" : "No faculty found"}
              description={
                search ? `Nothing matches "${search}".`
                : availOnly ? "No faculty are marked available at the moment. Turn the filter off to see everyone."
                : "No faculty in this department yet."} />
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <ul className="divide-y divide-border">
              {visible.map(p => (
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
              ))}
            </ul>
          </Card>
        )}
      </main>
    </div>
  );
}
