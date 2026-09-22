import { Link } from "react-router-dom";
import {
  GraduationCap, BookOpen, ArrowRight, Wifi, WifiOff, Shield, Radio,
} from "lucide-react";
import { InstallAppButton, useOnlineStatus } from "@urs/shared/PWA.jsx";
import SiteFooter from "@urs/shared/ui/SiteFooter.jsx";
import URSBackground from "@urs/shared/URSBackground.jsx";
import HomeBrand from "@urs/shared/ui/HomeBrand.jsx";
import Mascot from "@urs/shared/ui/Mascot.jsx";
import useLiveAvailability from "@urs/shared/ui/useLiveAvailability.js";
import AppLink from "@urs/shared/ui/AppLink.jsx";
import { urlFor } from "@urs/shared/lib/origins.js";

/**
 * The front door.
 *
 * Ordered by what people actually come here to do, which is not the order a
 * menu of sign-in buttons produces:
 *
 *   1. Check whether one professor is in. By far the most common visit, needs
 *      no account, and used to sit fourth on this page underneath three
 *      sign-ins. It is now the one thing the page leads with, and it carries
 *      the live count so the page proves the system is running before anybody
 *      signs in to anything.
 *   2. Sign in as a student. Thousands of people.
 *   3. Sign in as faculty. Hundreds.
 *   4. Administration. A handful, who know exactly where they are going and do
 *      not need a card the size of the other two.
 *
 * Giving those four equal weight, as three identical cards and a link did,
 * spends the best part of the screen on the rarest task.
 *
 * Since the three roles became three deployments, this page is the only one
 * that holds all three addresses — so it is also the answer to "which URL was
 * mine again?", which is the one thing splitting an app into three costs the
 * people using it. Two of the three cards leave this origin; AppLink is what
 * makes that no different to write than a route.
 */

const SIGN_INS = [
  {
    to: urlFor("student", "/sign-in"), icon: GraduationCap, title: "Student",
    description: "Request a consultation and see what your professor said.",
    cta: "Sign in or register",
    tint: "rgb(var(--brand-100) / 0.85)",
  },
  {
    to: urlFor("faculty", "/"), icon: BookOpen, title: "Faculty",
    description: "Your schedule, your availability, and who is waiting on you.",
    cta: "Sign in",
    tint: "rgb(255 236 199)",
  },
];

export default function LandingPage() {
  const online = useOnlineStatus();

  return (
    <URSBackground>
      <nav className="sticky top-0 z-30 header-on-backdrop pt-safe">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3 w-full">
          <HomeBrand tone="dark" subtitle="College of Engineering" className="flex-1" />
          <span className={`badge hidden xs:inline-flex border
            ${online ? "bg-success/15 text-success border-success/30"
                     : "bg-warning/20 text-warning-fg border-warning/40"}`}>
            {online ? <Wifi size={13} aria-hidden="true" /> : <WifiOff size={13} aria-hidden="true" />}
            {online ? "Online" : "Offline"}
          </span>
          <InstallAppButton tone="dark" />
        </div>
      </nav>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16
                       pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]
                       sm:pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <header className="animate-rise flex flex-col sm:flex-row sm:items-end gap-5 sm:gap-10">
          <div className="max-w-2xl">
            <h1 className="text-display font-bold text-on-backdrop">
              Faculty consultation, without the guesswork
            </h1>
            {/* On a phone Navi sits beside this paragraph rather than under
                it. Stacked, the three blocks cost about 460px before the first
                thing anybody can press — half the fold spent on a headline
                they have read before. Alongside, the mascot costs nothing the
                text was not already using. */}
            <div className="flex items-end gap-3 sm:block">
              <p className="flex-1 text-on-backdrop/75 mt-3 text-base sm:text-lg leading-relaxed">
                {/* The nav already says College of Engineering; repeating it
                    here cost a line on a phone and told nobody anything. */}
                See who is free, book a consultation, and get an answer —
                without walking across campus to find out.
              </p>
              <Mascot pose="bust" size="md" priority className="sm:hidden -mb-1" />
            </div>
          </div>
          {/* Full figure where there is room beside the headline; head and
              shoulders where there is not. See Mascot.jsx for why this is two
              crops and not one image scaled. */}
          <Mascot pose="hero" size="lg" priority
            className="hidden sm:block sm:-mb-2 lg:mr-4" />
        </header>

        {/* ── The thing most people came for ────────────────────────────── */}
        <Link
          to="/availability"
          data-tour="landing-availability"
          className="card card-action card-tinted-hue group mt-6 sm:mt-10
                     flex-row items-center gap-4 sm:gap-5 animate-rise
                     border-success/30 hover:border-success/60"
          style={{ "--tint": "rgb(var(--success-50))" }}
        >
          <span className="icon-tile shrink-0 bg-success-50 text-success sm:w-14 sm:h-14">
            <Radio size={24} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-fg text-lg sm:text-xl">
              See who&rsquo;s available
            </span>
            {/* A line box of a fixed height, so the card is exactly the same
                size whether the count is loading, known, or unavailable, and
                the sign-in cards below it never jump. A min-height is not
                enough: the skeleton and the text sit on the line differently
                and still differed by a few pixels. */}
            <span className="flex items-center h-5 mt-1 text-muted-fg text-sm">
              <AvailabilityOnCard />
            </span>
          </span>
          <ArrowRight size={20} aria-hidden="true"
            className="text-success shrink-0 transition-transform duration-200
                       group-hover:translate-x-0.5" />
        </Link>

        {/* ── Sign in ───────────────────────────────────────────────────── */}
        <h2 className="text-xs font-semibold uppercase tracking-widest
                       text-on-backdrop/60 mt-8 sm:mt-10 mb-3">
          Or sign in
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 animate-rise">
          {SIGN_INS.map(({ to, icon: Icon, title, description, cta, tint }) => (
            <AppLink key={to} to={to} className="card card-action card-tinted-hue group"
              style={{ "--tint": tint }}>
              <span className="icon-tile icon-tile-brand"><Icon size={22} aria-hidden="true" /></span>
              <span className="font-semibold text-fg text-lg">{title}</span>
              <span className="text-sm text-muted-fg grow">{description}</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand mt-1">
                {cta}
                <ArrowRight size={15} aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </AppLink>
          ))}
        </div>

        {/* The Dean's Office is a handful of people who know where they are
            going. A row, not a third card competing with the two above. */}
        <a
          href={urlFor("admin", "/")}
          className="group mt-4 flex items-center gap-2.5 text-sm font-medium
                     text-on-backdrop/60 hover:text-on-backdrop transition-colors duration-200
                     rounded-lg -mx-2 px-2 py-2 min-h-[44px]"
        >
          <Shield size={16} aria-hidden="true" className="shrink-0" />
          Administration — credentials, activity and reporting
          <ArrowRight size={14} aria-hidden="true"
            className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
        </a>
      </main>

      <SiteFooter />
    </URSBackground>
  );
}

/**
 * The live count, or honest silence.
 *
 * Three states, not two, because two would let a failed request render as
 * "0 free right now" — a specific, confident, wrong claim about whether staff
 * are at their desks. Only a successful read may show a number; a failure says
 * what the card always used to say and leaves the board to explain itself.
 *
 * The skeleton is the same height as the line it replaces, so the card does
 * not resize under the reader's thumb when the number lands.
 */
function AvailabilityOnCard() {
  const { state, available, total } = useLiveAvailability();

  if (state === "loading") {
    return <span className="h-3 w-36 rounded-full bg-surface-2 animate-shimmer"
      aria-hidden="true" />;
  }

  if (state === "unavailable") {
    return <>No sign-in needed.</>;
  }

  return (
    // flex, not inline-flex: the dot is its own item so a wrapping sentence
    // cannot pull it into the middle of the second line, and "12 of 48" is
    // held together so the count never breaks across a line break.
    <span className="flex items-center gap-2">
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        {available > 0 && (
          <span className="absolute inline-flex h-full w-full rounded-full
                           bg-success opacity-60 animate-ping" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full
          ${available > 0 ? "bg-success" : "bg-subtle-fg"}`} />
      </span>
      <span className="min-w-0">
        {available > 0
          ? <><strong className="font-semibold text-success whitespace-nowrap">
                {available} of {total}
              </strong>{" "}free right now</>
          : <>Nobody free right now</>}
      </span>
    </span>
  );
}
