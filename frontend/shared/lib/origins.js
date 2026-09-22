/**
 * Where the other two apps live.
 *
 * Student, faculty and administration are three deployments on three origins,
 * so a link from one to another is not a route — it leaves the app. Nothing in
 * a bundle can work out where its siblings are, so each deployment is told, and
 * this is the one place that reads the answer.
 *
 * The defaults are the development ports, which is what makes `npm run dev` in
 * three terminals behave like the real thing: the links between the apps work
 * without any environment set up at all. A deployment that forgets to set these
 * therefore points at localhost rather than at nothing — a broken link either
 * way, but one that says what is missing the moment it is clicked.
 */

/** The three apps, in the order the sign-in menus list them. */
export const APPS = ["student", "faculty", "admin"];

const DEV_PORTS = { student: 5173, faculty: 5174, admin: 5175 };

const CONFIGURED = {
  student: import.meta.env.VITE_STUDENT_URL,
  faculty: import.meta.env.VITE_FACULTY_URL,
  admin: import.meta.env.VITE_ADMIN_URL,
};

/**
 * Which app this bundle is. Set by the build (see shared/build/vite-app.js), so
 * it is a constant rather than something guessed from the URL — a faculty
 * bundle served from an unexpected host is still the faculty app.
 *
 * Undefined outside a build, which is the case under the unit tests; callers
 * that care pass the app in explicitly rather than relying on this.
 */
export const THIS_APP = import.meta.env.VITE_APP || null;

/** Trailing slashes make every later join produce "//", so they come off here. */
const trim = url => String(url || "").replace(/\/+$/, "");

/** The origin `app` is served from, with no trailing slash. */
export function originOf(app) {
  const configured = trim(CONFIGURED[app]);
  if (configured) return configured;
  return `http://localhost:${DEV_PORTS[app] || 5173}`;
}

/**
 * A URL for `path` inside `app`.
 *
 * Returns a plain path when `app` is this bundle's own, so the router handles
 * it and the page does not reload; an absolute URL otherwise. Callers treat the
 * two the same — see `isExternal` for the one place that cannot.
 */
export function urlFor(app, path = "/", { from = THIS_APP } = {}) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (from && app === from) return suffix;
  return `${originOf(app)}${suffix}`;
}

/** Whether a URL from `urlFor` leaves this app, and so needs a real navigation. */
export const isExternal = url => /^https?:\/\//i.test(String(url || ""));

/**
 * Say so, once, when a deployed app is still pointing at localhost.
 *
 * The failure this catches is a quiet one: every link between the apps still
 * renders, still looks right, and does nothing at all when a student taps it
 * from their phone. Nothing throws, so nothing reaches an error log — the only
 * symptom is somebody saying the faculty link is broken.
 *
 * Only on a real host, because localhost is where those defaults are correct.
 */
if (typeof window !== "undefined" && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) {
  const missing = APPS.filter(app => !trim(CONFIGURED[app]));
  if (missing.length) {
    const names = missing.map(app => `VITE_${app.toUpperCase()}_URL`).join(", ");
    console.warn(
      `[urs] ${names} ${missing.length === 1 ? "is" : "are"} not set, so links to ` +
      `the ${missing.join(" and ")} app${missing.length === 1 ? "" : "s"} point at ` +
      "localhost and will not work. Set them in this deployment's environment.",
    );
  }
}
