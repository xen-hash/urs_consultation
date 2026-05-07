import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { Monitor, RefreshCw, LogOut, Search, ChevronDown, ChevronRight } from "lucide-react";
import { StatusBadge } from "./SharedUI.jsx";
import VirtualKeyboard from "./VirtualKeyboard.jsx";
import { API_BASE, KIOSK_PASSWORD } from "./constants.js";

let socket = null;

export default function KioskView() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({});
  const [exitModal, setExitModal] = useState(false);
  const [exitPass, setExitPass] = useState("");
  const [exitErr, setExitErr] = useState("");
  const [kbTarget, setKbTarget] = useState("search"); // "search" | "exit"
  const [showKB, setShowKB] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/teacher-logs`);
      setDepartments(res.data || []);
      setLastUpdate(new Date());
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10000);
    socket = io(SOCKET_URL, { transports: ["websocket"] });
    socket.on("status_update", fetchData);
    return () => { clearInterval(iv); socket?.disconnect(); };
  }, []);

  const handleKey = (k) => {
    if (kbTarget === "search") setSearch(p => p + k);
    else setExitPass(p => p + k);
  };
  const handleDelete = () => {
    if (kbTarget === "search") setSearch(p => p.slice(0, -1));
    else setExitPass(p => p.slice(0, -1));
  };
  const handleClear = () => {
    if (kbTarget === "search") setSearch("");
    else setExitPass("");
  };

  const handleExit = () => {
    if (exitPass === (KIOSK_PASSWORD || "admin123")) {
      socket?.disconnect();
      navigate("/");
    } else {
      setExitErr("Incorrect password.");
      setExitPass("");
    }
  };

  const toggleDept = (dept) => setExpanded(p => ({ ...p, [dept]: !p[dept] }));

  const filtered = departments.map(dept => ({
    ...dept,
    professors: dept.professors.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      dept.department.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(d => d.professors.length > 0);

  const totalAvail = departments.reduce((acc, d) =>
    acc + d.professors.filter(p => p.status === "Available").length, 0);

  return (
    <div className="min-h-screen bg-urs-blue flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-urs-blue border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-urs-blue font-display font-black text-2xl">U</span>
          </div>
          <div>
            <h1 className="font-display font-black text-white text-xl leading-tight">
              Faculty Consultation System
            </h1>
            <p className="text-blue-200 text-xs">University of Rizal System — Kiosk Display</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-white">
            <p className="text-2xl font-display font-bold">
              {new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-blue-200 text-xs">
              {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            {totalAvail} Available
          </div>
          <button onClick={() => setExitModal(true)}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm px-3 py-1.5 rounded-lg transition-all border border-white/20">
            <LogOut size={14} /> Exit Kiosk
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Search bar */}
          <div
            className="relative mb-4 cursor-text"
            onClick={() => { setKbTarget("search"); setShowKB(true); }}
          >
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <div className="w-full bg-white rounded-2xl px-5 py-3.5 pl-11 text-gray-700 shadow-md border-2 border-transparent focus-within:border-urs-orange cursor-text select-none min-h-[52px] flex items-center">
              {search || <span className="text-gray-400">Tap to search professor name...</span>}
              {kbTarget === "search" && showKB && <span className="ml-0.5 animate-pulse text-urs-orange">|</span>}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: "Total Faculty", value: departments.reduce((a, d) => a + d.professors.length, 0), color: "bg-white text-urs-blue" },
              { label: "Available Now", value: totalAvail, color: "bg-green-500 text-white" },
              { label: "Departments", value: departments.length, color: "bg-white text-urs-blue" },
              { label: "Last Updated", value: lastUpdate.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }), color: "bg-white text-urs-blue" }
            ].map(s => (
              <div key={s.label} className={`${s.color} rounded-2xl p-4 text-center shadow-lg`}>
                <p className="text-2xl font-display font-black">{s.value}</p>
                <p className="text-xs opacity-70 font-semibold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Department accordion */}
          <div className="space-y-3">
            {filtered.map(dept => {
              const isOpen = expanded[dept.department] !== false;
              const avail = dept.professors.filter(p => p.status === "Available").length;
              return (
                <div key={dept.department} className="bg-white rounded-2xl overflow-hidden shadow-lg">
                  <button
                    onClick={() => toggleDept(dept.department)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${avail > 0 ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
                      <div className="text-left">
                        <h3 className="font-display font-bold text-urs-blue text-lg">{dept.department}</h3>
                        <p className="text-xs text-gray-500">
                          {dept.professors.length} professors ·{" "}
                          <span className="text-green-600 font-semibold">{avail} available</span>
                        </p>
                      </div>
                    </div>
                    {isOpen
                      ? <ChevronDown size={20} className="text-gray-400" />
                      : <ChevronRight size={20} className="text-gray-400" />
                    }
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100">
                        {dept.professors.map(prof => (
                          <div
                            key={prof.name}
                            className={`bg-white px-5 py-3.5 flex items-center justify-between
                              ${prof.status === "Available" ? "border-l-4 border-l-green-500" : "border-l-4 border-l-transparent"}`}
                          >
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{prof.name}</p>
                            </div>
                            <StatusBadge status={prof.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Virtual keyboard panel */}
        {showKB && (
          <div className="w-80 bg-gray-800 flex flex-col border-l border-white/10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <p className="text-white text-sm font-semibold">On-Screen Keyboard</p>
              <button onClick={() => setShowKB(false)} className="text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-700 rounded">
                Hide
              </button>
            </div>
            <div className="px-3 py-2">
              <div className="bg-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono min-h-[38px] flex items-center">
                {kbTarget === "search" ? (search || <span className="text-gray-400">search...</span>) : (exitPass ? "●".repeat(exitPass.length) : <span className="text-gray-400">password...</span>)}
              </div>
            </div>
            <div className="p-3 flex-1 flex items-center">
              <VirtualKeyboard
                onKey={handleKey}
                onDelete={handleDelete}
                onClear={handleClear}
                onEnter={() => {
                  if (kbTarget === "exit") handleExit();
                  else setShowKB(false);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Exit modal */}
      {exitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl animate-bounce-in">
            <h3 className="font-display font-bold text-lg text-urs-blue mb-1">Exit Kiosk Mode</h3>
            <p className="text-gray-500 text-sm mb-4">Enter the admin password to exit</p>
            <div
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 text-sm mb-1 min-h-[44px] flex items-center cursor-text"
              onClick={() => { setKbTarget("exit"); setShowKB(true); setExitModal(false); }}
            >
              {exitPass ? "●".repeat(exitPass.length) : <span className="text-gray-400">Tap to enter password</span>}
            </div>
            {exitErr && <p className="text-red-600 text-xs mb-3">{exitErr}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setExitModal(false); setExitPass(""); setExitErr(""); }}
                className="flex-1 btn-outline text-sm py-2.5">Cancel</button>
              <button onClick={handleExit}
                className="flex-1 btn-primary text-sm py-2.5">Exit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
