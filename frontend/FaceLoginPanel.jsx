import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import {
  CheckCircle2, XCircle, Calendar, Download, Trash2, Bell,
  RefreshCw, ClipboardList, Sliders, BookOpen, Clock,
  Pencil, X, Check, User, Camera, CalendarCheck, FileText, ScanFace,
  Scan
} from "lucide-react";
import { URSHeader, StatusBadge, Toast, useToastState, PageWrapper, Modal, Spinner, EmptyState } from "./SharedUI.jsx";
import ScheduleModal from "./ScheduleModal.jsx";
import { WebcamCapture, IDCardPreview, generateIDCard } from "./ProfileEditor.jsx";
import FaceEnrollModal from "./FaceEnrollModal.jsx";
import FaceLoginPanel from "./FaceLoginPanel.jsx";
import { API_BASE } from "./constants.js";
import QRCodeLib from "qrcode";

let socket = null;
const MANUAL_OPTIONS = ["Auto (use schedule)","Available","Unavailable","On Leave","In Meeting"];
const STATUS_STYLES = {
  "Available":"bg-emerald-50 border-emerald-200 text-emerald-700",
  "Unavailable":"bg-gray-50 border-gray-200 text-gray-600",
  "On Leave":"bg-amber-50 border-amber-200 text-amber-700",
  "In Meeting":"bg-orange-50 border-orange-200 text-orange-700",
  "Auto (use schedule)":"bg-blue-50 border-blue-200 text-blue-700",
};

function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}:${m} ${ampm}`;
}

function ding() {
  try {
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [0,200].forEach(d=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=660;g.gain.setValueAtTime(0.25,ctx.currentTime+d/1000);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+d/1000+0.3);o.start(ctx.currentTime+d/1000);o.stop(ctx.currentTime+d/1000+0.35);});
  } catch(_){}
}

// Piper TTS
const _ttsQueue = [];
let _ttsBusy = false;
let _ttsAudio = null;
const _teacherSeenIds = new Set();

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
  setTimeout(_ttsPlayNext, 800);
}

function piperSpeak(text) {
  _ttsQueue.push(text);
  _ttsPlayNext();
}

function getFirstName(fullName) {
  return (fullName || "")
    .replace(/^(Engr\.|Dr\.|Prof\.|AR\.|Mr\.|Ms\.|Mrs\.)\s*/i, "")
    .split(" ")[0];
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToastState();
  const teacherRaw = sessionStorage.getItem("teacher");
  const teacher = teacherRaw ? JSON.parse(teacherRaw) : null;

  if (!teacher) { navigate("/teacher"); return null; }

  const [tab, setTab]               = useState("requests");
  const [requests, setRequests]     = useState([]);
  const [ticker, setTicker]         = useState([]);
  const [schedModal, setSchedModal] = useState(false);
  const [myStatus, setMyStatus]     = useState("Auto (use schedule)");
  const [mySchedule, setMySchedule] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [clearModal, setClearModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [apptModal, setApptModal]   = useState(null);
  const [apptForm, setApptForm]     = useState({ date:"", time:"", notes:"" });
  const [savingAppt, setSavingAppt] = useState(false);

  // Profile state
  const [profilePhoto, setProfilePhoto] = useState(teacher.photo || null);
  const [showCamera, setShowCamera]     = useState(false);
  const [teacherQR, setTeacherQR]       = useState(null);
  const [editName, setEditName]         = useState(false);
  const [newName, setNewName]           = useState(teacher.professor_name);
  const [savingName, setSavingName]     = useState(false);

  // ── Face Enrollment state ─────────────────────────────────────────────────
  const [enrollModal, setEnrollModal]   = useState(false);
  const [enrollStudents, setEnrollStudents] = useState([]);
  const [showFaceRecog, setShowFaceRecog] = useState(false); // face recognition test panel

  const prevCount    = useRef(-1);
  const hasWelcomed  = useRef(false);

  const fetchRequests = useCallback(async () => {
    if (!teacher) return;
    try {
      const res = await axios.get(`${API_BASE}/teacher/requests/${teacher.employee_id}`);
      const reqs = res.data || [];
      const unseenPending = reqs.filter(r =>
        r.status === "pending" && !_teacherSeenIds.has(r.id)
      );
      unseenPending.forEach((req, i) => {
        _teacherSeenIds.add(req.id);
        if (prevCount.current >= 0) {
          ding();
          const msg = `New request from ${getFirstName(req.student_name)}`;
          setTicker(t => [msg,...t].slice(0,5));
          addToast(`📬 ${msg} — ${req.category}`,"info");
        }
        setTimeout(() => {
          piperSpeak(`Paging ${getFirstName(teacher.professor_name)}, ${getFirstName(req.student_name)} is requesting. Purpose: ${req.purpose}.`);
        }, i * 300);
      });
      prevCount.current = reqs.length;
      setRequests(reqs);
    } catch(_){}
  }, [teacher]);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/teacher/profile/${teacher.employee_id}`);
      if (res.data.photo) setProfilePhoto(res.data.photo);
    } catch(_){}
  }, [teacher]);

  // Fetch students for enroll modal
  const fetchStudentsForEnroll = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/dean/students`);
      setEnrollStudents(res.data || []);
    } catch(_) {
      setEnrollStudents([]);
    }
  }, []);

  useEffect(() => {
    fetchRequests(); fetchProfile();
    if (!hasWelcomed.current) {
      hasWelcomed.current = true;
      _teacherSeenIds.clear();
      piperSpeak(`Welcome, Engineer ${getFirstName(teacher.professor_name)}!`);
    }
    const iv = setInterval(fetchRequests, 8000);
    socket = io("/", { transports:["websocket"] });
    socket.on("consultation_update", fetchRequests);
    socket.on("new_request", fetchRequests);

    QRCodeLib.toDataURL(teacher.employee_id, { width:400, margin:2, color:{dark:"#000000",light:"#ffffff"} })
      .then(url => setTeacherQR(url.split(",")[1])).catch(()=>{});

    return () => { clearInterval(iv); socket?.disconnect(); };
  }, []);

  const handleDone = async (id) => {
    const req = requests.find(r => r.id === id);
    await axios.post(`${API_BASE}/teacher/requests/${id}/done`);
    socket?.emit("broadcast_request_done",{request_id:id,professor_name:teacher.professor_name});
    setRequests(p=>p.filter(r=>r.id!==id));
    _teacherSeenIds.delete(id);
    addToast("Consultation completed.","success");
    if (req) piperSpeak(`Consultation completed. ${getFirstName(req.student_name)} has been served.`);
  };

  const handleDecline = async (id) => {
    _teacherSeenIds.delete(id);
    await axios.post(`${API_BASE}/teacher/requests/${id}/decline`);
    setRequests(p=>p.filter(r=>r.id!==id));
    addToast("Request declined.","info");
  };

  const handleSaveSchedule = async (schedule) => {
    await axios.post(`${API_BASE}/teacher/save-schedule`,{employee_id:teacher.employee_id,weekly_schedule:schedule});
    setMySchedule(schedule);
    socket?.emit("broadcast_status",{professorName:teacher.professor_name,status:"Auto",weeklySchedule:schedule});
    addToast("Schedule saved!","success");
  };

  const handleSaveStatus = async () => {
    setSavingStatus(true);
    await axios.post(`${API_BASE}/teacher/save-manual-status`,{employee_id:teacher.employee_id,manual_status:myStatus});
    socket?.emit("broadcast_status",{professorName:teacher.professor_name,status:myStatus});
    addToast(`Status updated: ${myStatus}`,"success");
    setSavingStatus(false);
  };

  const handleSetAppointment = async () => {
    if (!apptForm.date || !apptForm.time) return addToast("Date and time required.","warning");
    setSavingAppt(true);
    try {
      await axios.post(`${API_BASE}/teacher/requests/${apptModal.id}/appoint`, {
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
      await axios.post(`${API_BASE}/teacher/update-name`,{employee_id:teacher.employee_id,new_name:newName.trim()});
      const updated = {...teacher, professor_name:newName.trim()};
      sessionStorage.setItem("teacher",JSON.stringify(updated));
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
      await axios.post(`${API_BASE}/teacher/update-photo`, { employee_id: teacher.employee_id, photo: dataUrl });
      const current = JSON.parse(sessionStorage.getItem("teacher") || "{}");
      sessionStorage.setItem("teacher", JSON.stringify({ ...current, photo: dataUrl }));
      addToast("Photo saved!", "success");
    } catch(_) { addToast("Failed to save photo.", "error"); }
  };

  const downloadID = () => generateIDCard({
    name: teacher.professor_name,
    subtitle: teacher.department,
    idNumber: teacher.employee_id,
    role: "Faculty",
    photo: profilePhoto,
    qrBase64: teacherQR,
    type: "teacher"
  });

  const openEnrollModal = () => {
    fetchStudentsForEnroll();
    setEnrollModal(true);
  };

  const TABS = [
    { id:"requests", icon:<ClipboardList size={15}/>, label:"Requests", badge: requests.length },
    { id:"status",   icon:<Sliders size={15}/>,       label:"Status & Schedule" },
    { id:"profile",  icon:<User size={15}/>,           label:"My Profile & ID" },
  ];

  return (
    <PageWrapper>
      <Toast toasts={toasts} removeToast={removeToast} />
      <URSHeader subtitle="Teacher Dashboard" accent="orange"
        user={{ name: teacher.professor_name, sub: teacher.department }}
        onLogout={() => { sessionStorage.removeItem("teacher"); navigate("/teacher"); }} />

      {ticker.length > 0 && (
        <div className="bg-[#001a33] border-b-2 border-[#ffa000] py-3 px-5 flex items-center gap-4 overflow-hidden">
          <div className="flex items-center gap-2 shrink-0 bg-[#ffa000] px-3 py-1 rounded-full">
            <Bell size={16} className="text-white animate-bounce" />
            <span className="text-white text-xs font-black uppercase tracking-widest">New Request</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="animate-marquee whitespace-nowrap font-black text-[#ffa000] text-lg tracking-wide drop-shadow-lg">
              {ticker.join("   ✦   ")}
            </p>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pt-2">
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-all
                ${tab===t.id?"bg-white/15 text-white border-b-2 border-[#ffa000]":"text-white/50 hover:text-white/80"}`}>
              {t.icon}{t.label}
              {t.badge>0 && <span className="bg-[#ff6f00] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full">

        {/* ── REQUESTS TAB ── */}
        {tab==="requests" && (
          <div className="space-y-3 animate-slide-up">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display font-bold text-xl text-white">Consultation Requests</h2>
              <button onClick={async()=>{setRefreshing(true);await fetchRequests();setRefreshing(false);}}
                className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs bg-white/10 px-3 py-2 rounded-xl border border-white/20 transition-all">
                <RefreshCw size={12} className={refreshing?"animate-spin":""}/> Refresh
              </button>
            </div>

            {requests.length===0 ? (
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-10 text-center">
                <ClipboardList size={40} className="text-white/20 mx-auto mb-3"/>
                <p className="text-white/50 font-semibold">No pending requests</p>
                <p className="text-white/30 text-sm mt-1">Student requests will appear here automatically</p>
              </div>
            ) : requests.map(req => (
              <div key={req.id} className="bg-white/95 rounded-3xl border border-white/30 shadow-xl p-6 hover:shadow-2xl transition-all">
                <div className="flex items-start gap-5">
                  <div className="w-16 h-16 bg-[#003366] rounded-2xl overflow-hidden flex items-center justify-center shrink-0 shadow-lg">
                    {req.student_photo
                      ? <img src={req.student_photo} alt={req.student_name} className="w-full h-full object-cover"/>
                      : <span className="text-white font-display font-bold text-2xl">{req.student_name?.[0]||"S"}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-bold text-gray-900 text-lg">{req.student_name}</p>
                        <p className="text-gray-500 text-sm">{req.course}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full font-semibold">{req.category}</span>
                        <span className="text-gray-400 text-sm flex items-center gap-1">
                          <Clock size={13}/>
                          {req.request_time ? new Date(req.request_time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : ""}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-700 text-base mt-3 bg-gray-50 rounded-xl px-4 py-3 italic font-medium">"{req.purpose}"</p>

                    {req.appointment_date && (
                      <div className="mt-3 flex items-center gap-2 bg-[#ffa000]/10 border border-[#ffa000]/20 rounded-xl px-4 py-2.5">
                        <CalendarCheck size={16} className="text-[#ffa000]"/>
                        <p className="text-sm text-gray-700 font-semibold">
                          Appointment: {new Date(req.appointment_date).toLocaleDateString("en-PH",{month:"short",day:"numeric"})} at {formatTime(req.appointment_time)}
                        </p>
                        {req.appointment_notes && <p className="text-gray-500 text-xs italic">— "{req.appointment_notes}"</p>}
                      </div>
                    )}

                    <div className="flex gap-3 mt-4 flex-wrap">
                      <button onClick={() => { setApptModal(req); setApptForm({date:"",time:"",notes:""}); }}
                        className="flex items-center gap-2 bg-[#ffa000] hover:bg-[#e69000] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95">
                        <CalendarCheck size={15}/> {req.appointment_date?"Edit Appointment":"Set Appointment"}
                      </button>
                      <button onClick={()=>handleDone(req.id)}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all active:scale-95">
                        <CheckCircle2 size={15}/> Mark Done
                      </button>
                      <button onClick={()=>handleDecline(req.id)}
                        className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all active:scale-95">
                        <XCircle size={15}/> Decline
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── STATUS TAB ── */}
        {tab==="status" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-slide-up">
            <div className="bg-white/95 rounded-3xl border border-white/30 shadow-xl p-7">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 bg-[#ff6f00] rounded-xl flex items-center justify-center"><Sliders size={20} className="text-white"/></div>
                <h3 className="font-display font-bold text-xl text-[#003366]">My Availability Status</h3>
              </div>
              <select value={myStatus} onChange={e=>setMyStatus(e.target.value)}
                className={`w-full border rounded-2xl px-4 py-3 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#003366]/20 mb-3 ${STATUS_STYLES[myStatus]||"border-gray-200 bg-gray-50"}`}>
                {MANUAL_OPTIONS.map(o=><option key={o}>{o}</option>)}
              </select>
              <button onClick={handleSaveStatus} disabled={savingStatus}
                className="w-full flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080] text-white font-semibold py-3 rounded-2xl transition-all text-sm disabled:opacity-50">
                {savingStatus?<Spinner size={4} light/>:<Sliders size={14}/>}
                {savingStatus?"Saving...":"Update Status"}
              </button>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button onClick={()=>setSchedModal(true)}
                  className="w-full flex items-center justify-center gap-2 border-2 border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white font-semibold py-2.5 px-5 rounded-2xl transition-all text-sm">
                  <Calendar size={14}/> Edit Weekly Schedule
                </button>
              </div>
            </div>

            <div className="bg-white/95 rounded-3xl border border-white/30 shadow-xl p-7">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 bg-[#003366] rounded-xl flex items-center justify-center"><Download size={20} className="text-white"/></div>
                <h3 className="font-display font-bold text-xl text-[#003366]">Admin Tools</h3>
              </div>
              <div className="space-y-2">
                {[["today","Export Today","bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"],
                  ["all","Export All Records","bg-blue-50 hover:bg-blue-100 text-[#003366] border-blue-200"]].map(([t,l,cls])=>(
                  <button key={t} onClick={()=>window.open(`${API_BASE}/export?type=${t}`,"_blank")}
                    className={`w-full flex items-center gap-2.5 text-sm ${cls} border font-semibold px-4 py-2.5 rounded-2xl transition-all`}>
                    <Download size={14}/>{l}
                  </button>
                ))}
                <button onClick={()=>setClearModal(true)}
                  className="w-full flex items-center gap-2.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold px-4 py-2.5 rounded-2xl transition-all">
                  <Trash2 size={14}/> Clear All Logs
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {tab==="profile" && (
          <div className="animate-slide-up max-w-2xl mx-auto space-y-5">
            <div className="mb-2">
              <h2 className="font-display font-bold text-3xl text-white">My Profile & Faculty ID</h2>
              <p className="text-white/50 text-base mt-1">Update your name, photo, enroll biometrics, and download your Faculty ID</p>
            </div>

            {showCamera ? (
              <div className="bg-white rounded-3xl p-6 shadow-2xl animate-bounce-in">
                <WebcamCapture title="Take Your ID Photo"
                  onCapture={handleSavePhoto}
                  onCancel={()=>setShowCamera(false)} />
              </div>
            ) : (
              <>
                {/* Photo + ID Preview */}
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-28 h-28 rounded-2xl overflow-hidden bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                      {profilePhoto ? <img src={profilePhoto} alt="" className="w-full h-full object-cover"/> : <User size={48} className="text-white/30"/>}
                    </div>
                    <div className="flex-1">
                      <p className="font-display font-bold text-white text-xl">{teacher.professor_name}</p>
                      <p className="text-white/50 text-sm mt-0.5">{teacher.department}</p>
                      <p className="text-white/40 text-sm">Faculty · {teacher.employee_id}</p>
                    </div>
                    <button onClick={()=>setShowCamera(true)}
                      className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-2 rounded-xl transition-all">
                      <Camera size={13}/> {profilePhoto?"Retake":"Add Photo"}
                    </button>
                  </div>
                  <IDCardPreview
                    name={teacher.professor_name}
                    subtitle={teacher.department}
                    idNumber={teacher.employee_id}
                    role="Faculty"
                    photo={profilePhoto}
                    qrBase64={teacherQR}
                    type="teacher"
                  />
                  <button onClick={downloadID}
                    className="w-full flex items-center justify-center gap-2 mt-4 bg-[#003366] hover:bg-[#004080] text-white font-semibold py-3 rounded-2xl transition-all text-sm">
                    <Download size={15}/> Download Faculty ID
                  </button>
                </div>

                {/* ── Face Recognition Test / Login Panel ─────────────────── */}
                <div className="bg-white/95 rounded-3xl border border-white/30 shadow-xl overflow-hidden">
                  <button
                    onClick={() => setShowFaceRecog(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#003366] to-[#0055aa] rounded-xl flex items-center justify-center">
                        <Scan size={18} className="text-white" />
                      </div>
                      <div className="text-left">
                        <p className="font-display font-bold text-[#003366] text-sm">Test Face Recognition</p>
                        <p className="text-gray-400 text-xs mt-0.5">
                          Verify your biometric enrollment is working correctly
                        </p>
                      </div>
                    </div>
                    <div className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors
                      ${showFaceRecog
                        ? "bg-[#003366] text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                      {showFaceRecog ? "Hide Camera" : "Open Camera"}
                    </div>
                  </button>

                  {showFaceRecog && (
                    <div className="border-t border-gray-100 p-5">
                      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-4 flex items-start gap-2">
                        <Scan size={14} className="text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-blue-700 text-xs leading-relaxed">
                          This panel tests whether your face biometrics are correctly enrolled.
                          Click <strong>SCAN</strong> when your face is detected. If recognition fails,
                          use the <strong>Biometric Enrollment</strong> section below to re-enroll.
                        </p>
                      </div>
                      <FaceLoginPanel
                        showRegisterLink={false}
                        onSuccess={(data) => {
                          setShowFaceRecog(false);
                          addToast(`✓ Face + eyes verified! Recognized as: ${data.teacher?.professor_name || data.student?.full_name || "user"}`, "success");
                        }}
                        onError={(msg) => addToast(msg, "error")}
                      />
                    </div>
                  )}
                </div>

                {/* ── Biometric Enrollment Card ─────────────────────────────── */}
                <div className="bg-white/95 rounded-3xl border border-white/30 shadow-xl overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-[#003366] to-[#0055aa] px-5 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <ScanFace size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="font-display font-bold text-white">Face + Eye Biometric Enrollment</p>
                      <p className="text-white/60 text-xs">Register your biometrics or enroll a student for facial login</p>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* How it works */}
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                      <p className="text-blue-800 text-xs font-bold uppercase tracking-wider mb-2">How It Works</p>
                      <div className="space-y-1.5 text-blue-700 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-[10px] font-black mt-0.5">1</span>
                          <p>Select the type (yourself as Teacher, or enroll a Student)</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-[10px] font-black mt-0.5">2</span>
                          <p>Position face in camera — look straight, good lighting</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-[10px] font-black mt-0.5">3</span>
                          <p>Capture 5 photos from slightly different angles</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-[10px] font-black mt-0.5">4</span>
                          <p>Click Enroll — both face AND eye embeddings are stored</p>
                        </div>
                      </div>
                    </div>

                    {/* Requirements */}
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                      <p className="text-amber-800 text-xs font-bold uppercase tracking-wider mb-2">⚠️ Requirements</p>
                      <ul className="text-amber-700 text-xs space-y-1 list-disc list-inside">
                        <li>Camera must be connected and allowed in Chrome</li>
                        <li>Biometric service must be running on port 8000</li>
                        <li>Good lighting — avoid backlight or dark rooms</li>
                        <li>Remove glasses if possible for better eye recognition</li>
                        <li>Students must already be registered in the system</li>
                      </ul>
                    </div>

                    <button
                      onClick={openEnrollModal}
                      className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#003366] to-[#0055aa]
                                 hover:from-[#004080] hover:to-[#0066bb] text-white font-bold py-4 rounded-2xl
                                 transition-all shadow-lg hover:shadow-xl active:scale-[0.97] text-base">
                      <ScanFace size={20} />
                      Open Biometric Enrollment
                    </button>

                    <p className="text-center text-xs text-gray-400">
                      Once enrolled, users can log in using Face + Eye biometrics from the Student or Teacher portal
                    </p>
                  </div>
                </div>

                {/* Edit Name */}
                <div className="bg-white/95 rounded-3xl border border-white/30 shadow-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display font-bold text-[#003366]">Edit Name</h3>
                    <button onClick={()=>{setEditName(v=>!v);setNewName(teacher.professor_name);}}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#003366] transition-colors">
                      <Pencil size={12}/> {editName?"Cancel":"Edit"}
                    </button>
                  </div>
                  {editName ? (
                    <div className="space-y-3">
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <p className="text-amber-700 text-xs font-semibold">Current name:</p>
                        <p className="text-amber-900 text-sm font-bold">{teacher.professor_name}</p>
                      </div>
                      <input className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] focus:bg-white transition-all"
                        placeholder="e.g. Engr. Maria Santos-Cruz"
                        value={newName} onChange={e=>setNewName(e.target.value)}
                        onKeyDown={e=>e.key==="Enter"&&handleSaveName()} autoFocus />
                      <p className="text-xs text-gray-400">Include title: Engr., Dr., Prof., AR.</p>
                      <button onClick={handleSaveName} disabled={savingName||!newName.trim()}
                        className="w-full flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080] text-white font-semibold py-3 rounded-2xl transition-all text-sm disabled:opacity-50">
                        {savingName?<Spinner size={4} light/>:<Check size={15}/>}
                        {savingName?"Saving...":"Update Name"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-600 text-sm">Use the Edit button to correct misspellings or update your married surname. Changes reflect across the entire system.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── FACE ENROLL MODAL ── */}
      <FaceEnrollModal
        open={enrollModal}
        onClose={() => setEnrollModal(false)}
        students={enrollStudents}
      />

      {/* Appointment Modal */}
      {apptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={()=>setApptModal(null)}/>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md animate-bounce-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-display font-bold text-lg text-[#003366]">Set Appointment</h2>
                <p className="text-gray-400 text-xs mt-0.5">Assign a date and time for this consultation</p>
              </div>
              <button onClick={()=>setApptModal(null)} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <X size={14} className="text-gray-500"/>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3">
                <p className="font-semibold text-[#003366] text-sm">{apptModal.student_name}</p>
                <p className="text-gray-500 text-xs">{apptModal.course} · {apptModal.category}</p>
                <p className="text-gray-600 text-xs italic mt-1">"{apptModal.purpose}"</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Date *</label>
                  <input type="date" className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] focus:bg-white transition-all"
                    value={apptForm.date} onChange={e=>setApptForm(p=>({...p,date:e.target.value}))}
                    min={new Date().toISOString().split("T")[0]} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Time *</label>
                  <input type="time" className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] focus:bg-white transition-all"
                    value={apptForm.time} onChange={e=>setApptForm(p=>({...p,time:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Notes (optional)</label>
                <input className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] focus:bg-white transition-all"
                  placeholder="e.g. Please bring your thesis draft"
                  value={apptForm.notes} onChange={e=>setApptForm(p=>({...p,notes:e.target.value}))} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={()=>setApptModal(null)} className="flex-1 border-2 border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white font-semibold py-3 px-5 rounded-2xl transition-all text-sm">Cancel</button>
                <button onClick={handleSetAppointment} disabled={savingAppt}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#ffa000] hover:bg-[#e69000] text-white font-semibold py-3 rounded-2xl transition-all text-sm disabled:opacity-50">
                  {savingAppt?<Spinner size={4} light/>:<CalendarCheck size={14}/>}
                  {savingAppt?"Saving...":"Confirm Appointment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ScheduleModal open={schedModal} onClose={()=>setSchedModal(false)} onSave={handleSaveSchedule} initial={mySchedule}/>

      <Modal open={clearModal} onClose={()=>setClearModal(false)} title="Clear All Logs?">
        <p className="text-gray-500 text-sm mb-5">This permanently deletes all teacher logs and consultation records.</p>
        <div className="flex gap-2">
          <button onClick={()=>setClearModal(false)} className="flex-1 border-2 border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white font-semibold py-2.5 px-5 rounded-2xl transition-all text-sm">Cancel</button>
          <button onClick={async()=>{await axios.post(`${API_BASE}/teacher/clear-logs`);setRequests([]);addToast("Logs cleared.","success");setClearModal(false);}}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-2xl text-sm transition-all">
            Yes, Clear All
          </button>
        </div>
      </Modal>
    </PageWrapper>
  );
}