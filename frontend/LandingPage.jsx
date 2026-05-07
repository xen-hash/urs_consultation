import { Link } from "react-router-dom";
import URSBackground from "../components/URSBackground.jsx";
import { GraduationCap, BookOpen, ArrowRight, Wifi, Shield, Monitor } from "lucide-react";

export default function LandingPage() {
  return (
    <URSBackground>

      {/* ── Glassmorphism Navbar ── */}
      <nav className="sticky top-0 z-30 flex items-center justify-between px-6 sm:px-10 py-4
                      glass border-b border-white/15 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-md">
            <span className="text-[#003366] font-display font-black text-base leading-none">U</span>
          </div>
          <div>
            <p className="text-white font-display font-bold text-sm leading-tight">University of Rizal System</p>
            <p className="text-white/40 text-xs">College of Engineering</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-white/50 text-xs">
            <Wifi size={12} className="text-emerald-400" />
            <span className="text-emerald-400 font-semibold">Live</span>
          </span>
          <Link to="/kiosk"
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm
                       bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-xl transition-all">
            Public Kiosk →
          </Link>
        </div>
      </nav>

      {/* ── Hero section ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">

        <div className="animate-slide-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full
                          px-4 py-1.5 text-white/60 text-xs font-medium mb-8 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Faculty Consultation Management System
          </div>

          <h1 className="font-display font-black text-white text-4xl sm:text-6xl leading-[1.1] tracking-tight mb-4 max-w-2xl mx-auto">
            Connect with Your<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ffa000] to-[#ffcc02]">
              Faculty Anytime
            </span>
          </h1>

          <p className="text-white/50 text-base sm:text-lg max-w-md mx-auto leading-relaxed mb-12">
            Real-time availability, instant consultation requests, and seamless faculty-student communication.
          </p>
        </div>

        {/* ── Three main portal cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl animate-slide-up delay-100">

          {/* Student Portal */}
          <Link to="/student"
            className="group relative overflow-hidden bg-white rounded-3xl p-7 text-left
                       hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 active:scale-[0.98]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#003366] to-[#0066cc] rounded-t-3xl" />
            <div className="w-12 h-12 bg-[#003366] rounded-2xl flex items-center justify-center mb-5
                           group-hover:scale-110 transition-transform duration-300 shadow-lg">
              <GraduationCap size={24} className="text-white" />
            </div>
            <h2 className="font-display font-bold text-xl text-[#003366] mb-1">Student Portal</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              Check faculty availability and request consultations in real-time.
            </p>
            <div className="flex items-center gap-2 text-[#003366] text-sm font-semibold group-hover:gap-3 transition-all">
              Login or Register <ArrowRight size={15} />
            </div>
          </Link>

          {/* Teacher Portal */}
          <Link to="/teacher"
            className="group relative overflow-hidden bg-white rounded-3xl p-7 text-left
                       hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 active:scale-[0.98]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ff6f00] to-[#ffaa00] rounded-t-3xl" />
            <div className="w-12 h-12 bg-[#ff6f00] rounded-2xl flex items-center justify-center mb-5
                           group-hover:scale-110 transition-transform duration-300 shadow-lg">
              <BookOpen size={24} className="text-white" />
            </div>
            <h2 className="font-display font-bold text-xl text-gray-900 mb-1">Teacher Portal</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              Manage your schedule, availability, and incoming consultation requests.
            </p>
            <div className="flex items-center gap-2 text-[#ff6f00] text-sm font-semibold group-hover:gap-3 transition-all">
              Select Your Name <ArrowRight size={15} />
            </div>
          </Link>

          {/* Dean's Office Portal */}
          <Link to="/dean"
            className="group relative overflow-hidden bg-white rounded-3xl p-7 text-left
                       hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 active:scale-[0.98]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1e293b] to-[#475569] rounded-t-3xl" />
            <div className="w-12 h-12 bg-[#1e293b] rounded-2xl flex items-center justify-center mb-5
                           group-hover:scale-110 transition-transform duration-300 shadow-lg">
              <Shield size={24} className="text-white" />
            </div>
            <h2 className="font-display font-bold text-xl text-gray-900 mb-1">Dean's Office</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              Administrative access to faculty data, reports, and consultation analytics.
            </p>
            <div className="flex items-center gap-2 text-[#1e293b] text-sm font-semibold group-hover:gap-3 transition-all">
              Admin Login <ArrowRight size={15} />
            </div>
          </Link>
        </div>

        {/* ── Small footer link for Kiosk only ── */}
        <div className="flex items-center gap-3 mt-6 animate-fade-in delay-300">
          <Link to="/kiosk"
            className="flex items-center gap-2 text-white/40 hover:text-white/70 text-xs
                       bg-white/8 hover:bg-white/12 border border-white/10 hover:border-white/20
                       px-4 py-2 rounded-xl transition-all">
            <Monitor size={13} /> Public Kiosk
          </Link>
        </div>

        <p className="text-white/20 text-xs mt-6 animate-fade-in delay-400">
          URS College of Engineering · Faculty Consultation System
        </p>
      </div>
    </URSBackground>
  );
}