import { Link } from "react-router-dom";
import { ChevronLeft, GraduationCap, BookOpen, Shield, Radio } from "lucide-react";

/**
 * Getting back out of a panel you did not mean to open.
 *
 * The portals put a single Back in the top bar, which is a long way from the
 * thing you just tapped and easy to miss entirely on a wide screen — the panel
 * is in the middle of the page and the way out is in the corner. This sits at
 * the top of the panel itself, where the eye already is.
 */
export function BackLink({ onClick, children = "Back", className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 -ml-2 px-2 min-h-[40px] rounded-lg
                  text-sm font-medium text-on-backdrop/75 hover:text-on-backdrop
                  hover:bg-on-backdrop/10 transition-colors ${className}`}
    >
      <ChevronLeft size={17} aria-hidden="true" />
      {children}
    </button>
  );
}

/**
 * The other ways in, from wherever you have landed.
 *
 * Someone who opens the faculty portal looking for the student one has no way
 * across without editing the URL, and a mistyped address used to bounce
 * silently to the front page with no explanation. Every public screen carries
 * this, so being in the wrong place costs one tap.
 */
const PORTALS = [
  { to: "/student",      label: "Student portal",   icon: GraduationCap },
  { to: "/teacher",      label: "Faculty portal",   icon: BookOpen },
  { to: "/dean",         label: "Administration",   icon: Shield },
  { to: "/availability", label: "Who's available",  icon: Radio },
];

/**
 * `hide` drops entries a screen already offers better than a chip row can:
 * the student sign-in has its own "who's available" note above this, and the
 * faculty and administration screens are staff-only doors where a public board
 * is not one of the ways in they are looking for.
 */
export default function PortalNav({ current, hide = [], tone = "backdrop", className = "" }) {
  const others = PORTALS.filter(p => p.to !== current && !hide.includes(p.to));

  if (others.length === 0) return null;

  const styles = tone === "light"
    ? { rule: "border-border", head: "text-subtle-fg",
        link: "text-muted-fg hover:text-fg hover:bg-surface-2 border-border" }
    : { rule: "border-on-backdrop/15", head: "text-on-backdrop/45",
        link: "text-on-backdrop/75 hover:text-on-backdrop hover:bg-on-backdrop/10 border-on-backdrop/20" };

  return (
    <nav aria-label="Other portals" className={`border-t ${styles.rule} pt-5 ${className}`}>
      <p className={`text-xs font-semibold uppercase tracking-widest ${styles.head} mb-3`}>
        In the wrong place?
      </p>
      <ul className="flex flex-wrap gap-2">
        {others.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className={`inline-flex items-center gap-2 px-3 min-h-[40px] rounded-lg border
                          text-sm font-medium transition-colors ${styles.link}`}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
