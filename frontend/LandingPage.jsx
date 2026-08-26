import { Link } from "react-router-dom";
import { GraduationCap, BookOpen, ArrowRight, Wifi, WifiOff, Shield, Radio } from "lucide-react";
import { InstallAppButton, useOnlineStatus } from "./PWA.jsx";
import SiteFooter from "./ui/SiteFooter.jsx";
import URSBackground from "./URSBackground.jsx";
import HomeBrand from "./ui/HomeBrand.jsx";

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
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3 w-full">
          <HomeBrand subtitle="College of Engineering" className="flex-1" />
          <span className={`badge ${online ? "badge-success" : "badge-warning"} hidden xs:inline-flex`}>
            {online ? <Wifi size={13} aria-hidden="true" /> : <WifiOff size={13} aria-hidden="true" />}
            {online ? "Online" : "Offline"}
          </span>
          <InstallAppButton />
        </div>
      </nav>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
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

        {/* Checking whether one professor is in is the most common thing anyone
            comes here to do, and it needs no account. It should not be buried
            under a sign-in. */}
        <Link to="/availability"
          className="card card-action card-tinted-hue group mt-4 flex-row items-center gap-4"
          style={{ "--tint": "rgb(var(--success-50))" }}>
          <span className="icon-tile shrink-0 bg-success-50 text-success">
            <Radio size={22} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-fg">See who is available right now</span>
            <span className="block text-sm text-muted-fg">
              Live faculty availability — no sign-in needed.
            </span>
          </span>
          <ArrowRight size={18} aria-hidden="true"
            className="text-brand shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>


      </main>

      <SiteFooter />
    </URSBackground>
  );
}
