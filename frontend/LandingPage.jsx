import { Link } from "react-router-dom";
import { GraduationCap, BookOpen, ArrowRight, Wifi, WifiOff, Shield, Monitor } from "lucide-react";
import { InstallAppButton, useOnlineStatus } from "./PWA.jsx";
import SiteFooter from "./ui/SiteFooter.jsx";
import URSBackground from "./URSBackground.jsx";
import ursLogo from "./URS_LOGO.png";

const PORTALS = [
  {
    to: "/student", icon: GraduationCap, title: "Student",
    description: "Check faculty availability and request a consultation.",
    cta: "Sign in or register",
    tint: "rgb(var(--brand-100) / 0.85)",
  },
  {
    to: "/teacher", icon: BookOpen, title: "Faculty",
    description: "Manage your schedule, availability and incoming requests.",
    cta: "Sign in",
    tint: "rgb(255 236 199)",
  },
  {
    to: "/dean", icon: Shield, title: "Administration",
    description: "Faculty credentials, consultation activity and reporting.",
    cta: "Administrator sign in",
    tint: "rgb(var(--info-50))",
  },
];

export default function LandingPage() {
  const online = useOnlineStatus();

  return (
    <URSBackground>
      <nav className="sticky top-0 z-30 bg-surface header-blend pt-safe">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3 max-w-6xl mx-auto w-full">
          <img src={ursLogo} alt="" aria-hidden="true" className="w-8 h-8 object-contain shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-fg truncate">University of Rizal System</p>
            <p className="text-xs text-muted-fg truncate">College of Engineering</p>
          </div>
          <span className={`badge ${online ? "badge-success" : "badge-warning"} hidden xs:inline-flex`}>
            {online ? <Wifi size={13} aria-hidden="true" /> : <WifiOff size={13} aria-hidden="true" />}
            {online ? "Online" : "Offline"}
          </span>
          <InstallAppButton />
        </div>
      </nav>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 pb-safe">
        <header className="max-w-2xl animate-rise">
          <h1 className="text-display font-bold text-on-backdrop">
            Faculty consultation, without the guesswork
          </h1>
          <p className="text-on-backdrop/75 mt-3 text-base sm:text-lg leading-relaxed">
            Live faculty availability, consultation requests and scheduling for the
            URS College of Engineering.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-3 mt-10 animate-rise">
          {PORTALS.map(({ to, icon: Icon, title, description, cta, tint }) => (
            <Link key={to} to={to} className="card card-action card-tinted-hue group"
              style={{ "--tint": tint }}>
              <span className="icon-tile icon-tile-brand"><Icon size={22} aria-hidden="true" /></span>
              <span className="font-semibold text-fg text-lg">{title}</span>
              <span className="text-sm text-muted-fg grow">{description}</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand mt-1">
                {cta}
                <ArrowRight size={15} aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/kiosk" className="btn btn-secondary">
            <Monitor size={16} aria-hidden="true" /> Open public kiosk display
          </Link>
        </div>

      </main>

      <SiteFooter />
    </URSBackground>
  );
}
