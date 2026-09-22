import { ChevronLeft } from "lucide-react";

import { THIS_APP, labelOf, urlFor } from "../lib/origins.js";
import HomeBrand from "./HomeBrand.jsx";
import RoleBadge from "./RoleBadge.jsx";

/**
 * The frame around all three sign-ins.
 *
 * There were three of these and they had drifted: the student one was a
 * narrow column and the faculty one three times as wide, one used ArrowLeft
 * and the other ChevronLeft, the headings were on two different type scales,
 * and administration was a different design altogether — a desktop split panel
 * with a navy aside that carried nothing but a paragraph, and that on a phone
 * was simply not drawn. Three copies of one screen is how that happens, and
 * splitting the apps into three repositories' worth of folders would have made
 * it worse rather than better.
 *
 * So the chrome lives here and the apps supply only their panels. What the
 * frame owns is everything that should not be a per-app decision: the width of
 * the column, the way back, where the role is announced, and the safe-area
 * padding that keeps the last field clear of a phone's home indicator.
 *
 * `back` is either `{ to }` for somewhere in this app, `{ href }` for one of
 * the other two, or `{ onClick }` for stepping back inside the screen. A
 * sign-in with no way out is how the faculty portal shipped, so one is always
 * drawn; there is no way to pass none.
 */
const COLUMNS = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl" };

export default function SignInLayout({
  app = THIS_APP,
  back,
  width = "sm",
  children,
  footer,
}) {
  // One of three, picked by what the panel holds rather than by which app it
  // is: a PIN keypad wants a narrow column on every screen, and a row of
  // method cards wants room to be a row. Faculty had max-w-3xl and student
  // max-w-sm for exactly this reason, and squeezing both into one width made
  // the faculty cards wrap mid-phrase on a desktop.
  const column = COLUMNS[width] || COLUMNS.sm;

  return (
    <>
      {/* Full width, not a centred column: on a desktop the centred bar put
          the logo out in the middle of the screen, nowhere near the corner
          people look for it. */}
      <nav className="sticky top-0 z-30 header-on-backdrop pt-safe">
        <div className="flex items-center gap-2.5 px-4 sm:px-6 py-3 w-full">
          <HomeBrand tone="dark" className="min-w-0 flex-1" />
          {/* The subtitle used to carry this — "Student Portal" in small grey
              under the university name — where it read as part of the brand
              rather than as an answer to "which app is this?". */}
          <RoleBadge app={app} />
          <BackButton {...back} />
        </div>
        {/* One hairline in the role's colour, under every screen of that app.
            It is the only place the accent appears before you have signed in,
            and it is what makes two sign-ins that are otherwise identical
            distinguishable at a glance. */}
        <div className="h-0.5 bg-role" aria-hidden="true" />
      </nav>

      <main
        className={`flex-1 w-full ${column} mx-auto px-4 flex flex-col justify-center
                    pt-8 sm:pt-10
                    pb-[calc(2rem+env(safe-area-inset-bottom,0px))]
                    sm:pb-[calc(3rem+env(safe-area-inset-bottom,0px))]`}
      >
        {children}
        {footer}
      </main>
    </>
  );
}

/**
 * One affordance, three ways of being told where it goes.
 *
 * The word drops off below 400px. The header carries three things — the
 * university, which app this is, and the way out — and on a 360px phone the
 * three of them do not fit with every word intact. Of the three, "Back" beside
 * a left chevron is the one nobody needs the word for, and the role is the one
 * that must not be the thing that goes: it is the whole reason the badge was
 * added. The accessible name stays either way.
 */
function BackButton({ to, href, onClick, label = "Back" }) {
  const className = "btn btn-ghost-light btn-sm shrink-0";
  const inner = (
    <>
      <ChevronLeft size={16} aria-hidden="true" />
      <span className="hidden xs:inline">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} aria-label={label}>
        {inner}
      </button>
    );
  }
  // A plain anchor either way. `to` is on this origin and `href` is not, but a
  // sign-in header is not worth a router transition — and this way the two
  // cases cannot render differently.
  return <a href={href || to} className={className} aria-label={label}>{inner}</a>;
}

/**
 * The title block, so the three sign-ins are read in the same voice.
 *
 * One heading per panel and one sentence under it. The sentence says what to
 * do, not what the screen is: "Scan your ID card, or use your Employee ID and
 * PIN" is worth a line, "This is the sign-in page" is not.
 */
export function SignInHeading({ id, title, children, className = "mb-7" }) {
  return (
    <header className={className}>
      <h1 id={id} className="text-title font-bold text-on-backdrop">{title}</h1>
      {children && (
        <p className="text-on-backdrop/75 mt-1.5 leading-relaxed">{children}</p>
      )}
    </header>
  );
}

/** Where the front page is, for the "Back" out of a staff sign-in. */
export const publicHome = () => urlFor("student", "/");

/** The app's own name, for a heading that wants to say it. */
export const appLabel = app => labelOf(app || THIS_APP);
