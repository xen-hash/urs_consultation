import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, GraduationCap, ClipboardList, UserPlus,
  QrCode, ScrollText, Menu, LogOut, Shield, Download, RefreshCw,
  Volume2, VolumeX, X,
} from "lucide-react";
import { Toast, useToastState, Drawer, IconButton, Button } from "./SharedUI.jsx";
import { getSession, clearSession } from "./auth.js";
import api from "./httpClient.js";
import { useStats, useDepartments, usePagedResource } from "./admin/hooks.js";
import { announceNew, resetAnnounced, setMuted } from "./admin/announcer.js";

import OverviewTab from "./admin/OverviewTab.jsx";
import FacultyTab from "./admin/FacultyTab.jsx";
import CredentialsTab from "./admin/CredentialsTab.jsx";
import StudentsTab from "./admin/StudentsTab.jsx";
import RequestsTab from "./admin/RequestsTab.jsx";
import AuditTab from "./admin/AuditTab.jsx";
import AddTeacherTab from "./admin/AddTeacherTab.jsx";

const TABS = [
  { id: "overview",    label: "Dashboard",   icon: LayoutDashboard },
  { id: "credentials", label: "Credentials", icon: QrCode },
  { id: "faculty",     label: "Faculty",     icon: BookOpen },
  { id: "students",    label: "Students",    icon: GraduationCap },
  { id: "requests",    label: "Requests",    icon: ClipboardList },
  { id: "audit",       label: "Audit log",   icon: ScrollText },
  { id: "add",         label: "Add faculty", icon: UserPlus },
];

export default function DeanDashboard() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToastState();
  const admin = getSession("admin");

  const [tab, setTab] = useState("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [muted, setMutedState] = useState(true);

  const { stats, loading: statsLoading, reload: reloadStats } = useStats();
  const { departments, reload: reloadDepts, loading: deptsLoading } = useDepartments();
  // The overview's recent list only ever needs the newest few rows.
  const recent = usePagedResource("/dean/requests", { limit: 20, enabled: !!admin });

  useEffect(() => { if (!admin) navigate("/dean", { replace: true }); }, [admin, navigate]);
  useEffect(() => { resetAnnounced(); }, []);
  useEffect(() => { setMuted(muted); }, [muted]);

  // Speak newly arrived requests. Off by default: browsers block speech until
  // the page has been interacted with, and an office screen that starts talking
  // unprompted is worse than one that waits to be switched on.
  useEffect(() => {
    if (!muted && recent.data.length) announceNew(recent.data);
  }, [recent.data, muted]);

  const refreshAll = useCallback(() => {
    reloadStats(); reloadDepts(); recent.reload();
  }, [reloadStats, reloadDepts, recent]);

  const signOut = () => { clearSession(); navigate("/dean", { replace: true }); };

  const exportData = async (type) => {
    try {
      // A new tab cannot carry the Authorization header, so the file is fetched
      // with the session token and handed to the browser as a blob.
      const res = await api.get("/export", { params: { type }, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `URS_Consultation_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("Export downloaded.", "success");
    } catch {
      addToast("Could not export right now.", "error");
    }
  };

  if (!admin) return null;

  const nav = (
    <NavContents
      tab={tab}
      pending={stats?.pending}
      onPick={id => { setTab(id); setDrawerOpen(false); }}
      onExport={exportData}
      muted={muted}
      onToggleMute={() => setMutedState(m => !m)}
      onSignOut={signOut}
    />
  );

  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Desktop rail. Always expanded: the old sidebar revealed its labels on
          hover only, which is invisible on a touch screen. */}
      <aside className="hidden lg:flex flex-col w-[236px] shrink-0 h-dvh sticky top-0 bg-brand-900">
        {nav}
      </aside>

      {/* Mobile drawer. `mobileSidebarOpen` used to control only the dark
          backdrop and never the panel, so the hamburger appeared to do nothing. */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} label="Dashboard navigation">
        {nav}
      </Drawer>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-surface border-b border-border pt-safe">
          <div className="flex items-center gap-2 px-3 sm:px-5 py-2.5">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden w-11 h-11 grid place-items-center rounded-lg text-muted-fg hover:bg-surface-2"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-semibold text-fg truncate">
                {TABS.find(t => t.id === tab)?.label}
              </h1>
              <p className="text-xs text-muted-fg hidden sm:block">
                Administration · College of Engineering
              </p>
            </div>
            {stats?.pending > 0 && (
              <span className="badge badge-warning">{stats.pending} pending</span>
            )}
            <IconButton icon={RefreshCw} label="Refresh" onClick={refreshAll} />
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-5 pb-safe">
          {tab === "overview" && (
            <OverviewTab
              stats={stats}
              statsLoading={statsLoading}
              departments={departments}
              requests={recent.data}
              onSeeAll={() => setTab("requests")}
            />
          )}
          {tab === "credentials" && <CredentialsTab addToast={addToast} />}
          {tab === "faculty" && (
            <FacultyTab departments={departments} loading={deptsLoading}
              onAdd={() => setTab("add")} />
          )}
          {tab === "students" && <StudentsTab />}
          {tab === "requests" && <RequestsTab addToast={addToast} onChanged={refreshAll} />}
          {tab === "audit" && <AuditTab />}
          {tab === "add" && (
            <AddTeacherTab addToast={addToast} onAdded={refreshAll}
              onGoToCredentials={() => setTab("credentials")} />
          )}
        </main>
      </div>
    </div>
  );
}

function NavContents({ tab, pending, onPick, onExport, muted, onToggleMute, onSignOut }) {
  return (
    <>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 shrink-0 pt-safe">
        <span className="icon-tile bg-white/10 text-white w-9 h-9">
          <Shield size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-white text-sm leading-tight">Administrator</p>
          <p className="text-white/50 text-[11px] truncate">College of Engineering</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5" aria-label="Sections">
        {TABS.map(t => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              aria-current={active ? "page" : undefined}
              className={`w-full flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium
                transition-colors duration-200
                ${active ? "bg-white/15 text-white" : "text-white/60 hover:text-white hover:bg-white/10"}`}
            >
              <t.icon size={17} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{t.label}</span>
              {t.id === "requests" && pending > 0 && (
                <span className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-accent text-brand-900">
                  {pending}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-2 border-t border-white/10 space-y-0.5 shrink-0">
        <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest px-3 py-2">
          Export
        </p>
        {[["today", "Today"], ["all", "All records"]].map(([type, label]) => (
          <button key={type} onClick={() => onExport(type)}
            className="w-full flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm
                       text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <Download size={16} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      <div className="p-2 border-t border-white/10 space-y-0.5 shrink-0 pb-safe">
        <button onClick={onToggleMute}
          className="w-full flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm
                     text-white/60 hover:text-white hover:bg-white/10 transition-colors">
          {muted ? <VolumeX size={16} aria-hidden="true" className="shrink-0" />
                 : <Volume2 size={16} aria-hidden="true" className="shrink-0" />}
          <span className="truncate">{muted ? "Announcements off" : "Announcements on"}</span>
        </button>
        <button onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm
                     text-white/60 hover:text-white hover:bg-danger/20 transition-colors">
          <LogOut size={16} aria-hidden="true" className="shrink-0" />
          <span className="truncate">Sign out</span>
        </button>
      </div>
    </>
  );
}
