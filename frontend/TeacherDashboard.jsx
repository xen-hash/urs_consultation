import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { io } from "socket.io-client";
import {
  CheckCircle2, XCircle, Calendar, Download, Trash2, Bell,
  RefreshCw, ClipboardList, Sliders, BookOpen, Clock,
  Pencil, X, Check, User, Camera, CalendarCheck, FileText,
  RotateCcw, AlertTriangle
} from "lucide-react";
import {
  URSHeader, StatusBadge, Badge, Button, IconButton, Alert, Card, EmptyState,
  Toast, useToastState, PageWrapper, Modal, ConfirmModal, NumberField, Spinner,
  useScrollLock, ConfirmSplash,
} from "./SharedUI.jsx";
import ScheduleModal from "./ScheduleModal.jsx";
import Walkthrough, { hasSeenTour } from "./ui/Walkthrough.jsx";
import { teacherTour } from "./ui/tours.js";
import { WebcamCapture, IDCardPreview, generateIDCard } from "./ProfileEditor.jsx";
import BottomNav, { BottomNavSpacer } from "./ui/BottomNav.jsx";
import api, { apiError } from "./httpClient.js";
import { getSession, patchProfile, clearSession, getToken } from "./auth.js";
import { SOCKET_URL, DAYS, DAY_LABELS } from "./constants.js";
import QRCodeLib from "qrcode";

let socket = null;
const MANUAL_OPTIONS = ["Auto (use schedule)","Available","Unavailable","On Leave","In Meeting"];
const STATUS_STYLES = {
  "Available":"bg-success-50 border-success/25 text-success",
  "Unavailable":"bg-surface-2 border-border text-muted-fg",
  "On Leave":"bg-amber-50 border-amber-200 text-amber-700",
  "In Meeting":"bg-orange-50 border-orange-200 text-orange-700",
  "Auto (use schedule)":"bg-info-50 border-info/25 text-info",
};

function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function ding() {
  try {
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [0,200].forEach(d=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=660;g.gain.setValueAtTime(0.25,ctx.currentTime+d/1000);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+d/1000+0.3);o.start(ctx.currentTime+d/1000);o.stop(ctx.currentTime+d/1000+0.35);});
  } catch(_){}
}

const _teacherSeenIds = new Set();
const LIMIT_KEY = "urs.teacher.dailyLimit";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
};

/** One number, labelled. The row of these is what turns a list of cards into a
 *  dashboard: how the day stands, before what to do about it. */
function StatTile({ label, value, icon: Icon, tone = "default" }) {
  const tones = {
    default: "text-fg",
    success: "text-success",
    warning: "text-warning-fg",
  };
  return (
    <div className="card p-3.5 sm:p-4">
      <p className="flex items-center gap-2 text-muted-fg mb-1 text-xs font-semibold uppercase tracking-wide">
        <Icon size={14} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </p>
      <p className={`text-xl sm:text-2xl font-bold tabular-nums ${tones[tone]}`}>{value}</p>
    </div>
  );
}
const _ttsQueue = [];
let _ttsBusy = false;

function _ttsPlayNext() {
  if (_ttsBusy || _ttsQueue.length === 0) return;
  if (!window.speechSynthesis) return;
  _ttsBusy = true;
  const text = _ttsQueue.shift();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US"; utter.rate = 0.95; utter.pitch = 1.0;
  utter.onend = () => { _ttsBusy = false; setTimeout(_ttsPlayNext, 500); };
  utter.onerror = () => { _ttsBusy = false; setTimeout(_ttsPlayNext, 500); };
  window.speechSynthesis.speak(utter);
}

function piperSpeak(text) {
  if (!window.speechSynthesis) return;
  _ttsQueue.push(text);
  _ttsPlayNext();
}

function getFirstName(fullName) {
  return (fullName || "").replace(/^(Engr\.|Dr\.|Prof\.|AR\.|Mr\.|Ms\.|Mrs\.)\s*/i, "").split(" ")[0];
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToastState();
  const [signingOut, setSigningOut] = useState(false);
  const teacher = getSession("teacher");

  // Rendered redirect, not an imperative one. Calling navigate() during
  // render pushed a history entry on every render, so swiping back re-
  // rendered this and pushed another — the back gesture could never escape.
  if (!teacher) return <Navigate to="/teacher" replace />;

  const [tab, setTab]               = useState("requests");
  const [requests, setRequests]     = useState([]);
  const [ticker, setTicker]         = useState([]);
  const [schedModal, setSchedModal] = useState(false);
  const [myStatus, setMyStatus]     = useState("Auto (use schedule)");
  const [mySchedule, setMySchedule] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [apptModal, setApptModal]   = useState(null);
  const [apptForm, setApptForm]     = useState({ date:"", time:"", notes:"" });
  const [savingAppt, setSavingAppt] = useState(false);
  // Stored on the account, not in this browser. It is a statement about the
  // teacher's own day, so it should follow them to another device — and the
  // public board needs it, or someone who has taken all they can still shows
  // as free. The cached value is only the opening guess while the profile
  // loads, so the field does not flicker from 10 to their real number.
  const [consultLimit, setConsultLimit] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem(LIMIT_KEY) || "", 10);
      return Number.isNaN(saved) ? 10 : Math.min(100, Math.max(1, saved));
    } catch { return 10; }
  });
  const [savingLimit, setSavingLimit] = useState(false);
  const [accepted, setAccepted]         = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [tourOpen, setTourOpen]         = useState(() => !hasSeenTour("teacher"));
  const tourSteps = useMemo(() => teacherTour(setTab), []);
  // What the board is showing right now. On Auto that is the schedule's
  // verdict for today rather than the word "Auto", which is not a status
  // anybody outside this screen would recognise.
  const onAuto = myStatus === "Auto (use schedule)";
  const todaySlots = (() => {
    const day = DAYS[(new Date().getDay() + 6) % 7];
    const d = mySchedule?.[day];
    return (!d?.unavailable && d?.slots?.length) ? d.slots : null;
  })();
  const effectiveStatus = onAuto
    ? (todaySlots ? "Available" : "Unavailable")
    : myStatus;

  const firstName = (teacher?.professor_name || "")
    .replace(/^(Engr\.|Dr\.|Prof\.|AR\.)\s*/i, "").split(" ")[0] || "there";
  const [deleteBusy, setDeleteBusy]     = useState(false);
  const [reqPage, setReqPage]           = useState(1);
  const REQ_PAGE_SIZE = 10;
  const [resettingSession, setResettingSession] = useState(false);

  // Profile state
  const [profilePhoto, setProfilePhoto] = useState(teacher.photo || null);
  const [showCamera, setShowCamera]     = useState(false);
  const [teacherQR, setTeacherQR]       = useState(null);
  const [editName, setEditName]         = useState(false);
  const [newName, setNewName]           = useState(teacher.professor_name);
  const [savingName, setSavingName]     = useState(false);
  const [settingPin, setSettingPin]     = useState(false);
  const [pinForm, setPinForm]           = useState({ pin: '', confirm: '' });
  const [savingPin, setSavingPin]       = useState(false);
  const [hasPin, setHasPin]             = useState(teacher.has_pin || false);

  const prevCount   = useRef(-1);
  const hasWelcomed = useRef(false);

  const fetchRequests = useCallback(async () => {
    if (!teacher) return;
    try {
      const res = await api.get(`/teacher/requests/${teacher.employee_id}`);
      const reqs = res.data || [];
      const unseenPending = reqs.filter(r => r.status === "pending" && !_teacherSeenIds.has(r.id));
      unseenPending.forEach((req, i) => {
        _teacherSeenIds.add(req.id);
        if (prevCount.current >= 0) {
          ding();
          const msg = `New request from ${getFirstName(req.student_name)}`;
          setTicker(t => [msg,...t].slice(0,5));
          addToast(`${msg} — ${req.category}`,"info");
        }
        setTimeout(() => {
          piperSpeak(`Paging ${getFirstName(teacher.professor_name)}, ${getFirstName(req.student_name)} is requesting.`);
        }, i * 300);
      });
      prevCount.current = reqs.length;
      setRequests(reqs);
    } catch(_){}
  }, [teacher]);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get(`/teacher/profile/${teacher.employee_id}`);
      if (res.data.photo) setProfilePhoto(res.data.photo);
      if (res.data.daily_limit > 0) setConsultLimit(res.data.daily_limit);
    } catch(_){}
  }, [teacher]);

  const saveLimit = async (value) => {
    setConsultLimit(value);
    setSavingLimit(true);
    try {
      const { data } = await api.post("/teacher/daily-limit", { daily_limit: value });
      addToast(data.message, "success");
    } catch (e) {
      addToast(apiError(e, "Could not save the limit."), "error");
    } finally {
      setSavingLimit(false);
    }
  };

  // The appointment sheet is a hand-rolled overlay rather than the shared
  // Modal, so it needs the scroll lock applied explicitly.
  useScrollLock(!!apptModal);

  // Survives a reload. Wrapped because a private window can throw on write.
  useEffect(() => {
    try { localStorage.setItem(LIMIT_KEY, String(consultLimit)); } catch { /* not fatal */ }
  }, [consultLimit]);

  useEffect(() => {
    fetchRequests(); fetchProfile();
    if (!hasWelcomed.current) {
      hasWelcomed.current = true;
      _teacherSeenIds.clear();
      piperSpeak(`Welcome, ${getFirstName(teacher.professor_name)}!`);
    }
    const iv = setInterval(fetchRequests, 15000);
    try {
      socket = io(SOCKET_URL || window.location.origin, { transports:["polling"], reconnectionAttempts:3 });
      socket.on("consultation_update", fetchRequests);
      socket.on("new_request", fetchRequests);
    } catch(e) { console.warn("Socket unavailable"); }

    // Intentionally encodes nothing scannable: a working faculty QR is issued by
    // the admin office and is a random serial, not this employee ID.
    Promise.resolve(null)
      .then(url => setTeacherQR(url.split(",")[1])).catch(()=>{});

    return () => { clearInterval(iv); socket?.disconnect(); };
  }, []);

  const handleDone = async (id) => {
    const req = requests.find(r => r.id === id);
    await api.post(`/teacher/requests/${id}/done`);
    socket?.emit("broadcast_request_done",{request_id:id,professor_name:teacher.professor_name});
    setRequests(p=>p.filter(r=>r.id!==id));
    setAccepted(p => { const n = new Set(p); n.delete(id); return n; });
    _teacherSeenIds.delete(id);
    addToast("Consultation completed.","success");
    if (req) piperSpeak(`Consultation completed. ${getFirstName(req.student_name)} has been served.`);
  };

  // Deleting is not declining. Declining is an answer the student gets to see;
  // this removes the row altogether, for the duplicates and mistakes that would
  // otherwise sit in the list all semester taking up space.
  const handleDelete = async (id) => {
    setDeleteBusy(true);
    try {
      await api.delete(`/teacher/requests/${id}`);
      setRequests(p => p.filter(r => r.id !== id));
      setAccepted(p => { const n = new Set(p); n.delete(id); return n; });
      _teacherSeenIds.delete(id);
      setConfirmDelete(null);
      addToast("Request deleted.", "success");
    } catch (e) {
      addToast(apiError(e, "Could not delete that request."), "error");
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleDecline = async (id) => {
    _teacherSeenIds.delete(id);
    await api.post(`/teacher/requests/${id}/decline`);
    setRequests(p=>p.filter(r=>r.id!==id));
    setAccepted(p => { const n = new Set(p); n.delete(id); return n; });
    addToast("Request declined.","info");
  };

  const handleSaveSchedule = async (schedule) => {
    await api.post(`/teacher/save-schedule`,{ weekly_schedule: schedule });
    setMySchedule(schedule);
    socket?.emit("broadcast_status",{professorName:teacher.professor_name,status:"Auto",weeklySchedule:schedule});
    addToast("Schedule saved!","success");
  };

  const handleSaveStatus = async () => {
    setSavingStatus(true);
    await api.post(`/teacher/save-manual-status`,{ manual_status: myStatus });
    socket?.emit("broadcast_status",{professorName:teacher.professor_name,status:myStatus});
    addToast(`Status updated: ${myStatus}`,"success");
    setSavingStatus(false);
  };

  const handleSetAppointment = async () => {
    if (!apptForm.date || !apptForm.time) return addToast("Date and time required.","warning");
    setSavingAppt(true);
    try {
      await api.post(`/teacher/requests/${apptModal.id}/appoint`, {
        appointment_date: apptForm.date,
        appointment_time: apptForm.time,
        appointment_notes: apptForm.notes
      });
      addToast("Appointment set! Student will see it in their inbox.","success");
      setApptModal(null);
      fetchRequests();
    } catch(e) { addToast("Failed to set appointment.","error"); }
    finally { setSavingAppt(false); }
  };

  const handleSaveName = async () => {
    if (!newName.trim() || newName.trim()===teacher.professor_name) return addToast("Enter a different name.","warning");
    setSavingName(true);
    try {
      await api.post(`/teacher/update-name`,{ new_name: newName.trim() });
      const updated = {...teacher, professor_name:newName.trim()};
      patchProfile("teacher", updated);
      addToast("Name updated!","success");
      setEditName(false);
      setTimeout(()=>window.location.reload(),800);
    } catch(e){ addToast("Failed to update name.","error"); }
    finally { setSavingName(false); }
  };

  const handleSavePhoto = async (dataUrl) => {
    setProfilePhoto(dataUrl);
    setShowCamera(false);
    try {
      await api.post(`/teacher/update-photo`, { photo: dataUrl });
      patchProfile("teacher", { photo: dataUrl });
      addToast("Photo saved!", "success");
    } catch(_) { addToast("Failed to save photo.", "error"); }
  };

  const handleSetPin = async () => {
    if (pinForm.pin.length !== 4 || !/^\d{4}$/.test(pinForm.pin))
      return addToast("PIN must be exactly 4 digits.", "warning");
    if (pinForm.pin !== pinForm.confirm)
      return addToast("PINs do not match.", "warning");
    setSavingPin(true);
    try {
      await api.post(`/auth/teacher/set-pin`, { pin: pinForm.pin, current_pin: pinForm.currentPin || undefined });
      const updated = { ...teacher, has_pin: true };
      patchProfile("teacher", updated);
      setHasPin(true);
      setSettingPin(false);
      setPinForm({ pin: '', confirm: '' });
      addToast("PIN set successfully! You can now log in with your ID + PIN.", "success");
    } catch(e) { addToast(e.response?.data?.error || "Failed to set PIN.", "error"); }
    finally { setSavingPin(false); }
  };

  const handleResetSession = async () => {
    if (!window.confirm("Reset today\'s consultation count? This will archive all today\'s requests and start a fresh session.")) return;
    setResettingSession(true);
    try {
      await api.post("/teacher/reset-daily-count");
      setRequests([]);
      setAccepted(new Set());
      addToast("Session reset! You can now accept a new batch of consultations.", "success");
      fetchRequests();
    } catch(e) { addToast("Failed to reset session.", "error"); }
    finally { setResettingSession(false); }
  };

  const downloadID = () => generateIDCard({
    name: teacher.professor_name, subtitle: teacher.department,
    idNumber: teacher.employee_id, role: "Faculty",
    photo: profilePhoto, qrBase64: teacherQR, type: "teacher"
  });

  // Components rather than elements, so the bottom bar can size them for touch.
  // Short labels too: "Status & Schedule" does not fit a third of a 320px
  // screen, so each tab carries the compact form the bar uses.
  const TABS = [
    { id:"requests", icon: ClipboardList, label:"Requests", short:"Requests", badge: requests.length },
    { id:"status",   icon: Sliders,       label:"Status & Schedule", short:"Schedule" },
    { id:"profile",  icon: User,          label:"My Profile & ID",   short:"Profile" },
  ];
  const NAV_ITEMS = TABS.map(t => ({ ...t, label: t.short }));

  return (
    <PageWrapper>
      <Toast toasts={toasts} removeToast={removeToast} />
      <ConfirmSplash
        open={signingOut}
        title="Signed out"
        subtitle="See you next time"
        tone="brand"
        onDone={() => { clearSession(); navigate("/teacher", { replace: true }); }}
      />
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete.id)}
        title="Delete this request?"
        description={confirmDelete
          ? `${confirmDelete.student_name}'s request will be removed for good — it will not appear in exports or reports afterwards. Declining instead keeps the record and tells them the answer.`
          : ""}
        confirmLabel="Delete request"
        tone="danger"
        loading={deleteBusy}
      />
      <Walkthrough
        id="teacher"
        steps={tourSteps}
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        onExit={() => setTab("requests")}
      />
      <URSHeader subtitle="Teacher Dashboard" accent="orange"
        onHelp={() => setTourOpen(true)}
        user={{ name: teacher.professor_name, sub: teacher.department }}
        onLogout={() => setSigningOut(true)} />

      {ticker.length > 0 && (
        <div className="bg-brand-900 border-b-2 border-accent py-3 px-5 flex items-center gap-4 overflow-hidden">
          <div className="flex items-center gap-2 shrink-0 bg-accent px-3 py-1 rounded-full">
            <Bell size={16} className="text-fg animate-bounce" />
            <span className="text-fg text-xs font-black uppercase tracking-widest">New Request</span>
          </div>
          <p className="whitespace-nowrap font-bold text-accent text-lg tracking-wide">
            {ticker.join("   ·   ")}
          </p>
        </div>
      )}

      {/* Desktop tab strip. On phones this is replaced by the bottom bar. */}
      <div className="hidden lg:block bg-surface border-b border-border">
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              aria-current={tab===t.id ? "page" : undefined}
              className={`flex items-center gap-2 px-4 min-h-[44px] text-sm font-semibold
                border-b-2 -mb-px transition-colors duration-200
                ${tab===t.id
                  ? "text-brand border-brand"
                  : "text-muted-fg border-transparent hover:text-fg"}`}>
              <t.icon size={16} aria-hidden="true" />{t.label}
              {t.badge>0 && (
                <span className="bg-accent text-brand-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full">

        {/* ── REQUESTS TAB ── */}
        {tab==="requests" && (
          <div className="space-y-3 animate-rise">
            {/* What the day looks like, before the list of things to do about it.
                The dashboard used to open on a bare heading and a form row —
                a teacher had to read every card to learn how their day stood. */}
            <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h2 className="text-title font-bold text-fg" data-tour="teacher-requests">
                  Good {greeting()}, {firstName}
                </h2>
                <p className="text-sm text-muted-fg mt-0.5">
                  {requests.length === 0
                    ? "Nothing waiting on you right now."
                    : `${requests.length} request${requests.length === 1 ? "" : "s"} waiting on you.`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" icon={RefreshCw} loading={refreshing}
                  onClick={async()=>{setRefreshing(true);await fetchRequests();setRefreshing(false);}}>
                  Refresh
                </Button>
                <Button size="sm" icon={RotateCcw} loading={resettingSession}
                  onClick={handleResetSession}
                  title="Archive today's consultations and start a new session">
                  New session
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
              <StatTile label="Waiting" value={requests.length} icon={ClipboardList} />
              <StatTile label="Accepted today" value={`${accepted.size}/${consultLimit}`}
                icon={CheckCircle2} tone={accepted.size >= consultLimit ? "warning" : "success"} />
              <StatTile label="Slots left" value={Math.max(0, consultLimit - accepted.size)}
                icon={Sliders} />
              <div className="card p-3.5 sm:p-4" data-tour="teacher-limit">
                <label htmlFor="daily-limit"
                  className="flex items-center gap-2 text-muted-fg mb-1 text-xs font-semibold uppercase tracking-wide">
                  <Sliders size={14} aria-hidden="true" /> Daily limit
                </label>
                <div className="flex items-center gap-2">
                  <NumberField
                    id="daily-limit"
                    value={consultLimit}
                    onCommit={saveLimit}
                    disabled={savingLimit}
                    min={1}
                    max={100}
                    aria-label="Daily consultation limit"
                    className="input w-20 text-center font-bold tabular-nums py-1.5" />
                  <span className="text-xs text-muted-fg">a day</span>
                </div>
              </div>
            </div>

            {requests.length===0 ? (
              <Card>
                <EmptyState icon={ClipboardList} title="Nothing waiting"
                  description="Requests appear here the moment a student sends one — you do not need to refresh."
                  action={
                    <Button size="sm" icon={Sliders} onClick={() => setTab("status")}>
                      Check your availability
                    </Button>
                  } />
              </Card>
            ) : (() => {
              const pagedReqs = requests.slice((reqPage-1)*REQ_PAGE_SIZE, reqPage*REQ_PAGE_SIZE);
              const reqTotalPages = Math.ceil(requests.length / REQ_PAGE_SIZE);
              return (<>
                {pagedReqs.map(req => {
              const isAccepted = accepted.has(req.id);
              const isFull = accepted.size >= consultLimit && !isAccepted;
              return (
              <div key={req.id} className="card p-4 sm:p-5 transition-shadow hover:shadow">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 grid place-items-center
                                  bg-brand-50 text-brand font-bold">
                    {req.student_photo
                      ? <img src={req.student_photo} alt="" className="w-full h-full object-cover"/>
                      : (req.student_name?.[0] || "S")}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-semibold text-fg truncate">{req.student_name}</p>
                        <p className="text-xs text-muted-fg truncate">{req.course}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isAccepted && <Badge tone="success" icon={CheckCircle2}>Accepted</Badge>}
                        <Badge tone="neutral">{req.category}</Badge>
                        <span className="text-xs text-subtle-fg inline-flex items-center gap-1">
                          <Clock size={12} aria-hidden="true" />
                          {req.request_time ? new Date(req.request_time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : ""}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-muted-fg mt-3 bg-surface-2 rounded-lg px-3.5 py-3 leading-relaxed">
                      {req.purpose}
                    </p>

                    {req.appointment_date && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap bg-accent-50 border border-accent/25 rounded-lg px-3.5 py-2.5">
                        <CalendarCheck size={15} className="text-accent-fg shrink-0" aria-hidden="true" />
                        <p className="text-sm font-medium text-fg">
                          {new Date(req.appointment_date).toLocaleDateString("en-PH",{month:"short",day:"numeric"})} at {formatTime(req.appointment_time)}
                        </p>
                        {req.appointment_notes && (
                          <p className="text-xs text-muted-fg">— {req.appointment_notes}</p>
                        )}
                      </div>
                    )}

                    {isFull && (
                      <Alert tone="warning" icon={AlertTriangle}>
                        You have accepted {consultLimit} today, which is your limit. Decline one,
                        or raise the limit above.
                      </Alert>
                    )}

                    {/* One primary action at a time. Four coloured buttons of
                        equal weight is four decisions; the next step is either
                        "accept this" or, once accepted, "we have met". */}
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      {!isAccepted ? (
                        <Button
                          variant="primary" size="sm" icon={CheckCircle2} disabled={isFull}
                          onClick={() => {
                            if (isFull) {
                              addToast(`You are at your limit of ${consultLimit} for today.`, "warning");
                              return;
                            }
                            setAccepted(prev => { const n = new Set(prev); n.add(req.id); return n; });
                          }}>
                          Accept
                        </Button>
                      ) : (
                        <Button variant="primary" size="sm" icon={CheckCircle2}
                          onClick={()=>handleDone(req.id)}>
                          Mark done
                        </Button>
                      )}

                      <Button size="sm" icon={CalendarCheck}
                        onClick={() => { setApptModal(req); setApptForm({date:"",time:"",notes:""}); }}>
                        {req.appointment_date ? "Change time" : "Set appointment"}
                      </Button>

                      {!isAccepted && (
                        <Button size="sm" icon={CheckCircle2} onClick={()=>handleDone(req.id)}>
                          Mark done
                        </Button>
                      )}

                      <Button size="sm" variant="ghost" icon={XCircle}
                        className="text-danger hover:bg-danger-50"
                        onClick={()=>handleDecline(req.id)}>
                        Decline
                      </Button>

                      <IconButton icon={Trash2} label={`Delete the request from ${req.student_name}`}
                        onClick={()=>setConfirmDelete(req)}
                        className="ml-auto hover:text-danger hover:bg-danger-50" size={16} />
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
                {/* Requests Pagination */}
                {reqTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-2 pt-3 border-t border-border">
                    <p className="text-muted-fg text-xs">{((reqPage-1)*REQ_PAGE_SIZE)+1}–{Math.min(reqPage*REQ_PAGE_SIZE,requests.length)} of {requests.length}</p>
                    <div className="flex gap-2">
                      <button onClick={()=>setReqPage(p=>Math.max(1,p-1))} disabled={reqPage===1}
                        className="px-3 py-1.5 text-xs font-semibold bg-surface-2 border border-border rounded-xl text-muted-fg hover:text-fg disabled:opacity-30 transition-all">← Prev</button>
                      <span className="px-2 py-1.5 text-xs text-muted-fg">{reqPage}/{reqTotalPages}</span>
                      <button onClick={()=>setReqPage(p=>Math.min(reqTotalPages,p+1))} disabled={reqPage===reqTotalPages}
                        className="px-3 py-1.5 text-xs font-semibold bg-surface-2 border border-border rounded-xl text-muted-fg hover:text-fg disabled:opacity-30 transition-all">Next →</button>
                    </div>
                  </div>
                )}
              </>);
            })()}
          </div>
        )}

        {/* ── STATUS TAB ── */}
        {tab==="status" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-rise">
            {/* What students currently see, said plainly, before the control
                that changes it. The old card showed a dropdown and a button and
                left you to work out which state you were actually in. */}
            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-3">
                <span className="icon-tile icon-tile-accent w-10 h-10 shrink-0">
                  <Sliders size={19} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-fg">Your availability</h3>
                  <p className="text-xs text-muted-fg mt-0.5">What students see on the board right now</p>
                </div>
                <StatusBadge status={effectiveStatus} />
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label htmlFor="my-status" className="label">Set it by hand</label>
                  <select id="my-status" className="input" data-tour="teacher-status"
                    value={myStatus} onChange={e=>setMyStatus(e.target.value)}>
                    {MANUAL_OPTIONS.map(o=><option key={o}>{o}</option>)}
                  </select>
                  <p className="text-xs text-muted-fg mt-1.5">
                    On Auto your weekly schedule decides, and you never have to
                    remember to switch it back.
                  </p>
                </div>
                <Button variant="primary" icon={Sliders} loading={savingStatus}
                  onClick={handleSaveStatus} className="w-full">
                  {savingStatus ? "Saving…" : "Update status"}
                </Button>
              </div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-3">
                <span className="icon-tile icon-tile-brand w-10 h-10 shrink-0">
                  <Calendar size={19} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-fg">Weekly consultation hours</h3>
                  <p className="text-xs text-muted-fg mt-0.5">Set once — the board follows it every week</p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <ul className="divide-y divide-border -my-1">
                  {DAYS.map(day => {
                    const d = mySchedule?.[day];
                    const slots = (!d?.unavailable && d?.slots?.length) ? d.slots : null;
                    return (
                      <li key={day} className="flex items-center gap-3 py-2">
                        <span className="w-10 text-xs font-semibold uppercase tracking-wide text-muted-fg shrink-0">
                          {DAY_LABELS[day] || day.slice(0, 3)}
                        </span>
                        {slots ? (
                          <>
                            <span className="text-sm text-fg tabular-nums min-w-0 truncate">
                              {slots[0].start} – {slots[0].end}
                              {slots.length > 1 && ` +${slots.length - 1} more`}
                            </span>
                            {d.limit > 0 && (
                              <span className="ml-auto text-xs text-muted-fg shrink-0">{d.limit} max</span>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-subtle-fg">Not available</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <Button icon={Calendar} data-tour="teacher-schedule"
                  onClick={()=>setSchedModal(true)} className="w-full">
                  Edit weekly schedule
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {tab==="profile" && (
          <div className="animate-rise max-w-2xl mx-auto space-y-5">
            <div className="mb-2">
              <h2 className="font-semibold text-3xl text-fg">My Profile & Faculty ID</h2>
              <p className="text-muted-fg text-base mt-1">Update your name, photo, and download your Faculty ID</p>
            </div>
            {showCamera ? (
              <div className="bg-surface rounded-xl p-6 shadow-2xl animate-rise">
                <WebcamCapture title="Take Your ID Photo" onCapture={handleSavePhoto} onCancel={()=>setShowCamera(false)} />
              </div>
            ) : (
              <>
                <div className="card rounded-xl p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-28 h-28 rounded-lg overflow-hidden bg-surface-2 border border-border flex items-center justify-center shrink-0">
                      {profilePhoto ? <img src={profilePhoto} alt="" className="w-full h-full object-cover"/> : <User size={48} className="text-muted-fg"/>}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-fg text-xl">{teacher.professor_name}</p>
                      <p className="text-muted-fg text-sm mt-0.5">{teacher.department}</p>
                      <p className="text-muted-fg text-sm">Faculty · {teacher.employee_id}</p>
                    </div>
                    <button onClick={()=>setShowCamera(true)}
                      className="flex items-center gap-1.5 text-muted-fg hover:text-fg text-xs bg-surface-2 hover:bg-surface-2 border border-border px-3 py-2 rounded-xl transition-all">
                      <Camera size={13}/> {profilePhoto?"Retake":"Add Photo"}
                    </button>
                  </div>
                  <IDCardPreview name={teacher.professor_name} subtitle={teacher.department}
                    idNumber={teacher.employee_id} role="Faculty"
                    photo={profilePhoto} qrBase64={teacherQR} type="teacher" />
                  <button onClick={downloadID}
                    className="w-full flex items-center justify-center gap-2 mt-4 bg-brand hover:bg-brand-700 text-white font-semibold py-3 rounded-lg transition-all text-sm">
                    <Download size={15}/> Download Faculty ID
                  </button>
                </div>

                <div className="bg-surface rounded-xl border border-border shadow-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-brand">Edit Name</h3>
                    <button onClick={()=>{setEditName(v=>!v);setNewName(teacher.professor_name);}}
                      className="flex items-center gap-1.5 text-xs text-subtle-fg hover:text-brand transition-colors">
                      <Pencil size={12}/> {editName?"Cancel":"Edit"}
                    </button>
                  </div>
                  {editName ? (
                    <div className="space-y-3">
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <p className="text-amber-700 text-xs font-semibold">Current name:</p>
                        <p className="text-amber-900 text-sm font-bold">{teacher.professor_name}</p>
                      </div>
                      <input className="w-full border border-border bg-surface-2 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand focus:bg-surface transition-all"
                        placeholder="e.g. Engr. Maria Santos-Cruz"
                        value={newName} onChange={e=>setNewName(e.target.value)}
                        onKeyDown={e=>e.key==="Enter"&&handleSaveName()} autoFocus />
                      <button onClick={handleSaveName} disabled={savingName||!newName.trim()}
                        className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-700 text-white font-semibold py-3 rounded-lg transition-all text-sm disabled:opacity-50">
                        {savingName?<Spinner size={4} light/>:<Check size={15}/>}
                        {savingName?"Saving...":"Update Name"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-muted-fg text-sm">Use the Edit button to correct misspellings or update your surname.</p>
                  )}
                </div>

                {/* PIN Setup Card */}
                <div className="bg-surface rounded-xl border border-border shadow-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-brand">Login PIN</h3>
                      <p className="text-subtle-fg text-xs mt-0.5">
                        {hasPin
                        ? <><CheckCircle2 size={13} aria-hidden="true" className="inline mr-1.5 -mt-0.5" />PIN is set — you can sign in with your ID and PIN</>
                        : <><AlertTriangle size={13} aria-hidden="true" className="inline mr-1.5 -mt-0.5" />No PIN set yet</>}
                      </p>
                    </div>
                    <button onClick={() => { setSettingPin(v => !v); setPinForm({ pin: '', confirm: '' }); }}
                      className="flex items-center gap-1.5 text-xs text-subtle-fg hover:text-brand transition-colors">
                      <Pencil size={12}/> {settingPin ? "Cancel" : hasPin ? "Change PIN" : "Set PIN"}
                    </button>
                  </div>
                  {settingPin ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-muted-fg mb-2">Your Employee ID (share this with no one):</p>
                        <div className="bg-brand/10 border border-brand/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
                          <span className="font-mono font-bold text-brand text-lg tracking-widest">{teacher.employee_id}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide mb-3 block">Enter 4-digit PIN</label>
                        <div className="flex gap-3 justify-center">
                          {[0,1,2,3].map(i => (
                            <div key={i} className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-xl font-bold text-brand">
                              {pinForm.pin[i] ? "●" : ""}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide mb-3 block">Confirm PIN</label>
                        <div className="flex gap-3 justify-center">
                          {[0,1,2,3].map(i => (
                            <div key={i} className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl font-bold
 ${pinForm.confirm.length > 0 && pinForm.pin !== pinForm.confirm.slice(0,pinForm.pin.length) && i < pinForm.confirm.length
 ? "bg-danger-50 border-danger/40 text-danger" : "bg-surface-2 border-border text-brand"}`}>
                              {pinForm.confirm[i] ? "●" : ""}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Numpad */}
                      <div className="grid grid-cols-3 gap-2">
                        {[1,2,3,4,5,6,7,8,9].map(n => (
                          <button key={n} onPointerDown={e => { e.preventDefault();
                            if (pinForm.pin.length < 4) setPinForm(p => ({ ...p, pin: p.pin + n }));
                            else if (pinForm.confirm.length < 4) setPinForm(p => ({ ...p, confirm: p.confirm + n }));
                          }}
                            className="h-12 rounded-xl bg-surface-2 hover:bg-border text-fg text-lg font-bold transition-colors active:scale-95">
                            {n}
                          </button>
                        ))}
                        <button onPointerDown={e => { e.preventDefault();
                          if (pinForm.confirm.length > 0) setPinForm(p => ({ ...p, confirm: p.confirm.slice(0,-1) }));
                          else if (pinForm.pin.length > 0) { setPinForm(p => ({ ...p, pin: p.pin.slice(0,-1), confirm: '' })); }
                        }}
                          className="h-12 rounded-xl bg-danger-50 hover:brightness-95 text-danger text-lg transition-colors flex items-center justify-center">
                          ⌫
                        </button>
                        <button onPointerDown={e => { e.preventDefault();
                          if (pinForm.pin.length < 4) setPinForm(p => ({ ...p, pin: p.pin + '0' }));
                          else if (pinForm.confirm.length < 4) setPinForm(p => ({ ...p, confirm: p.confirm + '0' }));
                        }}
                          className="h-12 rounded-xl bg-surface-2 hover:bg-border text-fg text-lg font-bold transition-colors">
                          0
                        </button>
                        <button onPointerDown={e => { e.preventDefault(); setPinForm({ pin: '', confirm: '' }); }}
                          className="h-12 rounded-xl bg-surface-2 hover:bg-border text-muted-fg text-xs font-semibold transition-colors">
                          CLR
                        </button>
                      </div>
                      <button onClick={handleSetPin} disabled={savingPin || pinForm.pin.length < 4 || pinForm.confirm.length < 4}
                        className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-700 text-white font-semibold py-3 rounded-lg transition-all text-sm disabled:opacity-50">
                        {savingPin ? <Spinner size={4} light/> : <Check size={15}/>}
                        {savingPin ? "Saving..." : "Save PIN"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-muted-fg text-sm">
                      {hasPin
                        ? `Your Employee ID is: `
                        : "Set a 4-digit PIN so you can log in quickly using your Employee ID + PIN instead of scanning QR."}
                      {hasPin && <span className="font-mono font-bold text-brand ml-1 tracking-widest">{teacher.employee_id}</span>}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Appointment Modal */}
      {apptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setApptModal(null)}/>
          <div className="relative bg-surface rounded-xl shadow-2xl w-full max-w-md animate-rise">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-lg text-brand">Set Appointment</h2>
                <p className="text-subtle-fg text-xs mt-0.5">Assign a date and time for this consultation</p>
              </div>
              <button onClick={()=>setApptModal(null)} className="w-7 h-7 rounded-full bg-surface-2 hover:bg-border flex items-center justify-center transition-colors">
                <X size={14} className="text-muted-fg"/>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-info-50 border border-info/20 rounded-lg p-3">
                <p className="font-semibold text-brand text-sm">{apptModal.student_name}</p>
                <p className="text-muted-fg text-xs">{apptModal.course} · {apptModal.category}</p>
                <p className="text-muted-fg text-xs italic mt-1">"{apptModal.purpose}"</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide mb-1.5 block">Date *</label>
                  <input type="date" className="w-full border border-border bg-surface-2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand focus:bg-surface transition-all"
                    value={apptForm.date} onChange={e=>setApptForm(p=>({...p,date:e.target.value}))}
                    min={new Date().toISOString().split("T")[0]} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide mb-1.5 block">Time *</label>
                  <input type="time" className="w-full border border-border bg-surface-2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand focus:bg-surface transition-all"
                    value={apptForm.time} onChange={e=>setApptForm(p=>({...p,time:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide mb-1.5 block">Notes (optional)</label>
                <input className="w-full border border-border bg-surface-2 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand focus:bg-surface transition-all"
                  placeholder="e.g. Please bring your thesis draft"
                  value={apptForm.notes} onChange={e=>setApptForm(p=>({...p,notes:e.target.value}))} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={()=>setApptModal(null)} className="flex-1 border-2 border-brand text-brand hover:bg-brand hover:text-white font-semibold py-3 px-5 rounded-lg transition-all text-sm">Cancel</button>
                <button onClick={handleSetAppointment} disabled={savingAppt}
                  className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent text-fg font-semibold py-3 rounded-lg transition-all text-sm disabled:opacity-50">
                  {savingAppt?<Spinner size={4} light/>:<CalendarCheck size={14}/>}
                  {savingAppt?"Saving...":"Confirm Appointment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ScheduleModal open={schedModal} onClose={()=>setSchedModal(false)} onSave={handleSaveSchedule} initial={mySchedule}/>

      <BottomNavSpacer />
      <BottomNav items={NAV_ITEMS} active={tab} onSelect={setTab} />

    </PageWrapper>
  );
}