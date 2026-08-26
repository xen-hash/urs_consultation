import { Mail } from "lucide-react";
import { DEVELOPERS, PROJECT_CONTACT } from "../constants.js";

/**
 * Who built this, on the public screens.
 *
 * The front page only. It used to sit on every public screen, which put the
 * credits under people who were mid sign-in and had not asked who wrote this.
 * Someone curious about that is on the front page; someone typing a PIN is not.
 *
 * The names and the address live in constants.js, so they are edited in one
 * place rather than in the markup of every page that shows them.
 */
export default function SiteFooter() {
  const people = DEVELOPERS.filter(d => d.name);

  // The front page sits on the campus backdrop, so the text here is white
  // rather than the dark-on-light the rest of the tokens are tuned for.
  const t = {
    rule: "border-on-backdrop/10", head: "text-on-backdrop/45", body: "text-on-backdrop/85",
    soft: "text-on-backdrop/55", link: "text-on-backdrop/85 hover:text-on-backdrop",
    decoration: "decoration-on-backdrop/30", faint: "text-on-backdrop/40",
  };

  return (
    <footer className={`relative z-10 mt-auto border-t ${t.rule} pb-safe`}>
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="min-w-0">
            <h2 className={`text-xs font-semibold uppercase tracking-widest ${t.head}`}>
              About the developers
            </h2>

            {people.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {people.map(dev => (
                  <li key={dev.name} className={`text-sm ${t.body}`}>
                    <span className="font-semibold">{dev.name}</span>
                    {dev.role && (
                      <span className={t.soft}> — {dev.role}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`mt-3 text-sm ${t.soft}`}>
                Built for the URS College of Engineering.
              </p>
            )}
          </div>

          {PROJECT_CONTACT && (
            <div className="sm:text-right shrink-0">
              <h2 className={`text-xs font-semibold uppercase tracking-widest ${t.head}`}>
                Get in touch
              </h2>
              <a
                href={`mailto:${PROJECT_CONTACT}`}
                className={`mt-3 inline-flex items-center gap-2 text-sm font-medium
                           ${t.link} ${t.decoration} transition-colors
                           underline underline-offset-4`}
              >
                <Mail size={15} aria-hidden="true" />
                {PROJECT_CONTACT}
              </a>
              <p className={`text-xs ${t.head} mt-2 sm:max-w-[24ch] sm:ml-auto`}>
                For problems with the system or questions about the project.
              </p>
            </div>
          )}
        </div>

        <p className={`text-xs ${t.faint} mt-7 pt-5 border-t ${t.rule}`}>
          URS College of Engineering · Faculty Consultation System
        </p>
      </div>
    </footer>
  );
}
