import { ChevronLeft, GraduationCap, BookOpen, Shield, Radio } from "lucide-react";

import { urlFor, THIS_APP } from "../lib/origins.js";
import AppLink from "./AppLink.jsx";

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
 *
 * Two of the three entries now leave this origin, which is what the split cost
 * and why this component still exists: three separate deployments are three
 * addresses nobody can be expected to remember, so each of them carries the
 * other two.
 */
const PORTALS = [
  { id: "student", path: "/sign-in",      label: "Student portal",  icon: GraduationCap },
  { id: "faculty", path: "/",             label: "Faculty portal",  icon: BookOpen },
  { id: "admin",   path: "/",             label: "Administration",  icon: Shield },
  { id: "student", path: "/availability", label: "Who's available", icon: Radio },
];

/**
 * `current` is the app id this screen belongs to — its own entry is dropped.
 *
 * `hide` drops entries a screen already offers better than a chip row can, by
 * label: the student sign-in has its own "who's available" note above this, and
 * the faculty and administration screens are staff-only doors where a public
 * board is not one of the ways in they are looking for.
 */
export default function PortalNav({
  current = THIS_APP,
  hide = [],
  tone = "backdrop",
  className = "",
}) {
  const others = PORTALS.filter(p => {
    if (hide.includes(p.label)) return false;
    // The availability board is a screen, not a portal, so it survives being
    // on its own app — only the sign-in entries drop out on their own origin.
    return p.path === "/availability" ? current !== "student" : p.id !== current;
  });

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
        {others.map(({ id, path, label, icon: Icon }) => (
          <li key={label}>
            <AppLink
              to={urlFor(id, path)}
              className={`inline-flex items-center gap-2 px-3 min-h-[40px] rounded-lg border
                          text-sm font-medium transition-colors ${styles.link}`}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </AppLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
