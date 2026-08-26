import { DEVELOPERS, PROJECT_CONTACT } from "../constants.js";

/**
 * Who built this and where to reach them, on the front page.
 *
 * It used to be a two-column block with its own headings and a bulleted list —
 * a page section for something nobody arrives here to read. This keeps what the
 * block was actually saying (each person's role, and what the address is for)
 * and drops only the scaffolding: the headings, the bullets, the separate
 * credit rule. Two thin rows instead of a panel.
 *
 * The names, roles and address live in constants.js, so they are edited in one
 * place rather than in the markup.
 */
export default function SiteFooter() {
  const people = DEVELOPERS.filter(d => d.name);

  // Below `sm` the parts stack, and the separators go with them: a wrapped row
  // otherwise drops a "·" at the start of a line with nothing before it.
  const row = "flex flex-col sm:flex-row flex-wrap items-center justify-center gap-x-2 gap-y-0.5";
  const dot = <span aria-hidden="true" className="hidden sm:inline">·</span>;

  return (
    <footer className="relative z-10 mt-auto border-t border-on-backdrop/10 pb-safe">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-3
                      text-xs leading-relaxed text-on-backdrop/45 text-center">
        {people.length > 0 && (
          <ul className={row}>
            {people.map((dev, i) => (
              <li key={dev.name} className={row}>
                {i > 0 && dot}
                <span>
                  <span className="text-on-backdrop/70">{dev.name}</span>
                  {dev.role && <span> — {dev.role}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className={`${row} ${people.length > 0 ? "mt-1" : ""}`}>
          <span>URS College of Engineering · Faculty Consultation System</span>
          {PROJECT_CONTACT && (
            <>
              {dot}
              {/* What the address is for, so nobody has to guess whether it is
                  the right place for a broken sign-in. */}
              <span>
                Problems or questions:{" "}
                <a
                  href={`mailto:${PROJECT_CONTACT}`}
                  className="text-on-backdrop/70 hover:text-on-backdrop underline
                             underline-offset-2 decoration-on-backdrop/25 transition-colors"
                >
                  {PROJECT_CONTACT}
                </a>
              </span>
            </>
          )}
        </p>
      </div>
    </footer>
  );
}
