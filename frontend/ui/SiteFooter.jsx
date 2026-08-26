import { Mail } from "lucide-react";
import { DEVELOPERS, PROJECT_CONTACT } from "../constants.js";

/**
 * Who built this, on the public screens.
 *
 * Signed-in dashboards deliberately do not carry it: someone triaging
 * consultation requests does not need the credits, and a footer on a dense
 * scrolling screen is one more thing between them and the bottom of the list.
 *
 * The names and the address live in constants.js, so they are edited in one
 * place rather than in the markup of every page that shows them.
 */
export default function SiteFooter({ tone = "backdrop" }) {
  const people = DEVELOPERS.filter(d => d.name);

  // Most public screens sit on the campus backdrop, where text is white. The
  // administrator sign-in is a light page, and white on it is invisible.
  const t = tone === "light"
    ? { rule: "border-border", head: "text-subtle-fg", body: "text-fg",
        soft: "text-muted-fg", link: "text-brand hover:text-brand-700",
        decoration: "decoration-brand/30", faint: "text-subtle-fg" }
    : { rule: "border-on-backdrop/10", head: "text-on-backdrop/45", body: "text-on-backdrop/85",
        soft: "text-on-backdrop/55", link: "text-on-backdrop/85 hover:text-on-backdrop",
        decoration: "decoration-on-backdrop/30", faint: "text-on-backdrop/40" };

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
