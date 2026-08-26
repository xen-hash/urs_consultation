import { DEVELOPERS, PROJECT_CONTACT } from "../constants.js";

/**
 * Who built this, on the front page, in one line.
 *
 * It used to be a two-column block with headings, a bulleted credits list and a
 * paragraph explaining what the contact address is for — a full page section
 * for something nobody arrives here to read. The names and the address are the
 * only parts anyone ever needed; the headings around them were scaffolding.
 *
 * The names and the address live in constants.js, so they are edited in one
 * place rather than in the markup.
 */
export default function SiteFooter() {
  const names = DEVELOPERS.filter(d => d.name).map(d => d.name);

  return (
    <footer className="relative z-10 mt-auto border-t border-on-backdrop/10 pb-safe">
      {/* Wraps rather than scrolls: on a narrow phone the three parts stack
          into two short lines instead of running off the edge. */}
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-3
                      flex flex-wrap items-center justify-center gap-x-2 gap-y-1
                      text-xs text-on-backdrop/45">
        <span>URS College of Engineering · Faculty Consultation System</span>
        {names.length > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span>{names.join(" & ")}</span>
          </>
        )}
        {PROJECT_CONTACT && (
          <>
            <span aria-hidden="true">·</span>
            <a href={`mailto:${PROJECT_CONTACT}`}
              className="text-on-backdrop/65 hover:text-on-backdrop underline
                         underline-offset-2 decoration-on-backdrop/25 transition-colors">
              {PROJECT_CONTACT}
            </a>
          </>
        )}
      </div>
    </footer>
  );
}
