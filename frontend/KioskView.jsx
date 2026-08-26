import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import {
  LogOut, Search, ChevronDown, ChevronRight, X, Users, CheckCircle2, Layers,
  RefreshCw, ArrowLeft, Radio,
} from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge, Modal, Button, Alert, Toast, useToastState, EmptyState } from "./SharedUI.jsx";
import DepartmentIcon, { shortDepartment } from "./ui/DepartmentIcon.jsx";
import VirtualKeyboard from "./VirtualKeyboard.jsx";
import api, { apiError } from "./httpClient.js";
// SOCKET_URL was used here but never imported, so mounting this screen threw a
// ReferenceError and the live board never connected at all.
import { API_BASE, SOCKET_URL } from "./constants.js";

let socket = null;

/**
 * The live availability board.
 *
 * Two ways in, one screen. `/availability` is the public view: anyone can open
 * it and see who is free right now without signing in, which is the whole point
 * — a student checking whether one professor is in should not have to log in
 * every time to find out. `/kiosk` is the same board locked to a display in the
 * corridor, where leaving needs the exit password.
 *
 * It reads the public teacher-logs feed, polls it, and also listens on the
 * socket, so a professor flipping their status is reflected here within
 * seconds rather than on the next reload.
 */
export default function KioskView({ mode = "kiosk" }) {
  const kiosk = mode === "kiosk";
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToastState();
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({});
  const [exitOpen, setExitOpen] = useState(false);
  const [exitPass, setExitPass] = useState("");
  const [exitErr, setExitErr] = useState("");
  const [checking, setChecking] = useState(false);
  const [showKB, setShowKB] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  const [availOnly, setAvailOnly] = useState(false);
  const [live, setLive] = useState(false);
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
    // Shown as a live/reconnecting indicator: a board that has quietly stopped
    // updating looks exactly like a board where nothing has changed.
    socket.on("connect", () => setLive(true));
    socket.on("disconnect", () => setLive(false));
    return () => { clearInterval(poll); clearInterval(clock); socket?.disconnect(); };
  }, [fetchData]);

  const handleExit = async () => {
    if (!exitPass) return setExitErr("Enter the exit password.");
    setChecking(true); setExitErr("");
    try {
      // Verified on the server. This used to be a string comparison against a
      // constant in the JavaScript bundle, so the password was public.
      await api.post("/kiosk/exit", { password: exitPass });
      socket?.disconnect();
      navigate("/");
    } catch (e) {
      setExitErr(apiError(e, "Incorrect password."));
      setExitPass("");
    } finally { setChecking(false); }
  };

  const filtered = departments
    .map(d => ({
      ...d,
      professors: d.professors.filter(p =>
        (!availOnly || p.status === "Available") &&
        (p.name.toLowerCase().includes(search.toLowerCase()) ||
         d.department.toLowerCase().includes(search.toLowerCase()))),
    }))
    .filter(d => d.professors.length > 0);

  const totalFaculty = departments.reduce((a, d) => a + d.professors.length, 0);
  const totalAvail = departments.reduce(
    (a, d) => a + d.professors.filter(p => p.status === "Available").length, 0);

  const stats = [
    { label: "Faculty",    value: totalFaculty,       icon: Users },
    { label: "Available",  value: totalAvail,         icon: CheckCircle2, highlight: true },
    { label: "Departments", value: departments.length, icon: Layers },
    { label: "Updated",    value: lastUpdate.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }), icon: RefreshCw },
  ];

  return (
    <div className="min-h-dvh bg-canvas flex flex-col">
      <Toast toasts={toasts} removeToast={removeToast} />

      <header className="bg-brand-900 text-white pt-safe shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3">
          <div className="min-w-0">
            <h1 className="font-bold text-base sm:text-lg leading-tight truncate">
              Faculty Consultation
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
            {kiosk ? (
              <button onClick={() => setExitOpen(true)}
                className="btn btn-sm bg-white/10 text-white hover:bg-white/20">
                <LogOut size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Exit</span>
              </button>
            ) : (
              <Link to="/" className="btn btn-sm bg-white/10 text-white hover:bg-white/20">
                <ArrowLeft size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Back</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 pb-safe">
        <div className="relative mb-4">
          <Search size={18} aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle-fg pointer-events-none" />
          <input
            ref={searchRef}
            className="input pl-11 pr-11"
            placeholder="Search faculty or department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search faculty or department"
          />
          {search && (
            <button onClick={() => { setSearch(""); searchRef.current?.focus(); }}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center text-muted-fg hover:text-fg">
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => setAvailOnly(v => !v)}
            aria-pressed={availOnly}
            className={`inline-flex items-center gap-2 px-3 min-h-[40px] rounded-full border
              text-sm font-medium transition-colors duration-150
              ${availOnly
                ? "border-transparent bg-success text-white"
                : "border-border bg-surface text-fg hover:bg-surface-2"}`}
          >
            <CheckCircle2 size={15} aria-hidden="true" />
            Available now
            <span className={`text-xs tabular-nums ${availOnly ? "text-white/75" : "text-muted-fg"}`}>
              {totalAvail}
            </span>
          </button>
          <p className="text-xs text-muted-fg">
            Updated {lastUpdate.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
            {" · refreshes on its own"}
          </p>
        </div>

        {/* One column on a phone, two on a small tablet, four on the kiosk
            display — this was a hard grid-cols-4 that crushed on anything small. */}
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

        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map(i => <div key={i} className="card h-20 animate-shimmer" aria-hidden="true" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card">
            <EmptyState icon={Search}
              title={availOnly && !search ? "Nobody is free right now" : "No matches"}
              description={
                search ? `Nothing matches "${search}".`
                : availOnly ? "No faculty are marked available at the moment. Turn off the filter to see everyone and their schedules."
                : "No faculty on the board yet."} />
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map(dept => {
              const open = expanded[dept.department] !== false;
              const avail = dept.professors.filter(p => p.status === "Available").length;
              return (
                <section key={dept.department} className="card p-0 overflow-hidden">
                  <h2>
                    <button
                      onClick={() => setExpanded(p => ({ ...p, [dept.department]: !open }))}
                      aria-expanded={open}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2 transition-colors"
                    >
                      <span className={`icon-tile shrink-0 ${avail > 0 ? "icon-tile-brand" : "icon-tile-muted"}`}>
                        <DepartmentIcon department={dept.department} size={19} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-fg truncate">
                          <span className="sm:hidden">{shortDepartment(dept.department)}</span>
                          <span className="hidden sm:inline">{dept.department}</span>
                        </span>
                        <span className="block text-xs text-muted-fg">
                          {dept.professors.length} faculty · {avail} available
                        </span>
                      </span>
                      {open ? <ChevronDown size={18} className="text-muted-fg shrink-0" aria-hidden="true" />
                            : <ChevronRight size={18} className="text-muted-fg shrink-0" aria-hidden="true" />}
                    </button>
                  </h2>
                  {open && (
                    <ul className="border-t border-border divide-y divide-border sm:grid sm:grid-cols-2 sm:divide-y-0 sm:gap-px sm:bg-border">
                      {dept.professors.map(prof => (
                        <li key={prof.name}
                          className="bg-surface px-4 py-3 flex items-center justify-between gap-3">
                          <span className="font-medium text-sm text-fg min-w-0 truncate">{prof.name}</span>
                          <StatusBadge status={prof.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      <Modal
        open={kiosk && exitOpen}
        onClose={() => { setExitOpen(false); setExitPass(""); setExitErr(""); setShowKB(false); }}
        title="Exit kiosk mode"
        description="Enter the exit password to leave the display."
        size="sm"
        footer={
          <>
            <Button onClick={() => { setExitOpen(false); setExitPass(""); setExitErr(""); }}>Cancel</Button>
            <Button variant="primary" onClick={handleExit} loading={checking}>Exit</Button>
          </>
        }
      >
        <div className="space-y-3">
          {exitErr && <Alert tone="danger">{exitErr}</Alert>}
          <div>
            <label htmlFor="kiosk-pass" className="label">Password</label>
            <input id="kiosk-pass" type="password" className="input" autoFocus
              value={exitPass} onChange={e => { setExitPass(e.target.value); setExitErr(""); }}
              onKeyDown={e => e.key === "Enter" && handleExit()} />
          </div>
          {/* A kiosk touchscreen usually has no hardware keyboard, but a phone
              or tablet opening this page does — so the on-screen one is opt-in. */}
          <button onClick={() => setShowKB(v => !v)}
            className="text-xs text-brand font-semibold underline underline-offset-2">
            {showKB ? "Hide on-screen keyboard" : "Show on-screen keyboard"}
          </button>
          {showKB && (
            <VirtualKeyboard
              onKey={k => setExitPass(p => p + k)}
              onDelete={() => setExitPass(p => p.slice(0, -1))}
              onClear={() => setExitPass("")}
              onEnter={handleExit}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
