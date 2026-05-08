import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import {
  Send, RefreshCw, Search, GraduationCap, BookOpen, X,
  ChevronLeft, Users, Inbox, User, Camera, Download,
  CalendarCheck, Pencil, Delete
} from "lucide-react";
import { URSHeader, StatusBadge, Toast, useToastState, PageWrapper, Spinner } from "./SharedUI.jsx";
import { WebcamCapture, IDCardPreview, generateIDCard } from "./ProfileEditor.jsx";
import { API_BASE, SOCKET_URL, CONSULTATION_CATEGORIES, DEPARTMENTS, YEAR_LEVELS } from "./constants.js";
import QRCodeLib from "qrcode";

let socket = null;

const DEPT_ICONS = {
  "Civil Engineering Department":       "🏗️",
  "Computer Engineering Department":    "💻",
  "Electronics Engineering Department": "⚡",
  "Electrical Engineering Department":  "🔌",
  "Mechanical Engineering Department":  "⚙️",
  "GEC GEAS Department":                "📐",
};



// ── Keyboard layout definitions ───────────────────────────────────────────────
// Letter mode
const L_ROW1 = ["q","w","e","r","t","y","u","i","o","p"];
const L_ROW2 = ["a","s","d","f","g","h","j","k","l"];
const L_ROW3 = ["z","x","c","v","b","n","m"];

// Number / symbol mode
const N_ROW1 = ["1","2","3","4","5","6","7","8","9","0"];
const N_ROW2 = ["-","/",":",";","(",")","%","@",'"',"'"];
const N_ROW3 = [".",",","?","!","#","&","_"];

// ── Single key button ─────────────────────────────────────────────────────────
function KbKey({ label, icon, onPress, accent, danger, dark, wide, narrow, cls = "" }) {
  const base =
    "flex items-center justify-center select-none rounded-[10px] border-b-[3px] " +
    "text-[15px] font-semibold cursor-pointer touch-none active:border-b-0 active:translate-y-[3px] " +
    "transition-transform duration-75 h-[46px] ";
  const color = accent
    ? "bg-[#003366] border-[#001f44] text-white "
    : danger
    ? "bg-[#c0392b] border-[#922b21] text-white "
    : dark
    ? "bg-[#151f2e] border-[#0a1018] text-white/50 "
    : "bg-[#2c3e52] border-[#1a2535] text-white ";
  const width = narrow ? "w-[46px] shrink-0 " : wide ? "flex-[1.6] " : "flex-1 ";
  return (
    <button
      onPointerDown={e => { e.preventDefault(); onPress(); }}
      className={base + color + width + cls}>
      {icon || label}
    </button>
  );
}

/**
 * InlineKeyboard — standard QWERTY layout rendered as a shrink-0 flex child.
 * Naturally pushes Cancel/Submit buttons up; form body shrinks to fill remaining space.
 *
 * Letter mode layout:
 *   q w e r t y u i o p
 *    a s d f g h j k l
 *   ⇧  z x c v b n m  ⌫
 *   123      space      .   Done ✓
 *
 * Number mode layout:
 *   1 2 3 4 5 6 7 8 9 0
 *   - / : ; ( ) % @ " '
 *   #+  . , ? ! # &    ⌫
 *   ABC      space      .   Done ✓
 */
function InlineKeyboard({ value = "", onChange, onDone, maxLength = 300 }) {
  const [caps, setCaps]       = useState(false);
  const [shift, setShift]     = useState(false);
  const [numMode, setNumMode] = useState(false);
  const bspRef = useRef(null);

  const letterRow1 = (caps || shift) ? L_ROW1.map(k => k.toUpperCase()) : L_ROW1;
  const letterRow2 = (caps || shift) ? L_ROW2.map(k => k.toUpperCase()) : L_ROW2;
  const letterRow3 = (caps || shift) ? L_ROW3.map(k => k.toUpperCase()) : L_ROW3;

  const tap = useCallback((char) => {
    if (value.length >= maxLength) return;
    onChange(value + char);
    if (shift) setShift(false);
  }, [value, onChange, shift, maxLength]);

  const backspace = useCallback(() => { onChange(value.slice(0, -1)); }, [value, onChange]);
  const bspDown   = () => { backspace(); bspRef.current = setInterval(backspace, 80); };
  const bspUp     = () => clearInterval(bspRef.current);
  useEffect(() => () => clearInterval(bspRef.current), []);

  const charsLeft = maxLength - value.length;

  return (
    <div
      className="shrink-0 w-full select-none pb-2"
      style={{
        background: "linear-gradient(160deg, #10192a 0%, #0d1520 100%)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        animation: "kbIn 0.2s cubic-bezier(0.22,1,0.36,1) both",
      }}>
      <style>{`@keyframes kbIn{from{transform:translateY(100%);opacity:0}to{transform:none;opacity:1}}`}</style>

      {/* ── KEY ROWS ── */}
      <div className="px-2 pt-2 pb-1 flex flex-col gap-[6px]">

        {numMode ? (
          /* ── NUMBER MODE ── */
          <>
            {/* Row 1: 1–0 */}
            <div className="flex gap-[5px]">
              {N_ROW1.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}
            </div>
            {/* Row 2: symbols */}
            <div className="flex gap-[5px]">
              {N_ROW2.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}
            </div>
            {/* Row 3: #+= | symbols | ⌫ — mirrors shift/backspace pattern */}
            <div className="flex gap-[5px]">
              <KbKey label="#+=" dark narrow onPress={() => {}} />
              <div className="flex flex-1 gap-[5px]">
                {N_ROW3.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}
              </div>
              <KbKey icon={<Delete size={17} />} danger narrow onPress={backspace} />
            </div>
            {/* Row 4: ABC / space / . / Done */}
            <div className="flex gap-[5px]">
              <KbKey label="ABC" dark narrow onPress={() => setNumMode(false)} />
              <KbKey label="space" dark onPress={() => tap(" ")} />
              <KbKey label="." dark narrow onPress={() => tap(".")} />
              <KbKey label="Done ✓" accent narrow onPress={() => onDone?.()} cls="!w-[72px]" />
            </div>
          </>
        ) : (
          /* ── LETTER MODE ── */
          <>
            {/* Row 1: q–p (10 keys, full width) */}
            <div className="flex gap-[5px]">
              {letterRow1.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}
            </div>

            {/* Row 2: a–l (9 keys, centered — indent ~half a key on each side) */}
            <div className="flex gap-[5px] px-[3.8%]">
              {letterRow2.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}
            </div>

            {/* Row 3: ⇧ + z–m + ⌫ */}
            <div className="flex gap-[5px]">
              {/* Shift */}
              <KbKey
                label={caps ? "⇪" : "⇧"}
                dark={!caps && !shift}
                accent={caps || shift}
                narrow
                onPress={() => {
                  if (caps)        { setCaps(false); setShift(false); }
                  else if (shift)  { setCaps(true);  setShift(false); }
                  else             { setShift(true); }
                }}
              />
              {/* z–m (7 keys, flex-1 each, centred between shift and backspace) */}
              <div className="flex flex-1 gap-[5px]">
                {letterRow3.map(k => <KbKey key={k} label={k} onPress={() => tap(k)} />)}
              </div>
              {/* Backspace */}
              <KbKey
                icon={<Delete size={17} />}
                danger narrow
                onPress={backspace}
              />
            </div>

            {/* Row 4: 123 / space / . / Done ✓ */}
            <div className="flex gap-[5px]">
              <KbKey label="123" dark narrow onPress={() => setNumMode(true)} />
              <KbKey label="space" dark onPress={() => tap(" ")} />
              <KbKey label="." dark narrow onPress={() => tap(".")} />
              <KbKey label="Done ✓" accent narrow onPress={() => onDone?.()} cls="!w-[72px]" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToastState();
  const studentRaw = sessionStorage.getItem("student");
  const student    = studentRaw ? JSON.parse(studentRaw) : null;

  if (!student) { navigate("/student"); return null; }

  const [tab, setTab]                   = useState("home");
  const [departments, setDepartments]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedDept, setSelectedDept] = useState(null);
  const [search, setSearch]             = useState("");
  const [filter, setFilter]             = useState("all");
  const [profPage, setProfPage]           = useState(1);
  const PROF_PAGE_SIZE = 9;
  const [reqModal, setReqModal]         = useState(null);
  const [reqForm, setReqForm]           = useState({ purpose: "", category: "Academic" });
  const [submitting, setSubmitting]     = useState(false);
  const purposeRef = useRef(null);
  const [myRequests, setMyRequests]     = useState([]);
  const [readIds, setReadIds]           = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("urs_read_ids") || "[]")); }
    catch { return new Set(); }
  });
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [selectedReq, setSelectedReq]   = useState(null);

  const [profile, setProfile]               = useState({ ...student });
  const [profilePhoto, setProfilePhoto]     = useState(student.photo || null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showCamera, setShowCamera]         = useState(false);
  const [savingProfile, setSavingProfile]   = useState(false);
  const [studentQR, setStudentQR]           = useState(null);

  const prevAvail = useRef({});

  const fetchProfessors = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/teacher-logs`);
      res.data.forEach(dept => dept.professors.forEach(prof => {
        if (!prevAvail.current[prof.name] && prof.status === "Available") {
          addToast(`${prof.name} is now available!`, "success");
        }
        prevAvail.current[prof.name] = prof.status === "Available";
      }));
      setDepartments(res.data);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  const fetchInbox = useCallback(async () => {
    setLoadingInbox(true);
    try {
      const res = await axios.get(`${API_BASE}/consultation/history/${student.student_id}?page=1&limit=10`);
      const data = res.data?.data ?? res.data ?? [];
      setMyRequests(data);
    } catch (_) {}
    finally { setLoadingInbox(false); }
  }, [student.student_id]);

  useEffect(() => {
    fetchProfessors();
    const iv = setInterval(fetchProfessors, 30000);
    try {
      socket = io(SOCKET_URL || window.location.origin, { transports: ["polling"], reconnectionAttempts: 3 });
      socket.on("status_update", fetchProfessors);
    } catch (e) { console.warn("Socket unavailable:", e); }
    return () => { clearInterval(iv); socket?.disconnect(); };
  }, []);

  useEffect(() => { fetchInbox(); }, []); // load on mount for appointment banner
  useEffect(() => { if (tab === "inbox") fetchInbox(); }, [tab]);

  useEffect(() => {
    QRCodeLib.toDataURL(student.student_id, { width: 400, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
      .then(url => setStudentQR(url.split(",")[1]))
      .catch(() => {});
  }, [student.student_id]);

  const submitRequest = async () => {
    if (!reqForm.purpose.trim()) return addToast("Please describe your purpose.", "warning");
    // Check locally if student already has a pending request to this professor
    const hasPending = myRequests.some(r => r.professor_name === reqModal.name && r.status === "pending");
    if (hasPending) return addToast(`You already have a pending request with ${reqModal.name}. Wait for it to be resolved first.`, "warning");
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/consultation/request`, {
        student_id: student.student_id, student_name: student.full_name,
        course: student.course, professor_name: reqModal.name,
        department: reqModal.department, purpose: reqForm.purpose, category: reqForm.category,
      });
      socket?.emit("broadcast_request", {
        student_name: student.full_name, professor_name: reqModal.name,
        purpose: reqForm.purpose, category: reqForm.category, time: new Date().toLocaleTimeString(),
      });
      addToast("Request submitted!", "success");
      setReqModal(null);
    } catch (e) { addToast(e.response?.data?.error || "Request failed.", "error"); }
    finally { setSubmitting(false); }
  };

  const savePhotoOnly = async (photoDataUrl) => {
    setSavingProfile(true);
    try {
      const res = await axios.post(`${API_BASE}/student/update-profile`, {
        student_id: student.student_id, full_name: profile.full_name,
        course: profile.course, year_level: profile.year_level,
        department: profile.department, photo: photoDataUrl,
      });
      const saved = res.data.student;
      setProfile(p => ({ ...p, ...saved }));
      if (saved.photo) setProfilePhoto(saved.photo);
      const cur = JSON.parse(sessionStorage.getItem("student") || "{}");
      sessionStorage.setItem("student", JSON.stringify({ ...cur, ...saved }));
      addToast("Photo saved!", "success");
    } catch (e) { addToast("Failed to save photo.", "error"); }
    finally { setSavingProfile(false); }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await axios.post(`${API_BASE}/student/update-profile`, {
        student_id: student.student_id, full_name: profile.full_name,
        course: profile.course, year_level: profile.year_level,
        department: profile.department, photo: profilePhoto,
      });
      const saved = res.data.student;
      setProfile(p => ({ ...p, ...saved }));
      if (saved.photo) setProfilePhoto(saved.photo);
      const cur = JSON.parse(sessionStorage.getItem("student") || "{}");
      sessionStorage.setItem("student", JSON.stringify({ ...cur, ...saved }));
      addToast("Profile updated!", "success");
      setEditingProfile(false);
      } catch (e) { addToast("Failed to save profile.", "error"); }
    finally { setSavingProfile(false); }
  };

  const downloadID = () => generateIDCard({
    name: profile.full_name, subtitle: profile.course,
    idNumber: student.student_id, role: `${profile.year_level} · ${profile.department}`,
    photo: profilePhoto, qrBase64: studentQR, type: "student",
  });

  const totalAvail    = departments.reduce((a, d) => a + d.professors.filter(p => p.status === "Available").length, 0);
  const currentDept   = selectedDept ? departments.find(d => d.department === selectedDept) : null;
  const allFilteredProfs = currentDept
    ? currentDept.professors.filter(p => {
        const ms = p.name.toLowerCase().includes(search.toLowerCase());
        const mf = filter === "all" || p.status === "Available";
        return ms && mf;
      })
    : [];
  const filteredProfs = allFilteredProfs.slice((profPage-1)*PROF_PAGE_SIZE, profPage*PROF_PAGE_SIZE);
  const profTotalPages = Math.ceil(allFilteredProfs.length / PROF_PAGE_SIZE);

  const TABS = [
    { id: "home",    icon: <GraduationCap size={16} />, label: "Faculty" },
    { id: "inbox",   icon: <Inbox size={16} />,          label: "Inbox" },
    { id: "profile", icon: <User size={16} />,            label: "My Profile" },
  ];

  return (
    <PageWrapper>
      <Toast toasts={toasts} removeToast={removeToast} />
      <URSHeader
        subtitle="Student Dashboard"
        user={{ name: student.full_name, sub: student.student_id }}
        onLogout={() => { sessionStorage.removeItem("student"); navigate("/student"); }}
      />

      {/* Tab bar */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pt-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-all
                ${tab === t.id ? "bg-white/15 text-white border-b-2 border-[#ffa000]" : "text-white/50 hover:text-white/80"}`}>
              {t.icon}{t.label}
              {t.id === "inbox" && myRequests.filter(r => r.appointment_date && r.status === "pending").length > 0 && (
                <span className="bg-[#ffa000] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {myRequests.filter(r => r.appointment_date && r.status === "pending").length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 py-6 max-w-5xl mx-auto w-full">

        {/* ── FACULTY TAB ── */}
        {tab === "home" && (
          <>
            {/* ── Appointment Alert Banner ── */}
            {myRequests.filter(r => r.appointment_date && r.status === "pending").length > 0 && (
              <div className="mb-4 animate-slide-up">
                {myRequests.filter(r => r.appointment_date && r.status === "pending").map(req => (
                  <div key={req.id}
                    className="flex items-start gap-3 bg-orange-500 rounded-2xl p-4 shadow-xl border border-orange-400 cursor-pointer"
                    onClick={() => setTab("inbox")}>
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0 text-xl">📅</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">New Appointment Set!</p>
                      <p className="text-white/90 text-xs mt-0.5 truncate">
                        {req.professor_name} — {new Date(req.appointment_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} at {req.appointment_time || "TBD"}
                      </p>
                      {req.appointment_notes && (
                        <p className="text-white/75 text-xs mt-0.5 italic truncate">"{req.appointment_notes}"</p>
                      )}
                    </div>
                    <span className="text-white/80 text-xs font-semibold shrink-0 mt-1">View →</span>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-gradient-to-r from-[#003366] to-[#0055aa] rounded-3xl p-5 text-white shadow-xl mb-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
                    {profilePhoto ? <img src={profilePhoto} alt="" className="w-full h-full object-cover" /> : <GraduationCap size={24} />}
                  </div>
                  <div>
                    <p className="font-display font-bold text-lg leading-tight">{student.full_name}</p>
                    <p className="text-white/60 text-xs mt-0.5">{student.course} · {student.year_level} · {student.student_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-3xl font-display font-black text-[#ffa000]">{totalAvail}</p>
                    <p className="text-white/50 text-xs">available now</p>
                  </div>
                  <button onClick={() => { setLoading(true); fetchProfessors(); }}
                    className="w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl flex items-center justify-center transition-all">
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
            </div>

            {selectedDept && currentDept ? (
              <div className="animate-slide-up">
                <button onClick={() => { setSelectedDept(null); setSearch(""); setFilter("all"); }}
                  className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors">
                  <ChevronLeft size={16} /> Back to Departments
                </button>
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-4 mb-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                    {DEPT_ICONS[selectedDept] || "🎓"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display font-bold text-white leading-tight">{selectedDept}</h2>
                    <p className="text-white/50 text-xs mt-0.5">
                      {currentDept.professors.length} professors · <span className="text-emerald-400 font-semibold">
                        {currentDept.professors.filter(p => p.status === "Available").length} available
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                    <input className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/30
                                     rounded-2xl px-4 py-3 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
                      placeholder="Search professor..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <div className="flex gap-1 bg-white/10 border border-white/20 rounded-2xl p-1">
                    {[["all", "All"], ["available", "Available"]].map(([v, l]) => (
                      <button key={v} onClick={() => setFilter(v)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
                          ${filter === v ? "bg-white text-[#003366] shadow" : "text-white/60 hover:text-white"}`}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {filteredProfs.map(prof => {
                    const isAvail = prof.status === "Available";
                    const initials = prof.name
                      .replace(/^(Engr\.|Dr\.|Prof\.|AR\.)\s*/i, "")
                      .split(" ").filter(Boolean).slice(0, 2)
                      .map(w => w[0]).join("").toUpperCase();
                    return (
                      <button
                        key={prof.name}
                        disabled={!isAvail || (prof.slots_left !== null && prof.slots_left !== undefined && prof.slots_left === 0)}
                        onClick={() => {
                          if (!isAvail) return;
                          if (prof.slots_left !== null && prof.slots_left !== undefined && prof.slots_left === 0) {
                            addToast("This professor has no more consultation slots available today.", "warning");
                            return;
                          }
                          setReqModal({ ...prof, department: selectedDept });
                          setReqForm({ purpose: "", category: "Academic" });
                        }}
                        className={`relative flex flex-col items-center rounded-2xl overflow-hidden transition-all active:scale-95
                          ${isAvail
                            ? "shadow-xl hover:shadow-2xl hover:-translate-y-0.5 cursor-pointer"
                            : "opacity-50 cursor-not-allowed"}`}>

                        {/* Full-bleed image / initials background */}
                        <div className={`w-full aspect-square overflow-hidden flex items-center justify-center relative
                          ${isAvail ? "bg-[#003366]" : "bg-white/10"}`}>
                          {prof.photo
                            ? <img src={prof.photo} alt={prof.name} className="w-full h-full object-cover" />
                            : <span className="text-white font-display font-bold text-4xl leading-none">{initials}</span>
                          }

                          {/* Dark gradient overlay at bottom for text readability */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                          {/* Name + status overlaid on image */}
                          <div className="absolute bottom-0 inset-x-0 px-2 pb-2 pt-4 flex flex-col items-center gap-1">
                            <p className="text-white text-xs font-bold text-center leading-tight line-clamp-2 drop-shadow">
                              {prof.name.replace(/^(Engr\.|Dr\.|Prof\.|AR\.)\s*/i, "")}
                            </p>
                            {isAvail
                              ? <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/30 border border-emerald-400/50 px-2 py-0.5 rounded-full backdrop-blur-sm">Available</span>
                              : <span className="text-[9px] font-medium text-white/50">{prof.status}</span>
                            }
                            {prof.day_limit > 0 && prof.slots_left !== null && prof.slots_left !== undefined && (
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm
                                ${prof.slots_left === 0
                                  ? "text-red-300 bg-red-500/30 border border-red-400/50"
                                  : prof.slots_left <= 2
                                  ? "text-yellow-300 bg-yellow-500/30 border border-yellow-400/50"
                                  : "text-blue-300 bg-blue-500/30 border border-blue-400/50"}`}>
                                {prof.slots_left === 0 ? "Full" : `${prof.slots_left}/${prof.day_limit} left`}
                              </span>
                            )}
                          </div>

                          {/* Status dot */}
                          <span className={`absolute top-2 right-2 w-3 h-3 rounded-full border-2 border-white/60 shadow
                            ${isAvail ? "bg-emerald-400" : "bg-slate-400"}`} />
                        </div>

                        {/* Corner highlights for available professors */}
                        {isAvail && (<>
                          <span className="absolute top-0 left-0 w-5 h-5 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-2xl pointer-events-none" />
                          <span className="absolute top-0 right-0 w-5 h-5 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-2xl pointer-events-none" />
                          <span className="absolute bottom-0 left-0 w-5 h-5 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-2xl pointer-events-none" />
                          <span className="absolute bottom-0 right-0 w-5 h-5 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-2xl pointer-events-none" />
                        </>)}

                      {/* Schedule slots */}
                      {(() => {
                        const today = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date().getDay()];
                        const sched = prof.weekly_schedule;
                        if (!sched || !sched[today] || sched[today].unavailable) return (
                          <div className="w-full px-2 py-1.5 bg-black/30">
                            <p className="text-[9px] text-white/40 text-center">No class today</p>
                          </div>
                        );
                        const day = sched[today];
                        const slots = day.slots || (day.start ? [{ start: day.start, end: day.end }] : []);
                        return (
                          <div className="w-full px-2 py-1.5 bg-black/40 space-y-0.5">
                            {slots.slice(0,2).map((sl, i) => (
                              <p key={i} className="text-[8px] text-white/70 text-center font-mono">
                                🕐 {sl.start} – {sl.end}
                              </p>
                            ))}
                            {day.limit && <p className="text-[8px] text-[#ffa000] text-center font-bold">{day.limit} slots</p>}
                          </div>
                        );
                      })()}
                      </button>
                    );
                  })}
                </div>

                {/* Prof Pagination */}
                {profTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                    <p className="text-white/40 text-xs">{((profPage-1)*PROF_PAGE_SIZE)+1}–{Math.min(profPage*PROF_PAGE_SIZE,allFilteredProfs.length)} of {allFilteredProfs.length}</p>
                    <div className="flex gap-2">
                      <button onClick={()=>setProfPage(p=>Math.max(1,p-1))} disabled={profPage===1}
                        className="px-3 py-1.5 text-xs font-semibold bg-white/10 border border-white/20 rounded-xl text-white/60 hover:text-white disabled:opacity-30 transition-all">← Prev</button>
                      <span className="px-2 py-1.5 text-xs text-white/40">{profPage}/{profTotalPages}</span>
                      <button onClick={()=>setProfPage(p=>Math.min(profTotalPages,p+1))} disabled={profPage===profTotalPages}
                        className="px-3 py-1.5 text-xs font-semibold bg-white/10 border border-white/20 rounded-xl text-white/60 hover:text-white disabled:opacity-30 transition-all">Next →</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="animate-slide-up">
                <div className="mb-4">
                  <h2 className="font-display font-bold text-xl text-white">Faculty Departments</h2>
                  <p className="text-white/50 text-sm mt-0.5">Select a department to view availability</p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {departments.map((dept, i) => {
                    const avail = dept.professors.filter(p => p.status === "Available").length;
                    const total = dept.professors.length;
                    const pct   = total > 0 ? Math.round((avail / total) * 100) : 0;
                    return (
                      <button key={dept.department}
                        onClick={() => { setSelectedDept(dept.department); setSearch(""); setFilter("all"); setProfPage(1); }}
                        className="group flex flex-col gap-3 p-5 text-left bg-white/10 hover:bg-white/18
                                   backdrop-blur-xl border border-white/20 hover:border-white/35 rounded-3xl
                                   transition-all active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-2xl
                                   h-full min-h-[160px]"
                        style={{ animationDelay: `${i * 60}ms` }}>
                        <div className="flex items-start justify-between">
                          <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center
                                         text-3xl group-hover:scale-110 transition-transform duration-200">
                            {DEPT_ICONS[dept.department] || "🎓"}
                          </div>
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold
                            ${avail > 0
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-white/10 text-white/40 border border-white/15"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${avail > 0 ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
                            {avail} available
                          </div>
                        </div>
                        <div>
                          <p className="font-display font-bold text-white text-base leading-snug">{dept.department}</p>
                          <p className="text-white/40 text-xs mt-1 flex items-center gap-1"><Users size={10} />{total} professors</p>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-white/40 mb-1">
                            <span>Availability</span><span>{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${avail > 0 ? "bg-emerald-400" : "bg-white/20"}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── INBOX TAB ── */}
        {tab === "inbox" && (
          <div className="animate-slide-up space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-xl text-white">Inbox</h2>
                <p className="text-white/50 text-sm mt-0.5">
                  {myRequests.filter(r => !readIds.has(r.id)).length > 0
                    ? `${myRequests.filter(r => !readIds.has(r.id)).length} unread`
                    : "All caught up"}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => {
                  const all = new Set(myRequests.map(r => r.id));
                  setReadIds(all);
                  localStorage.setItem("urs_read_ids", JSON.stringify([...all]));
                }}
                  className="text-xs text-white/40 hover:text-white bg-white/10 px-3 py-2 rounded-xl border border-white/20 transition-all">
                  Mark all read
                </button>
                <button onClick={fetchInbox}
                  className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs bg-white/10 px-3 py-2 rounded-xl border border-white/20 transition-all">
                  <RefreshCw size={12} className={loadingInbox ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {loadingInbox ? (
              <div className="flex justify-center py-16"><Spinner size={10} light /></div>
            ) : myRequests.length === 0 ? (
              <div className="text-center py-16 text-white/40">
                <Inbox size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No requests yet</p>
                <p className="text-sm mt-1">Submit a consultation request to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myRequests.map(req => {
                  const isRead     = readIds.has(req.id);
                  const hasAppt    = !!req.appointment_date;
                  const isDone     = req.status === "done";
                  const isDeclined = req.status === "declined";
                  const isPending  = req.status === "pending";

                  const markRead = () => {
                    if (!isRead) {
                      const next = new Set(readIds); next.add(req.id);
                      setReadIds(next);
                      localStorage.setItem("urs_read_ids", JSON.stringify([...next]));
                    }
                  };

                  const borderColor = hasAppt  ? "border-l-orange-400"
                    : isDone     ? "border-l-emerald-400"
                    : isDeclined ? "border-l-red-400"
                    :              "border-l-yellow-400";

                  const badgeCls = hasAppt  ? "bg-orange-400/20 text-orange-200 border-orange-400/40"
                    : isDone     ? "bg-emerald-400/20 text-emerald-200 border-emerald-400/40"
                    : isDeclined ? "bg-red-400/20 text-red-200 border-red-400/40"
                    :              "bg-yellow-400/20 text-yellow-100 border-yellow-400/40";

                  const badgeLabel = hasAppt ? "📅 Appointment Set"
                    : isDone     ? "✅ Done"
                    : isDeclined ? "❌ Declined"
                    :              "⏳ Pending";

                  return (
                    <div key={req.id}
                      className={`relative bg-white/10 backdrop-blur-xl border border-white/20
                                  rounded-2xl p-4 border-l-4 ${borderColor} transition-all
                                  ${!isRead ? "ring-1 ring-white/20" : "opacity-80"}`}
                      onClick={markRead}>

                      {/* Unread dot */}
                      {!isRead && (
                        <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-[#ffa000] rounded-full" />
                      )}

                      {/* Top row */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#003366] to-[#0055aa]
                                        flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {req.professor_name?.replace(/^(Engr\.|Dr\.|Prof\.|AR\.)\s*/i,"")
                            .split(" ").filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{req.professor_name}</p>
                          <p className="text-white/50 text-xs">{req.category} · {req.department?.replace(" Department","")}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border shrink-0 ${badgeCls}`}>
                          {badgeLabel}
                        </span>
                      </div>

                      {/* Purpose */}
                      <p className="text-white/70 text-xs italic mb-3 line-clamp-2">"{req.purpose}"</p>

                      {/* Appointment details */}
                      {hasAppt && (
                        <div className="bg-orange-500/15 border border-orange-400/30 rounded-xl px-3 py-2 mb-3">
                          <p className="text-orange-200 text-xs font-bold mb-0.5">📅 Appointment Details</p>
                          <p className="text-white text-sm font-semibold">
                            {new Date(req.appointment_date).toLocaleDateString("en-PH",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
                            {req.appointment_time && ` at ${req.appointment_time}`}
                          </p>
                          {req.appointment_notes && (
                            <p className="text-white/60 text-xs mt-1 italic">"{req.appointment_notes}"</p>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <p className="text-white/30 text-xs">
                          {req.request_time ? new Date(req.request_time).toLocaleDateString("en-PH",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : ""}
                        </p>
                        <button onClick={e => { e.stopPropagation(); setSelectedReq(req); }}
                          className="text-xs text-white/50 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-all">
                          View Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {tab === "profile" && (
          <div className="animate-slide-up max-w-lg mx-auto">
            <div className="mb-5">
              <h2 className="font-display font-bold text-xl text-white">My Profile & Student ID</h2>
              <p className="text-white/50 text-sm mt-0.5">Edit your information and generate your ID card</p>
            </div>
            {showCamera ? (
              <div className="bg-white rounded-3xl p-6 shadow-2xl animate-bounce-in">
                <WebcamCapture
                  title="Take Your ID Photo"
                  onCapture={(dataUrl) => { setProfilePhoto(dataUrl); setShowCamera(false); savePhotoOnly(dataUrl); }}
                  onCancel={() => setShowCamera(false)}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                      {profilePhoto ? <img src={profilePhoto} alt="" className="w-full h-full object-cover" /> : <User size={32} className="text-white/30" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-display font-bold text-white">{profile.full_name}</p>
                      <p className="text-white/50 text-xs mt-0.5">{profile.course} · {profile.year_level}</p>
                      <p className="text-white/40 text-xs">{student.student_id}</p>
                    </div>
                    <button onClick={() => setShowCamera(true)}
                      className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs
                                 bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-2 rounded-xl transition-all">
                      <Camera size={13} /> {profilePhoto ? "Retake" : "Add Photo"}
                    </button>
                  </div>
                  <IDCardPreview
                    name={profile.full_name} subtitle={profile.course}
                    idNumber={student.student_id} role={`${profile.year_level} · ${profile.department}`}
                    photo={profilePhoto} qrBase64={studentQR} type="student"
                  />
                  <button onClick={downloadID}
                    className="w-full flex items-center justify-center gap-2 mt-4 bg-[#003366] hover:bg-[#004080]
                               text-white font-semibold py-3 rounded-2xl transition-all text-sm">
                    <Download size={15} /> Download Student ID
                  </button>
                </div>
                <div className="bg-white/95 rounded-3xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-bold text-[#003366]">Edit Information</h3>
                    <button onClick={() => { setEditingProfile(v => !v); }}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#003366] transition-colors">
                      <Pencil size={12} /> {editingProfile ? "Cancel" : "Edit"}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Full Name",        key: "full_name", placeholder: "Your full name",             max: 80  },
                      { label: "Course / Program", key: "course",    placeholder: "e.g. BS Computer Engineering", max: 100 },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">{f.label}</label>
                        {editingProfile ? (
                          <input
                            type="text"
                            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366]
                                       focus:bg-white transition-all"
                            placeholder={f.placeholder}
                            value={profile[f.key] || ""}
                            onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value.slice(0, f.max) }))}
                            maxLength={f.max}
                          />
                        ) : (
                          /* Read-only display when not editing */
                          <div className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-500 opacity-60 min-h-[42px]">
                            {profile[f.key] || f.placeholder}
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Year Level</label>
                        <select className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm
                                          focus:outline-none focus:ring-2 focus:ring-[#003366]/20 disabled:opacity-60"
                          value={profile.year_level} disabled={!editingProfile}
                          onChange={e => setProfile(p => ({ ...p, year_level: e.target.value }))}>
                          {YEAR_LEVELS.map(y => <option key={y}>{y}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Department</label>
                        <select className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm
                                          focus:outline-none focus:ring-2 focus:ring-[#003366]/20 disabled:opacity-60"
                          value={profile.department} disabled={!editingProfile}
                          onChange={e => setProfile(p => ({ ...p, department: e.target.value }))}>
                          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                    {editingProfile && (
                      <button onClick={saveProfile} disabled={savingProfile}
                        className="w-full flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080]
                                   text-white font-semibold py-3 rounded-2xl transition-all text-sm disabled:opacity-50">
                        {savingProfile ? <Spinner size={4} light /> : <CheckIcon />}
                        {savingProfile ? "Saving..." : "Save Changes"}
                      </button>
                    )}
                  </div>

                </div>


              </div>
            )}
          </div>
        )}
      </div>
      {/* ══════════════════════════════════════════════════════════════════════
          REQUEST CONSULTATION — FULL SCREEN
          Layout: fixed column → header (shrink-0) | scroll body (flex-1 min-h-0)
                               | action footer (shrink-0) | keyboard (shrink-0)
          The keyboard is the LAST item in the flex column.
          It naturally pushes the footer buttons upward without any JS tricks.
      ══════════════════════════════════════════════════════════════════════ */}
      {reqModal && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-white"
          style={{ animation: "reqIn 0.18s ease both" }}>
          <style>{`@keyframes reqIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>

          {/* ① Header ── fixed height, never scrolls */}
          <div className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-3 bg-white">
            <button
              onPointerDown={e => { e.preventDefault(); setReqModal(null); }}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold text-base text-[#003366]">Request Consultation</h2>
              <p className="text-gray-400 text-xs truncate">{reqModal.name} · {reqModal.department}</p>
            </div>
            <StatusBadge status={reqModal.status} />
          </div>

          {/* ② Scrollable form — shrinks when keyboard is mounted below */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5">

            {/* Teacher card — left-aligned banner with large circular photo */}
            <div className="relative rounded-2xl overflow-hidden border border-blue-100 shadow-md bg-gradient-to-br from-[#003366] to-[#0055aa]">
              {/* Blurred bg from photo */}
              {reqModal.photo && (
                <img src={reqModal.photo} alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm scale-110 pointer-events-none" />
              )}
              <div className="relative flex flex-row items-center gap-5 py-5 px-5">
                {/* Large circular photo / initials */}
                <div className="w-32 h-32 rounded-full overflow-hidden flex items-center justify-center bg-white/20 border-4 border-white/50 shadow-xl shrink-0">
                  {reqModal.photo
                    ? <img src={reqModal.photo} alt={reqModal.name} className="w-full h-full object-cover" />
                    : <span className="text-white font-display font-bold text-4xl leading-none">
                        {reqModal.name.replace(/^(Engr\.|Dr\.|Prof\.|AR\.)\s*/i,"").split(" ").filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase()}
                      </span>
                  }
                </div>
                {/* Name & dept — left aligned */}
                <div className="flex flex-col gap-1">
                  <p className="font-display font-bold text-white text-xl leading-tight">{reqModal.name}</p>
                  <p className="text-white/60 text-sm">{reqModal.department}</p>
                  <span className="inline-flex items-center gap-1.5 mt-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 rounded-full w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Available
                  </span>
                </div>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">Category</label>
              <div className="flex flex-wrap gap-2">
                {CONSULTATION_CATEGORIES.map(c => (
                  <button key={c}
                    onClick={() => setReqForm(p => ({ ...p, category: c }))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border
                      ${reqForm.category === c
                        ? "bg-[#003366] text-white border-[#003366] shadow"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#003366]/40"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Purpose */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Purpose</label>
                <span className={`text-xs font-semibold tabular-nums
                  ${(300 - reqForm.purpose.length) < 50 ? "text-red-400" : "text-gray-300"}`}>
                  {reqForm.purpose.length}/300
                </span>
              </div>
              <textarea
                ref={purposeRef}
                value={reqForm.purpose}
                onChange={e => setReqForm(p => ({ ...p, purpose: e.target.value.slice(0, 300) }))}
                placeholder="Describe your consultation purpose…"
                rows={4}
                className="w-full border border-gray-200 bg-gray-50 hover:border-[#003366]/40
                           focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/15 focus:bg-white
                           rounded-2xl px-4 py-4 text-sm text-gray-800 placeholder:text-gray-400
                           transition-all resize-none outline-none leading-relaxed"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="shrink-0 flex gap-3 px-5 py-4 bg-white">
            <button
              onPointerDown={e => { e.preventDefault(); setReqModal(null); }}
              className="flex-1 border-2 border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white
                         font-semibold py-3.5 rounded-2xl transition-all text-sm">
              Cancel
            </button>
            <button
              onClick={submitRequest}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080]
                         text-white font-semibold py-3.5 rounded-2xl transition-all text-sm disabled:opacity-50">
              {submitting ? <Spinner size={4} light /> : <Send size={14} />}
              {submitting ? "Sending…" : "Submit Request"}
            </button>
          </div>
        </div>
      )}

      {/* ── REQUEST DETAIL MODAL ── */}
      {selectedReq && (() => {
        const req = selectedReq;
        const hasAppt    = !!req.appointment_date;
        const isDone     = req.status === "done";
        const isDeclined = req.status === "declined";

        const statusCfg = hasAppt
          ? { label: "Appointment Set", icon: "📅", bar: "bg-orange-400",  text: "text-orange-600",  bg: "bg-orange-50" }
          : isDone
          ? { label: "Done",            icon: "✅", bar: "bg-emerald-400", text: "text-emerald-600", bg: "bg-emerald-50" }
          : isDeclined
          ? { label: "Declined",        icon: "❌", bar: "bg-red-400",     text: "text-red-600",     bg: "bg-red-50" }
          : { label: "Pending",         icon: "⏳", bar: "bg-yellow-400",  text: "text-yellow-600",  bg: "bg-yellow-50" };

        return (
          <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setSelectedReq(null)} />

            {/* Sheet */}
            <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
              style={{ animation: "sheetUp 0.22s cubic-bezier(0.34,1.2,0.64,1) both" }}>
              <style>{`@keyframes sheetUp{from{transform:translateY(100%);opacity:0}to{transform:none;opacity:1}}`}</style>

              {/* Status colour bar */}
              <div className={`h-1.5 w-full ${statusCfg.bar}`} />

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{statusCfg.icon}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                    {statusCfg.label}
                  </span>
                </div>
                <button onClick={() => setSelectedReq(null)}
                  className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                  <X size={14} className="text-gray-500" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4">

                {/* Professor */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Professor</p>
                  <p className="font-display font-bold text-[#003366] text-base">{req.professor_name}</p>
                  <p className="text-gray-400 text-xs">{req.department}</p>
                </div>

                {/* Category + Purpose */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Category</p>
                  <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {req.category}
                  </span>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Purpose</p>
                  <p className="text-gray-700 text-sm leading-relaxed italic">"{req.purpose}"</p>
                </div>

                {/* Request time */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Requested On</p>
                  <p className="text-gray-600 text-sm">
                    {req.request_time ? new Date(req.request_time).toLocaleString("en-PH", {
                      month: "long", day: "numeric", year: "numeric",
                      hour: "numeric", minute: "2-digit", hour12: true
                    }) : "—"}
                  </p>
                </div>

                {/* Appointment block */}
                {hasAppt && (
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">📅 Appointment Details</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-gray-400 font-semibold mb-0.5">Date</p>
                        <p className="text-gray-800 text-sm font-bold">
                          {new Date(req.appointment_date).toLocaleDateString("en-PH", {
                            weekday: "short", month: "short", day: "numeric", year: "numeric"
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-semibold mb-0.5">Time</p>
                        <p className="text-gray-800 text-sm font-bold">{formatTime(req.appointment_time) || "—"}</p>
                      </div>
                    </div>
                    {req.appointment_notes && (
                      <div>
                        <p className="text-[10px] text-gray-400 font-semibold mb-0.5">Notes from Professor</p>
                        <p className="text-gray-700 text-xs italic">"{req.appointment_notes}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 pb-5">
                <button onClick={() => setSelectedReq(null)}
                  className="w-full bg-[#003366] hover:bg-[#004080] text-white font-semibold py-3 rounded-2xl transition-all text-sm">
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </PageWrapper>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}