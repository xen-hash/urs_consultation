import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  GraduationCap, ClipboardList, CheckCircle2, XCircle, Clock,
  Download, RefreshCw, TrendingUp, BookOpen, ChevronDown,
  ChevronRight, UserPlus, Plus, CheckCircle, BarChart2,
  Menu, X, Bell, LogOut, LayoutDashboard, Search, Activity,
  Users, Shield, AlertCircle, ChevronUp, Layers, Trash2, VolumeX, Volume2
} from "lucide-react";
import { StatusBadge, Toast, useToastState, Spinner } from "./SharedUI.jsx";
import { API_BASE, DEPARTMENTS } from "../constants.js";

// Piper TTS — queued speaker so announcements never overlap
const _ttsQueue = [];
let _ttsBusy = false;
let _ttsAudio = null;
const _seenRequestIds = new Set(); // tracks already-announced consultation IDs
let _ttsPaused = false; // module-level pause flag readable by piperSpeak

async function _ttsPlayNext() {
  if (_ttsBusy || _ttsQueue.length === 0) return;
  _ttsBusy = true;
  const text = _ttsQueue.shift();
  try {
    if (_ttsAudio) { _ttsAudio.pause(); _ttsAudio.src = ""; _ttsAudio = null; }
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      _ttsAudio = new Audio(url);
      await new Promise(resolve => {
        _ttsAudio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        _ttsAudio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        _ttsAudio.play().catch(resolve);
      });
    }
  } catch (_) {}
  _ttsBusy = false;
  // Gap between announcements so they don't overlap
  setTimeout(_ttsPlayNext, 800);
}

function piperSpeak(text) {
  if (_ttsPaused) return;
  _ttsQueue.push(text);
  _ttsPlayNext();
}

// Extract first name only, stripping title prefixes
function getFirstName(fullName) {
  return (fullName || "")
    .replace(/^(Engr\.|Dr\.|Prof\.|AR\.|Mr\.|Ms\.|Mrs\.)\s*/i, "")
    .split(" ")[0];
}


/* ─── Animated counter hook ─────────────────────────────────────── */
function useCountUp(target, duration = 1200) {
  const [count, setCount] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    let start = null;
    const from = 0;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(from + (target - from) * ease));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return count;
}

/* ─── Mini bar chart for categories ─────────────────────────────── */
function CategoryChart({ requests }) {
  const cats = {};
  requests.forEach(r => { cats[r.category] = (cats[r.category] || 0) + 1; });
  const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = entries[0]?.[1] || 1;
  const COLORS = ["#003366","#0055aa","#ffa000","#43a047","#e53935","#8e24aa"];
  return (
    <div className="space-y-2.5">
      {entries.length === 0
        ? <p className="text-gray-400 text-sm text-center py-4">No data yet</p>
        : entries.map(([cat, val], i) => (
          <div key={cat}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 font-medium">{cat}</span>
              <span className="font-bold" style={{ color: COLORS[i % COLORS.length] }}>{val}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${(val / max) * 100}%`, background: COLORS[i % COLORS.length],
                  animation: `barGrow 1s ease ${i * 0.1}s both` }} />
            </div>
          </div>
        ))
      }
    </div>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────────── */
function StatCard({ label, value, sub, icon, gradient, delay = 0 }) {
  const count = useCountUp(value);
  return (
    <div className="rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group cursor-default"
      style={{ background: gradient, animation: `slideUp 0.5s ease ${delay}s both` }}>
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10 group-hover:scale-150 transition-transform duration-700" />
      <div className="absolute -right-2 -bottom-6 w-16 h-16 rounded-full bg-white/10 group-hover:scale-150 transition-transform duration-700 delay-75" />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">{icon}</div>
          <TrendingUp size={14} className="opacity-50 mt-1" />
        </div>
        <p className="text-4xl font-black tracking-tight">{count.toLocaleString()}</p>
        <p className="text-sm font-bold opacity-90 mt-1">{label}</p>
        <p className="text-xs opacity-60 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

/* ─── Nav Item ────────────────────────────────────────────────────── */
function NavItem({ icon, label, active, badge, onClick, collapsed }) {
  return (
    <button onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3 rounded-xl font-semibold transition-all duration-200 relative group
        ${collapsed ? "justify-center px-0 py-3.5" : "px-4 py-3 text-sm"}
        ${active
          ? "bg-white/15 text-white shadow-inner"
          : "text-white/50 hover:text-white hover:bg-white/10"}`}>
      {/* Icon — larger when collapsed so it fills the narrow sidebar */}
      <span className={`shrink-0 transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-110"}
        ${collapsed ? "scale-125" : ""}`}>
        {icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && badge > 0 && (
        <span className="ml-auto bg-[#ffa000] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {badge}
        </span>
      )}
      {/* Badge dot on icon when collapsed */}
      {collapsed && badge > 0 && (
        <span className="absolute top-2 right-2 w-2 h-2 bg-[#ffa000] rounded-full" />
      )}
      {active && !collapsed && <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#ffa000] rounded-l-full" />}
      {active && collapsed && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#ffa000] rounded-r-full" />}
    </button>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────────────── */
export default function DeanDashboard() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToastState();

  const deanRaw = sessionStorage.getItem("dean");
  const dean = deanRaw ? JSON.parse(deanRaw) : null;
  useEffect(() => { if (!dean) navigate("/teacher"); }, []);

  const [departments, setDepartments] = useState([]);
  const [students, setStudents]       = useState([]);
  const [requests, setRequests]       = useState([]);
  const [clearingReqs, setClearingReqs] = useState(false);
  const [ttsPaused, setTtsPaused]         = useState(false);
  const [teachers, setTeachers]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState("overview");
  const [expandedDept, setExpandedDept] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Add Teacher state
  const [addForm, setAddForm]       = useState({ name: "", department: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [deptRes, studRes, reqRes] = await Promise.all([
        axios.get(`${API_BASE}/teacher-logs`),
        axios.get(`${API_BASE}/dean/students`),
        axios.get(`${API_BASE}/dean/requests`),
      ]);
      setDepartments(deptRes.data || []);
      const allTeachers = (deptRes.data || []).flatMap(d =>
        d.professors.map(p => ({ ...p, department: d.department }))
      );
      setTeachers(allTeachers);
      setStudents(studRes.data || []);
      const newReqs = reqRes.data || [];
      setRequests(newReqs);

      // Announce any new consultation requests not yet seen
      // Each request gets its own queued TTS announcement with an interval
      const pending = newReqs.filter(r =>
        r.status === "pending" && !_seenRequestIds.has(r.id)
      );
      pending.forEach((req, i) => {
        _seenRequestIds.add(req.id);
        // Stagger multiple simultaneous requests by 200ms each
        setTimeout(() => {
          piperSpeak(
            `Paging ${getFirstName(req.professor_name)}, ${getFirstName(req.student_name)} is requesting. Purpose: ${req.purpose}.`
          );
        }, i * 200);
      });
    } catch {
      addToast("Failed to load data.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Clear seen IDs on fresh login so all pending requests are announced
    _seenRequestIds.clear();
    fetchAll();
    piperSpeak("Welcome, Administrator!");
    const iv = setInterval(() => fetchAll(true), 5000);
    return () => clearInterval(iv);
  }, []);

  // Keep module-level flag in sync with React state
  useEffect(() => {
    _ttsPaused = ttsPaused;
    // If unpausing, stop any leftover audio immediately
    if (!ttsPaused && _ttsAudio) { _ttsAudio.pause(); _ttsAudio.src = ""; _ttsAudio = null; }
  }, [ttsPaused]);

  const handleExport = (type) => window.open(`${API_BASE}/export?type=${type}`, "_blank");

  const handleClearRequests = async () => {
    if (!window.confirm("Delete ALL consultation requests? This cannot be undone.")) return;
    setClearingReqs(true);
    try {
      await axios.post(`${API_BASE}/teacher/clear-logs`);
      setRequests([]);
      // Clear seen IDs so TTS resets cleanly
      _seenRequestIds.clear();
      addToast("All requests cleared.", "success");
    } catch {
      addToast("Failed to clear requests.", "error");
    } finally {
      setClearingReqs(false);
    }
  };

  const handleAddTeacher = async () => {
    if (!addForm.name.trim() || !addForm.department)
      return addToast("Please enter a name and select a department.", "warning");
    setAddLoading(true);
    setAddSuccess(null);
    try {
      const res = await axios.post(`${API_BASE}/dean/add-teacher`, {
        professor_name: addForm.name.trim(),
        department: addForm.department,
      });
      setAddSuccess(`${addForm.name.trim()} added (ID: ${res.data.employee_id})`);
      setAddForm({ name: "", department: "" });
      addToast("Teacher added successfully!", "success");
      fetchAll();
    } catch (e) {
      addToast(e.response?.data?.error || "Failed to add teacher.", "error");
    } finally {
      setAddLoading(false);
    }
  };

  if (!dean) return null;

  // Stats
  const totalTeachers   = teachers.length;
  const availTeachers   = teachers.filter(t => t.status === "Available").length;
  const totalStudents   = students.length;
  const totalRequests   = requests.length;
  const pendingRequests = requests.filter(r => r.status === "pending").length;
  const doneRequests    = requests.filter(r => r.status === "done").length;
  const todayRequests   = requests.filter(r => {
    const d = new Date(r.created_at);
    return d.toDateString() === new Date().toDateString();
  }).length;

  const TABS = [
    { id: "overview",    label: "Dashboard",    icon: <LayoutDashboard size={18} /> },
    { id: "teachers",    label: "Faculty",      icon: <BookOpen size={18} />, },
    { id: "students",    label: "Students",     icon: <GraduationCap size={18} /> },
    { id: "requests",    label: "Requests",     icon: <ClipboardList size={18} />, badge: pendingRequests },
    { id: "add-teacher", label: "Add Teacher",  icon: <UserPlus size={18} /> },
  ];

  const TAB_LABELS = { overview: "Dashboard", teachers: "Faculty", students: "Students", requests: "Requests", "add-teacher": "Add Teacher" };

  // Search filter helpers
  const filteredStudents = students.filter(s =>
    !searchQuery || s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.student_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredRequests = requests.filter(r =>
    !searchQuery || r.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.professor_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredTeachers = teachers.filter(t =>
    !searchQuery || t.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* ── Injected animations ─────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        .dean-root { font-family: 'Plus Jakarta Sans', sans-serif; }
        .dean-root .font-display { font-family: 'Space Grotesk', sans-serif; }
        @keyframes slideUp   { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideLeft { from { opacity:0; transform:translateX(-24px) } to { opacity:1; transform:translateX(0) } }
        @keyframes fadeIn    { from { opacity:0 } to { opacity:1 } }
        @keyframes barGrow   { from { width:0 } }
        @keyframes pulse2    { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes shimmer   { from{background-position:-200% 0} to{background-position:200% 0} }
        .anim-slide-up  { animation: slideUp  0.45s ease both; }
        .anim-fade-in   { animation: fadeIn   0.35s ease both; }
        .anim-slide-left{ animation: slideLeft 0.4s ease both; }
        .live-dot { animation: pulse2 2s ease-in-out infinite; }
        .dean-sidebar { transition: width 0.3s cubic-bezier(.4,0,.2,1); }
        .dean-main    { transition: margin-left 0.3s cubic-bezier(.4,0,.2,1); }
        .dean-card:hover { transform: translateY(-2px); transition: transform 0.2s ease, box-shadow 0.2s ease; box-shadow: 0 8px 30px rgba(0,0,0,0.12); }
        .row-hover:hover { background: #f8faff !important; }
        .status-available { background:#dcfce7; color:#15803d; }
        .status-unavailable { background:#f1f5f9; color:#64748b; }
        .status-onleave { background:#fef9c3; color:#a16207; }
        .status-inmeeting { background:#ffedd5; color:#c2410c; }
      `}</style>

      <div className="dean-root flex h-screen bg-[#f0f4f8] overflow-hidden">
        <Toast toasts={toasts} removeToast={removeToast} />

        {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
        <aside className={`dean-sidebar shrink-0 flex flex-col h-screen overflow-hidden
          ${sidebarOpen ? "w-60" : "w-[68px]"}`}
          style={{ background: "linear-gradient(180deg,#0d1b2a 0%,#1a2a40 60%,#0d1b2a 100%)" }}
          onMouseEnter={() => setSidebarOpen(true)}
          onMouseLeave={() => setSidebarOpen(false)}>

          {/* Brand */}
          <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[#ffa000] flex items-center justify-center shrink-0 shadow-lg">
              <Shield size={18} className="text-white" />
            </div>
            {sidebarOpen && (
              <div className="anim-fade-in overflow-hidden">
                <p className="font-display font-bold text-white text-sm leading-tight">Administrator</p>
                <p className="text-white/40 text-[10px]">College of Engineering</p>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
            {sidebarOpen && (
              <p className="text-white/25 text-[9px] font-bold uppercase tracking-widest px-3 mb-2 mt-1">Navigation</p>
            )}
            {TABS.map(tab => (
              <NavItem
                key={tab.id}
                icon={tab.icon}
                label={tab.label}
                active={activeTab === tab.id}
                badge={tab.badge}
                collapsed={!sidebarOpen}
                onClick={() => { setActiveTab(tab.id); setSearchQuery(""); }}
              />
            ))}
          </nav>

          {/* Export shortcuts — icons always visible, labels only when expanded */}
          <div className={`py-3 border-t border-white/10 space-y-1 ${sidebarOpen ? "px-3" : "px-2"}`}>
            {sidebarOpen && (
              <p className="text-white/25 text-[9px] font-bold uppercase tracking-widest px-1 mb-2">Quick Export</p>
            )}
            <button onClick={() => handleExport("today")} title="Export Today"
              className={`w-full flex items-center gap-2 py-2.5 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all
                ${sidebarOpen ? "px-3 justify-start" : "justify-center px-0"}`}>
              <Download size={sidebarOpen ? 13 : 18} className="text-green-400 shrink-0" />
              {sidebarOpen && "Export Today"}
            </button>
            <button onClick={() => handleExport("all")} title="Export All Records"
              className={`w-full flex items-center gap-2 py-2.5 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all
                ${sidebarOpen ? "px-3 justify-start" : "justify-center px-0"}`}>
              <Download size={sidebarOpen ? 13 : 18} className="text-blue-400 shrink-0" />
              {sidebarOpen && "Export All Records"}
            </button>
          </div>

          {/* TTS Pause + Logout */}
          <div className="px-2 py-3 border-t border-white/10 shrink-0 space-y-1">
            {/* Pause / Resume TTS */}
            <button
              onClick={() => {
                setTtsPaused(p => {
                  const next = !p;
                  // Stop current audio immediately when pausing
                  if (next && _ttsAudio) { _ttsAudio.pause(); _ttsAudio.src = ""; _ttsAudio = null; }
                  // Drain queue when pausing
                  if (next) _ttsQueue.length = 0;
                  return next;
                });
              }}
              title={ttsPaused ? "Resume announcements" : "Pause announcements"}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm
                ${ttsPaused
                  ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                  : "text-white/40 hover:text-white/70 hover:bg-white/10"}`}>
              {ttsPaused
                ? <Volume2 size={16} className="shrink-0" />
                : <VolumeX size={16} className="shrink-0" />
              }
              {sidebarOpen && (
                <span className="font-semibold">
                  {ttsPaused ? "Resume TTS" : "Pause TTS"}
                </span>
              )}
            </button>

            <button onClick={() => { sessionStorage.removeItem("dean"); navigate("/teacher"); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm">
              <LogOut size={16} className="shrink-0" />
              {sidebarOpen && <span className="font-semibold">Logout</span>}
            </button>
          </div>
        </aside>

        {/* ── MAIN AREA ────────────────────────────────────────────────── */}
        <div className="dean-main flex-1 flex flex-col overflow-hidden">

          {/* ── TOP BAR ───────────────────────────────────────────────── */}
          <header className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center gap-4 shrink-0 shadow-sm z-10">

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-gray-400 font-medium">Administrator</span>
              <ChevronRight size={14} className="text-gray-300" />
              <span className="text-[#003366] font-bold">{TAB_LABELS[activeTab]}</span>
            </div>

            {/* Search */}
            {["students", "teachers", "requests"].includes(activeTab) && (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 ml-2 flex-1 max-w-xs">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                  className="bg-transparent text-sm outline-none flex-1 text-gray-700 placeholder:text-gray-400"
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")}>
                    <X size={13} className="text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            )}

            <div className="ml-auto flex items-center gap-3">
              {/* Live indicator */}
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                <span className="live-dot w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-green-700 text-xs font-bold">{availTeachers} Live</span>
              </div>

              {/* Refresh */}
              <button onClick={fetchAll}
                className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all active:scale-95">
                <RefreshCw size={15} className={`text-gray-600 ${loading ? "animate-spin" : ""}`} />
              </button>

              {/* Pending badge */}
              {pendingRequests > 0 && (
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-[#fff3e0] flex items-center justify-center">
                    <Bell size={16} className="text-[#ff6f00]" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {pendingRequests}
                  </span>
                </div>
              )}

              {/* Dean avatar */}
              <div className="flex items-center gap-2 pl-2 border-l border-gray-100">
                <div className="w-8 h-8 rounded-xl bg-[#003366] flex items-center justify-center shadow">
                  <Shield size={14} className="text-white" />
                </div>
                <div className="text-xs leading-tight hidden sm:block">
                  <p className="font-bold text-gray-800">Administrator</p>
                  <p className="text-gray-400">Administrator</p>
                </div>
              </div>
            </div>
          </header>

          {/* ── PAGE CONTENT ─────────────────────────────────────────── */}
          <main className="flex-1 overflow-y-auto p-6">

            {loading && activeTab === "overview" ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Spinner size={10} />
                <p className="text-gray-400 text-sm font-medium">Loading dashboard data…</p>
              </div>
            ) : (
              <>

                {/* ──────────────── OVERVIEW ──────────────────────────── */}
                {activeTab === "overview" && (
                  <div className="space-y-6 anim-fade-in">

                    {/* Stat Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <StatCard
                        label="Total Faculty" value={totalTeachers}
                        sub={`${availTeachers} available now`}
                        icon={<BookOpen size={20} />}
                        gradient="linear-gradient(135deg,#003366 0%,#0055aa 100%)"
                        delay={0} />
                      <StatCard
                        label="Total Students" value={totalStudents}
                        sub="registered accounts"
                        icon={<GraduationCap size={20} />}
                        gradient="linear-gradient(135deg,#1b5e20 0%,#43a047 100%)"
                        delay={0.08} />
                      <StatCard
                        label="Today's Requests" value={todayRequests}
                        sub="consultation requests"
                        icon={<Activity size={20} />}
                        gradient="linear-gradient(135deg,#e65100 0%,#ffa000 100%)"
                        delay={0.16} />
                      <StatCard
                        label="Completed" value={doneRequests}
                        sub={`${pendingRequests} still pending`}
                        icon={<CheckCircle2 size={20} />}
                        gradient="linear-gradient(135deg,#4a148c 0%,#8e24aa 100%)"
                        delay={0.24} />
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                      {/* Department Availability */}
                      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 dean-card"
                        style={{ animation: "slideUp 0.5s ease 0.3s both" }}>
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <h3 className="font-display font-bold text-gray-900">Department Availability</h3>
                            <p className="text-gray-400 text-xs mt-0.5">Real-time faculty status per department</p>
                          </div>
                          <div className="flex items-center gap-3 text-xs font-semibold">
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-green-500 rounded-full" />Available</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-gray-200 rounded-full" />Total</span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {departments.map((dept, i) => {
                            const avail = dept.professors.filter(p => p.status === "Available").length;
                            const total = dept.professors.length;
                            const pct = total > 0 ? Math.round((avail / total) * 100) : 0;
                            const shortName = dept.department.replace(" Department","").replace(" Engineering","");
                            return (
                              <div key={dept.department} style={{ animation: `slideUp 0.4s ease ${0.35 + i * 0.07}s both` }}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-sm font-semibold text-gray-700">{shortName}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">{avail}/{total}</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                                      ${pct > 60 ? "bg-green-100 text-green-700" : pct > 30 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>
                                      {pct}%
                                    </span>
                                  </div>
                                </div>
                                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full"
                                    style={{
                                      width: `${pct}%`,
                                      background: pct > 60 ? "linear-gradient(90deg,#43a047,#66bb6a)" : pct > 30 ? "linear-gradient(90deg,#f59e0b,#fbbf24)" : "linear-gradient(90deg,#ef4444,#f87171)",
                                      animation: `barGrow 1s ease ${0.4 + i * 0.1}s both`,
                                      transition: "width 0.8s ease"
                                    }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Request Category Chart */}
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 dean-card"
                        style={{ animation: "slideUp 0.5s ease 0.4s both" }}>
                        <div className="mb-5">
                          <h3 className="font-display font-bold text-gray-900">By Category</h3>
                          <p className="text-gray-400 text-xs mt-0.5">Consultation request breakdown</p>
                        </div>
                        <CategoryChart requests={requests} />

                        {/* Status summary pills */}
                        <div className="mt-5 pt-4 border-t border-gray-50 grid grid-cols-3 gap-2 text-center">
                          {[
                            { label: "Pending",  val: pendingRequests,  cls: "bg-amber-50 text-amber-700" },
                            { label: "Done",     val: doneRequests,     cls: "bg-green-50 text-green-700" },
                            { label: "Declined", val: requests.filter(r=>r.status==="declined").length, cls: "bg-red-50 text-red-600" },
                          ].map(s => (
                            <div key={s.label} className={`${s.cls} rounded-xl py-2 px-1`}>
                              <p className="text-lg font-black">{s.val}</p>
                              <p className="text-[10px] font-semibold uppercase tracking-wide">{s.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Recent Requests */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 dean-card"
                      style={{ animation: "slideUp 0.5s ease 0.5s both" }}>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-display font-bold text-gray-900">Recent Consultations</h3>
                          <p className="text-gray-400 text-xs mt-0.5">Latest 8 consultation requests</p>
                        </div>
                        <button onClick={() => setActiveTab("requests")}
                          className="text-xs text-[#003366] font-semibold hover:underline flex items-center gap-1">
                          View All <ChevronRight size={13} />
                        </button>
                      </div>
                      {requests.length === 0 ? (
                        <div className="text-center py-8 text-gray-300">
                          <ClipboardList size={36} className="mx-auto mb-2" />
                          <p className="text-sm font-semibold">No requests yet</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100">
                                {["Student","Professor","Category","Status","Time"].map(h => (
                                  <th key={h} className="text-left py-2 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {requests.slice(0, 8).map((r, i) => (
                                <tr key={r.id} className="row-hover border-b border-gray-50"
                                  style={{ animation: `fadeIn 0.3s ease ${i * 0.04}s both` }}>
                                  <td className="py-2.5 px-3 font-semibold text-gray-800">{r.student_name}</td>
                                  <td className="py-2.5 px-3 text-gray-500">{r.professor_name}</td>
                                  <td className="py-2.5 px-3">
                                    <span className="bg-blue-50 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-full">{r.category}</span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full
                                      ${r.status==="pending" ? "bg-amber-100 text-amber-700"
                                      : r.status==="done"    ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-600"}`}>
                                      {r.status}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-gray-400 text-xs whitespace-nowrap">
                                    {r.request_time ? new Date(r.request_time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ──────────────── FACULTY TAB ───────────────────────── */}
                {activeTab === "teachers" && (
                  <div className="space-y-4 anim-slide-up">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-display font-bold text-xl text-gray-900">Faculty Directory</h2>
                        <p className="text-gray-400 text-sm mt-0.5">{filteredTeachers.length} of {totalTeachers} faculty · {availTeachers} currently available</p>
                      </div>
                      <button onClick={() => setActiveTab("add-teacher")}
                        className="flex items-center gap-2 bg-[#003366] hover:bg-[#004080] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow active:scale-95">
                        <UserPlus size={15} /> Add Faculty
                      </button>
                    </div>

                    {departments.map((dept, di) => {
                      const isOpen = expandedDept[dept.department] !== false;
                      const deptFiltered = dept.professors.filter(p =>
                        !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase())
                      );
                      if (searchQuery && deptFiltered.length === 0) return null;
                      const avail = dept.professors.filter(p => p.status === "Available").length;
                      return (
                        <div key={dept.department} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden dean-card"
                          style={{ animation: `slideUp 0.4s ease ${di * 0.07}s both` }}>
                          <button onClick={() => setExpandedDept(p => ({ ...p, [dept.department]: !isOpen }))}
                            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-10 rounded-full" style={{
                                background: avail > 0 ? "linear-gradient(180deg,#43a047,#66bb6a)" : "#e2e8f0"
                              }} />
                              <div>
                                <p className="font-display font-bold text-[#003366] text-left">{dept.department}</p>
                                <p className="text-xs text-gray-400 mt-0.5 text-left">
                                  {dept.professors.length} professors ·{" "}
                                  <span className="text-green-600 font-semibold">{avail} available</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-gray-100 text-gray-600 font-bold px-2.5 py-1 rounded-full">
                                {dept.professors.length}
                              </span>
                              {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                            </div>
                          </button>
                          {isOpen && (
                            <div className="border-t border-gray-100">
                              {(searchQuery ? deptFiltered : dept.professors).map((prof, pi) => (
                                <div key={prof.name}
                                  className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0 row-hover"
                                  style={{ animation: `fadeIn 0.25s ease ${pi * 0.04}s both` }}>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-sm`}
                                      style={{ background: prof.status==="Available" ? "#003366" : "#94a3b8" }}>
                                      {prof.name?.[0]}
                                    </div>
                                    <p className="text-sm font-semibold text-gray-800">{prof.name}</p>
                                  </div>
                                  <StatusBadge status={prof.status} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ──────────────── STUDENTS TAB ──────────────────────── */}
                {activeTab === "students" && (
                  <div className="anim-slide-up">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h2 className="font-display font-bold text-xl text-gray-900">Registered Students</h2>
                        <p className="text-gray-400 text-sm mt-0.5">{filteredStudents.length} of {totalStudents} students</p>
                      </div>
                      <span className="bg-[#003366] text-white text-xs font-black px-3 py-1.5 rounded-full shadow">
                        {students.length} Total
                      </span>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden dean-card">
                      {filteredStudents.length === 0 ? (
                        <div className="text-center py-16">
                          <GraduationCap size={40} className="mx-auto text-gray-200 mb-3" />
                          <p className="text-gray-400 font-semibold">
                            {searchQuery ? "No students match your search" : "No students registered yet"}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                {["#","Student ID","Full Name","Course","Year","Department","Registered"].map(h => (
                                  <th key={h} className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredStudents.map((s, i) => (
                                <tr key={s.id} className="row-hover border-b border-gray-50 last:border-0"
                                  style={{ animation: `fadeIn 0.25s ease ${i * 0.02}s both` }}>
                                  <td className="py-3 px-4 text-gray-300 text-xs font-bold">{i + 1}</td>
                                  <td className="py-3 px-4 font-mono text-xs text-[#003366] font-bold">{s.student_id}</td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#003366] to-[#0055aa] flex items-center justify-center text-white text-[10px] font-black shrink-0">
                                        {s.full_name?.[0]}
                                      </div>
                                      <span className="font-semibold text-gray-800">{s.full_name}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-gray-600 text-xs max-w-[140px] truncate">{s.course}</td>
                                  <td className="py-3 px-4">
                                    <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{s.year_level}</span>
                                  </td>
                                  <td className="py-3 px-4 text-gray-400 text-xs max-w-[140px] truncate">{s.department?.replace(" Department","")}</td>
                                  <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">
                                    {s.created_at ? new Date(s.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}) : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ──────────────── REQUESTS TAB ──────────────────────── */}
                {activeTab === "requests" && (
                  <div className="anim-slide-up">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                      <div>
                        <h2 className="font-display font-bold text-xl text-gray-900">Consultation Requests</h2>
                        <p className="text-gray-400 text-sm mt-0.5">{filteredRequests.length} of {totalRequests} total requests</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {[
                          { label: "Pending",  val: pendingRequests,  cls: "bg-amber-100 text-amber-700 border-amber-200" },
                          { label: "Done",     val: doneRequests,     cls: "bg-green-100 text-green-700 border-green-200" },
                          { label: "Declined", val: requests.filter(r=>r.status==="declined").length, cls: "bg-red-100 text-red-700 border-red-200" },
                        ].map(s => (
                          <span key={s.label} className={`${s.cls} border text-xs font-bold px-3 py-1.5 rounded-full`}>
                            {s.val} {s.label}
                          </span>
                        ))}
                        <button
                          onClick={handleClearRequests}
                          disabled={clearingReqs || requests.length === 0}
                          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40
                                     text-white text-xs font-bold px-3 py-1.5 rounded-full transition-all active:scale-95">
                          {clearingReqs
                            ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            : <Trash2 size={12} />
                          }
                          Delete All
                        </button>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden dean-card">
                      {filteredRequests.length === 0 ? (
                        <div className="text-center py-16">
                          <ClipboardList size={40} className="mx-auto text-gray-200 mb-3" />
                          <p className="text-gray-400 font-semibold">
                            {searchQuery ? "No requests match your search" : "No consultation requests yet"}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                {["Student","Professor","Department","Category","Purpose","Status","Time"].map(h => (
                                  <th key={h} className="text-left py-4 px-5 text-xs font-extrabold text-gray-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredRequests.map((r, i) => (
                                <tr key={r.id} className="row-hover border-b border-gray-100 last:border-0"
                                  style={{ animation: `fadeIn 0.25s ease ${i * 0.02}s both` }}>

                                  {/* Student */}
                                  <td className="py-4 px-5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-xl bg-[#003366] flex items-center justify-center text-white text-sm font-black shrink-0">
                                        {r.student_name?.[0]}
                                      </div>
                                      <span className="font-bold text-gray-900 text-sm whitespace-nowrap">{r.student_name}</span>
                                    </div>
                                  </td>

                                  {/* Professor */}
                                  <td className="py-4 px-5">
                                    <span className="font-semibold text-gray-800 text-sm whitespace-nowrap">{r.professor_name}</span>
                                  </td>

                                  {/* Department */}
                                  <td className="py-4 px-5">
                                    <span className="text-sm font-medium text-gray-600 whitespace-nowrap">{r.department?.replace(" Department","")}</span>
                                  </td>

                                  {/* Category */}
                                  <td className="py-4 px-5">
                                    <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap border border-blue-100">{r.category}</span>
                                  </td>

                                  {/* Purpose */}
                                  <td className="py-4 px-5 max-w-[200px]">
                                    <p className="text-sm text-gray-700 font-medium italic truncate">"{r.purpose}"</p>
                                  </td>

                                  {/* Status */}
                                  <td className="py-4 px-5">
                                    <span className={`text-xs font-extrabold px-3 py-1.5 rounded-full whitespace-nowrap border
                                      ${r.status==="pending" ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : r.status==="done"    ? "bg-green-50 text-green-700 border-green-200"
                                      : "bg-red-50 text-red-600 border-red-200"}`}>
                                      {r.status === "pending" ? "⏳ Pending" : r.status === "done" ? "✅ Done" : "❌ Declined"}
                                    </span>
                                  </td>

                                  {/* Time */}
                                  <td className="py-4 px-5">
                                    <span className="text-sm font-semibold text-gray-500 whitespace-nowrap">
                                      {r.request_time ? new Date(r.request_time).toLocaleString("en-PH",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : "—"}
                                    </span>
                                  </td>

                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ──────────────── ADD TEACHER TAB ───────────────────── */}
                {activeTab === "add-teacher" && (
                  <div className="anim-slide-up max-w-2xl mx-auto space-y-5">
                    <div>
                      <h2 className="font-display font-bold text-xl text-gray-900">Add New Faculty</h2>
                      <p className="text-gray-400 text-sm mt-0.5">Register a new faculty member to the system</p>
                    </div>

                    {/* Form Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden dean-card">
                      <div className="bg-gradient-to-r from-[#003366] to-[#0055aa] px-6 py-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                          <UserPlus size={20} className="text-white" />
                        </div>
                        <div>
                          <p className="font-display font-bold text-white">Faculty Registration</p>
                          <p className="text-white/60 text-xs">Add a new professor to the College of Engineering</p>
                        </div>
                      </div>
                      <div className="p-6 space-y-4">
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                            Full Name <span className="text-red-400">*</span>
                          </label>
                          <input
                            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366]
                                       focus:bg-white transition-all"
                            placeholder="e.g. Engr. Maria Santos-Cruz"
                            value={addForm.name}
                            onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                            onKeyDown={e => e.key === "Enter" && handleAddTeacher()}
                          />
                          <p className="text-xs text-gray-400 mt-1.5">Include title prefix: Engr., Dr., Prof., AR.</p>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                            Department <span className="text-red-400">*</span>
                          </label>
                          <select
                            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366]
                                       focus:bg-white transition-all"
                            value={addForm.department}
                            onChange={e => setAddForm(p => ({ ...p, department: e.target.value }))}>
                            <option value="">— Select Department —</option>
                            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>

                        {addSuccess && (
                          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3"
                            style={{ animation: "slideUp 0.3s ease both" }}>
                            <CheckCircle size={18} className="text-green-600 shrink-0" />
                            <p className="text-green-700 text-sm font-semibold">{addSuccess}</p>
                          </div>
                        )}

                        <button onClick={handleAddTeacher}
                          disabled={addLoading || !addForm.name.trim() || !addForm.department}
                          className="w-full flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080]
                                     text-white font-bold py-3.5 rounded-xl transition-all shadow-lg
                                     hover:shadow-xl active:scale-[0.97] disabled:opacity-50 text-sm">
                          {addLoading ? <Spinner size={4} light /> : <Plus size={16} />}
                          {addLoading ? "Adding Faculty Member…" : "Add to Faculty Directory"}
                        </button>
                      </div>
                    </div>

                    {/* Existing faculty quick-view */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden dean-card">
                      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                          <h4 className="font-display font-bold text-gray-900">Current Faculty</h4>
                          <p className="text-gray-400 text-xs mt-0.5">{teachers.length} registered members</p>
                        </div>
                        <span className="bg-[#003366] text-white text-xs font-black px-2.5 py-1 rounded-full">{teachers.length}</span>
                      </div>
                      <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                        {teachers.length === 0
                          ? <p className="text-gray-400 text-sm text-center py-8">No faculty registered yet</p>
                          : teachers.map((t, i) => (
                            <div key={t.name + t.department}
                              className="flex items-center justify-between py-3 px-5 row-hover"
                              style={{ animation: `fadeIn 0.2s ease ${i * 0.02}s both` }}>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#003366] to-[#0055aa] flex items-center justify-center text-white text-[10px] font-black">
                                  {t.name?.[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                                  <p className="text-xs text-gray-400">{t.department?.replace(" Department","")}</p>
                                </div>
                              </div>
                              <StatusBadge status={t.status} />
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                )}

              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
