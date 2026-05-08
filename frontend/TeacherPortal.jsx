import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { BookOpen, QrCode, ScanLine, ChevronLeft, Search, Users, ArrowRight, Shield, Camera, CreditCard, Pencil, X, Check } from "lucide-react";
import QRScanner from "./QRScanner.jsx";
import { FacultyIDCard, WebcamCapture } from "./FacultyIDCard.jsx";
import { Toast, useToastState, Spinner } from "./SharedUI.jsx";
import URSBackground from "./URSBackground.jsx";
import { API_BASE, PROFESSOR_LIST, DEPARTMENTS } from "./constants.js";
import ursLogo from "./URS_LOGO.png";

const DEPT_ICONS = {
  "Civil Engineering Department":       "🏗️",
  "Computer Engineering Department":    "💻",
  "Electronics Engineering Department": "⚡",
  "Electrical Engineering Department":  "🔌",
  "Mechanical Engineering Department":  "⚙️",
  "GEC GEAS Department":                "📐",
};

const DEAN_TOKEN = "DEAN-URS-ADMIN-2024";

export default function TeacherPortal() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToastState();

  // Navigation state
  const [view, setView] = useState("home");       // home | dept | getid_step1 | getid_step2 | getid_step3 | scanqr | dean
  const [selectedDept, setSelectedDept] = useState(null);
  const [search, setSearch] = useState("");

  // ID generation state
  const [selectedProf, setSelectedProf] = useState(null); // { name, dept }
  const [idData, setIdData] = useState(null);              // { qr_base64, employee_id }
  const [photo, setPhoto] = useState(null);                // base64 photo
  const [loadingProf, setLoadingProf] = useState(null);

  // Live professor list fetched from API (merges DB + static list)
  const [liveProfList, setLiveProfList] = useState({}); // { dept: [names] }
  const [loadingProfs, setLoadingProfs] = useState(false);

  // Fetch live professor list from the server whenever dept view is entered
  const fetchLiveProfessors = async () => {
    setLoadingProfs(true);
    try {
      const res = await axios.get(`${API_BASE}/teacher-logs`);
      const map = {};
      (res.data || []).forEach(dept => {
        // Store full prof objects so we have access to photos
        map[dept.department] = dept.professors.map(p => ({ name: p.name, photo: p.photo || null }));
      });
      setLiveProfList(map);
    } catch {
      // Fallback to static list (no photos)
      const map = {};
      Object.entries(PROFESSOR_LIST).forEach(([dept, names]) => {
        map[dept] = names.map(name => ({ name, photo: null }));
      });
      setLiveProfList(map);
    } finally {
      setLoadingProfs(false);
    }
  };

  // Dean state
  const [deanQR, setDeanQR] = useState(null);
  const [deanQRLoading, setDeanQRLoading] = useState(false);

  // Edit Name modal state
  const [editingName, setEditingName] = useState(null); // { original, dept }
  const [customName, setCustomName]   = useState("");
  const [savingName, setSavingName]   = useState(false);

  const goHome = () => { setView("home"); setSelectedDept(null); setSearch(""); setSelectedProf(null); setIdData(null); setPhoto(null); setEditingName(null); };

  // One step back — each step returns to the previous view
  const goBack = () => {
    if (view === "getid_step3") { setPhoto(null); setView("getid_step2"); }
    else if (view === "getid_step2") { setIdData(null); setSelectedProf(null); setView("getid_step1"); }
    else if (view === "getid_step1") { setSelectedDept(null); setSearch(""); setView("dept"); }
    else if (view === "dept")    { setView("home"); }
    else if (view === "scanqr")  { setView("home"); }
    else if (view === "face")     { setView("home"); }
    else if (view === "dean")    { setView("home"); }
    else goHome();
  };

  // Fetch live professors whenever user enters the dept selection view
  useEffect(() => {
    if (view === "dept") fetchLiveProfessors();
  }, [view]);

  const handleSaveEditedName = async () => {
    if (!customName.trim() || customName.trim() === editingName.original) {
      return addToast("Please enter a different name.", "warning");
    }
    setSavingName(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/teacher/quick-login`, {
        professor_name: editingName.original,
        department: editingName.dept
      });
      const emp_id = res.data.employee_id;
      await axios.post(`${API_BASE}/teacher/update-name`, {
        employee_id: emp_id,
        new_name: customName.trim()
      });
      addToast("Name updated! Generating your ID...", "success");
      setEditingName(null);
      handleSelectProfessor(customName.trim(), editingName.dept);
    } catch(e) {
      addToast(e.response?.data?.error || "Failed to update name.", "error");
    } finally { setSavingName(false); }
  };

  // ── Step 1: Select professor → fetch QR data
  const handleSelectProfessor = async (name, dept) => {
    setLoadingProf(name);
    try {
      const res = await axios.post(`${API_BASE}/auth/teacher/quick-login`, {
        professor_name: name, department: dept
      });
      setSelectedProf({ name, dept });
      setIdData({ qr_base64: res.data.qr_base64, employee_id: res.data.employee_id });
      setView("getid_step2");
    } catch (e) {
      addToast(e.response?.data?.error || "Failed. Try again.", "error");
    } finally { setLoadingProf(null); }
  };

  // ── Scan QR login
  const handleTeacherQRScan = async (value) => {
    try {
      const res = await axios.post(`${API_BASE}/auth/teacher/qr-login`, { employee_id: value });
      sessionStorage.removeItem("student"); // clear any student session
      sessionStorage.setItem("teacher", JSON.stringify(res.data.teacher));
      addToast("Welcome back, " + res.data.teacher.professor_name + "!", "success");
      setTimeout(() => navigate("/teacher/dashboard"), 600);
    } catch (e) {
      addToast(e.response?.data?.error || "QR not recognized.", "error");
      setView("home");
    }
  };

  // ── Dean QR scan
  const handleDeanQRScan = (value) => {
    if (value === DEAN_TOKEN) {
      sessionStorage.setItem("dean", JSON.stringify({ username: "dean", name: "Administrator" }));
      addToast("Welcome, Administrator!", "success");
      setTimeout(() => navigate("/dean/dashboard"), 600);
    } else {
      addToast("Invalid Admin QR code.", "error");
    }
  };

  const generateDeanQR = async () => {
    setDeanQRLoading(true);
    try {
      const { default: QRCode } = await import("qrcode");
      const url = await QRCode.toDataURL(DEAN_TOKEN, {
        width: 400, margin: 2, color: { dark: "#000000", light: "#ffffff" }
      });
      setDeanQR(url);
    } catch (e) { addToast("Failed to generate QR.", "error"); }
    finally { setDeanQRLoading(false); }
  };

  const rawProfs = selectedDept
    ? (liveProfList[selectedDept] || [])
    : [];
  const filteredProfs = rawProfs.filter(p =>
    (typeof p === "string" ? p : p.name).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <URSBackground className="flex flex-col">
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Glass Nav */}
      <nav className="sticky top-0 z-30 glass border-b border-white/15 shadow-lg">
        <div className="flex items-center justify-between px-5 sm:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-md overflow-hidden">
              <img src={ursLogo} alt="URS" className="w-full h-full object-contain p-0.5"
                onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="flex"; }} />
              <span className="text-[#003366] font-display font-black text-base leading-none hidden items-center justify-center">U</span>
            </div>
            <div>
              <p className="text-white font-display font-bold text-sm leading-tight">University of Rizal System</p>
              <p className="text-white/40 text-xs">Teacher Portal</p>
            </div>
          </div>
          {view !== "home" && (
            <button onClick={goBack}
              className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs
                         glass px-3 py-1.5 rounded-xl transition-all">
              <ChevronLeft size={13} /> Back
            </button>
          )}
        </div>
      </nav>

      {/* ── HOME ─────────────────────────────────────────────────────────────── */}
      {view === "home" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
          <div className="text-center mb-10 animate-slide-up">
            <h1 className="font-display font-black text-6xl text-white mb-3 drop-shadow-lg">Teacher Access</h1>
            <p className="text-white/60 text-xl">Choose how you'd like to access your account.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl animate-slide-up">
            {/* Get My ID */}
            <button onClick={() => setView("dept")}
              className="glass border border-white/20 rounded-3xl p-10 text-center hover:bg-white/20
                         transition-all shadow-xl hover:shadow-2xl active:scale-[0.97] group">
              <div className="w-24 h-24 bg-[#003366] rounded-3xl flex items-center justify-center mx-auto mb-6
                             group-hover:scale-110 transition-transform shadow-lg">
                <CreditCard size={48} className="text-white" />
              </div>
              <p className="text-white font-display font-bold text-3xl mb-3">Get My ID</p>
              <p className="text-white/60 text-base leading-relaxed">
                Select your name, take a photo, and generate your official Faculty ID with QR code
              </p>
            </button>

            {/* Scan QR */}
            <button onClick={() => setView("scanqr")}
              className="glass border border-white/20 rounded-3xl p-10 text-center hover:bg-white/20
                         transition-all shadow-xl hover:shadow-2xl active:scale-[0.97] group">
              <div className="w-24 h-24 bg-[#ff6f00] rounded-3xl flex items-center justify-center mx-auto mb-6
                             group-hover:scale-110 transition-transform shadow-lg">
                <QrCode size={48} className="text-white" />
              </div>
              <p className="text-white font-display font-bold text-3xl mb-3">Scan QR</p>
              <p className="text-white/60 text-base leading-relaxed">
                Already have your Faculty ID? Scan your QR code to log in directly to your dashboard
              </p>
            </button>
          </div>


          {/* Admin Dashboard card — same row styling as the others */}
          <div className="mt-4 w-full max-w-2xl">
            <button onClick={() => setView("dean")}
              className="w-full glass border border-white/20 rounded-3xl p-8 flex items-center gap-6
                         hover:bg-white/20 transition-all active:scale-[0.97] group">
              <div className="w-20 h-20 bg-[#1e293b] rounded-3xl flex items-center justify-center shrink-0
                             group-hover:scale-110 transition-transform shadow-lg">
                <Shield size={40} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-white font-display font-bold text-2xl">Admin Dashboard</p>
                <p className="text-white/60 text-base mt-1">Administrative access — College of Engineering</p>
              </div>
              <ArrowRight size={24} className="text-white/30 group-hover:text-white ml-auto transition-colors shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* ── DEPT SELECT ──────────────────────────────────────────────────────── */}
      {view === "dept" && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 animate-slide-up">
          <div className="w-full max-w-4xl">
            <div className="text-center mb-8">
              <p className="font-display font-bold text-4xl text-white mb-2">Select Your Department</p>
              <p className="text-white/50 text-lg">Choose the department you belong to</p>
            </div>
            <div className="grid grid-cols-3 gap-5">
              {DEPARTMENTS.map(dept => (
                <button key={dept} onClick={() => { setSelectedDept(dept); setView("getid_step1"); }}
                  className="glass border border-white/20 rounded-3xl p-8 flex flex-col items-center gap-4
                             hover:bg-white/20 transition-all active:scale-[0.97] group text-center">
                  <span className="text-6xl group-hover:scale-110 transition-transform">{DEPT_ICONS[dept] || "🎓"}</span>
                  <p className="text-white font-bold text-base leading-tight">{dept}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 1: Professor list ────────────────────────────────────────────── */}
      {view === "getid_step1" && selectedDept && (
        <div className="flex-1 flex flex-col items-center px-4 py-8 animate-slide-up">
          <div className="w-full max-w-4xl">
            <div className="mb-6">
              <p className="font-display font-bold text-4xl text-white mb-1">{selectedDept}</p>
              <p className="text-white/50 text-lg">Select your name</p>
            </div>
            <div className="relative mb-6">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                className="w-full bg-white/15 border border-white/25 text-white placeholder:text-white/40
                           rounded-2xl pl-11 pr-4 py-4 text-base focus:outline-none focus:ring-2
                           focus:ring-white/30 focus:border-white/50 transition-all"
                placeholder="Search name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {loadingProfs ? (
              <div className="flex justify-center py-12"><Spinner size={10} light /></div>
            ) : filteredProfs.length === 0
              ? <p className="text-white/40 text-lg text-center py-10">No results found.</p>
              : (
                <div className="grid grid-cols-4 gap-5 max-h-[55vh] overflow-y-auto pr-1">
                  {filteredProfs.map(prof => {
                    const name   = typeof prof === "string" ? prof : prof.name;
                    const photo  = typeof prof === "object" ? prof.photo : null;
                    const initials = name
                      .replace(/^(Engr\.|Dr\.|Prof\.|AR\.)\s*/i, "")
                      .split(" ").filter(Boolean).slice(0, 2)
                      .map(w => w[0]).join("").toUpperCase();
                    return (
                      <button
                        key={name}
                        onClick={() => handleSelectProfessor(name, selectedDept)}
                        disabled={loadingProf === name}
                        className="glass border border-white/20 rounded-3xl p-5 flex flex-col items-center gap-3
                                   hover:bg-white/20 transition-all active:scale-[0.97] disabled:opacity-60 group">
                        <div className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center shrink-0
                                       bg-[#003366] group-hover:scale-110 transition-transform shadow-lg">
                          {loadingProf === name
                            ? <Spinner size={6} light />
                            : photo
                              ? <img src={photo} alt={name} className="w-full h-full object-cover" />
                              : <span className="text-white font-display font-bold text-3xl">{initials}</span>
                          }
                        </div>
                        <p className="text-white font-semibold text-sm text-center leading-tight line-clamp-2">
                          {name.replace(/^(Engr\.|Dr\.|Prof\.|AR\.)\s*/i, "")}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* ── STEP 2: ID Card preview first ────────────────────────────────────── */}
      {view === "getid_step2" && selectedProf && idData && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 animate-slide-up">
          <div className="text-center mb-6">
            <p className="font-display font-bold text-2xl text-white mb-1">Your Faculty ID is Ready!</p>
            <p className="text-white/50 text-sm">Download and keep it — or add a photo first</p>
          </div>
          <FacultyIDCard
            name={selectedProf.name}
            department={selectedProf.dept}
            employeeId={idData.employee_id}
            photo={photo}
            qrBase64={idData.qr_base64}
            onDownload={null}
          />
          <div className="flex gap-3 mt-4 w-full max-w-lg">
            <button onClick={() => setView("getid_step3")}
              className="flex-1 flex items-center justify-center gap-2 bg-[#ffa000] hover:bg-[#e69000]
                         text-white font-semibold py-3 rounded-2xl transition-all shadow-lg active:scale-[0.97]">
              <Camera size={16} /> {photo ? "Retake Photo" : "Add Photo"}
            </button>
          </div>
          <p className="mt-3 text-white/40 text-sm text-center">
            📱 Scan your QR code above using the <strong className="text-white/60">Scan QR</strong> option to enter your dashboard
          </p>
        </div>
      )}

      {/* ── STEP 3: Camera (after seeing ID) ──────────────────────────────────── */}
      {view === "getid_step3" && selectedProf && (
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md animate-slide-up">
            <div className="glass border border-white/20 rounded-3xl overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-r from-[#003366] to-[#0055aa] p-5 flex items-center gap-4">
                <Camera size={24} className="text-white" />
                <div>
                  <p className="font-display font-bold text-white">Take Your Photo</p>
                  <p className="text-white/50 text-xs">{selectedProf.name}</p>
                </div>
              </div>
              <div className="p-5">
                <WebcamCapture
                  onCapture={async (dataUrl) => {
                    setPhoto(dataUrl);
                    setView("getid_step2");
                    try {
                      await axios.post(`${API_BASE}/teacher/update-photo`, {
                        employee_id: idData.employee_id,
                        photo: dataUrl
                      });
                    } catch(_) {}
                  }}
                  onSkip={() => { setPhoto(null); setView("getid_step2"); }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SCAN QR ────────────────────────────────────────────────────────── */}
      {view === "scanqr" && (
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md animate-slide-up">
            <div className="glass border border-white/20 rounded-3xl overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-r from-[#ff6f00] to-[#ffaa00] p-5 flex items-center gap-4">
                <ScanLine size={24} className="text-white" />
                <div>
                  <p className="font-display font-bold text-white">Scan Your Faculty ID QR</p>
                  <p className="text-white/70 text-xs">Scan the QR code on your Faculty ID card</p>
                </div>
              </div>
              <div className="p-5">
                <QRScanner onScan={handleTeacherQRScan} onError={msg => addToast(msg, "error")} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DEAN ───────────────────────────────────────────────────────────── */}
      {view === "dean" && (
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md animate-slide-up">
            <div className="glass border border-white/20 rounded-3xl overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-r from-[#1e293b] to-[#334155] p-5 flex items-center gap-4">
                <Shield size={22} className="text-white" />
                <div>
                  <p className="font-display font-bold text-white">Admin Dashboard</p>
                  <p className="text-white/50 text-xs">Administrative Access — College of Engineering</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {!deanQR ? (
                  <button onClick={generateDeanQR} disabled={deanQRLoading}
                    className="w-full flex items-center justify-center gap-2 glass border border-white/20
                               text-white font-semibold py-3 rounded-2xl transition-all disabled:opacity-50">
                    {deanQRLoading ? <Spinner size={4} light /> : <QrCode size={16} />}
                    {deanQRLoading ? "Generating..." : "Generate Admin QR Code"}
                  </button>
                ) : (
                  <div className="text-center space-y-3">
                    <p className="text-white/50 text-sm">Scan this QR to log in as Dean</p>
                    <div className="bg-white p-3 rounded-2xl inline-block">
                      <img src={deanQR} alt="Dean QR" className="w-40 h-40 mx-auto" />
                    </div>
                    <button onClick={() => { const a = document.createElement("a"); a.href = deanQR; a.download = "dean-qr.png"; a.click(); }}
                      className="flex items-center justify-center gap-1.5 text-white/50 hover:text-white text-xs mx-auto transition-colors">
                      Download QR
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/15" />
                  <span className="text-white/30 text-xs">or scan existing QR</span>
                  <div className="flex-1 h-px bg-white/15" />
                </div>
                <QRScanner onScan={handleDeanQRScan} onError={msg => addToast(msg, "error")} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Name Modal ───────────────────────────────────────────────────── */}
      {editingName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingName(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md animate-bounce-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-display font-bold text-lg text-[#003366]">Edit Name</h2>
                <p className="text-gray-400 text-xs mt-0.5">Correct misspelling or update married surname</p>
              </div>
              <button onClick={() => setEditingName(null)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <X size={14} className="text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                <p className="text-amber-700 text-xs font-semibold">Current name in system:</p>
                <p className="text-amber-900 text-sm font-bold mt-0.5">{editingName.original}</p>
                <p className="text-amber-600 text-xs mt-1">{editingName.dept}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Corrected / Updated Name
                </label>
                <input
                  className="w-full border border-gray-200 bg-gray-50 rounded-2xl px-4 py-3.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366]
                             focus:bg-white transition-all"
                  placeholder="e.g. Engr. Maria Santos-Cruz"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSaveEditedName()}
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1.5">Include your title — Engr., Dr., Prof., AR.</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditingName(null)}
                  className="flex-1 border-2 border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white
                             font-semibold py-3 px-5 rounded-2xl transition-all text-sm">
                  Cancel
                </button>
                <button onClick={handleSaveEditedName} disabled={savingName || !customName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#004080]
                             text-white font-semibold py-3 rounded-2xl transition-all text-sm disabled:opacity-50">
                  {savingName ? <Spinner size={4} light /> : <Check size={15} />}
                  {savingName ? "Saving..." : "Save & Generate ID"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </URSBackground>
  );
}