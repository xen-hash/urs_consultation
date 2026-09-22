/**
 * Times, in the timezone the campus is actually in.
 *
 * Every timestamp now arrives from the API as ISO 8601 with the +08:00 offset,
 * so the instant is unambiguous. What is left is the choice of which clock to
 * render it against, and `toLocaleString` with no timezone renders against the
 * *device's* — which is right for a phone in Binangonan and wrong for a laptop
 * whose timezone was never changed from the factory default, an admin abroad,
 * or a browser that guessed. A consultation at 2pm is at 2pm in Manila for
 * everyone reading the screen, so the timezone is pinned rather than inferred.
 *
 * The parser tolerates a bare "YYYY-MM-DD HH:MM:SS" as well, because an older
 * backend build serving a newer frontend during a deploy will still send them,
 * and a value with no offset came from the app clock, which is Manila.
 */

export const PH_TZ = "Asia/Manila";

const NAKED = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;

/** A Date, or null if the value is missing or unparseable. */
export function parseWhen(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value) ? null : value;
  const text = String(value).trim();
  const iso = NAKED.test(text) ? `${text.replace(" ", "T")}+08:00` : text;
  const date = new Date(iso);
  return isNaN(date) ? null : date;
}

function format(value, options, fallback = "—") {
  const date = parseWhen(value);
  if (!date) return fallback;
  return date.toLocaleString("en-PH", { timeZone: PH_TZ, ...options });
}

/** "26 Aug, 2:41 PM" — the list workhorse. */
export const formatWhen = (value, fallback = "\u2014") =>
  format(value, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }, fallback);

/** "26 Aug 2026, 2:41 PM" — when the year matters. */
export const formatDateTime = (value, fallback = "\u2014") =>
  format(value, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }, fallback);

/** "2:41 PM" */
export const formatTime = (value, fallback = "\u2014") =>
  format(value, { hour: "numeric", minute: "2-digit" }, fallback);

/** "26 Aug 2026" */
export const formatDate = (value, fallback = "\u2014") =>
  format(value, { day: "numeric", month: "short", year: "numeric" }, fallback);

/**
 * "just now" / "6m ago" / "3h ago", falling back to a date past a day.
 *
 * For lists where the age is the point — who is online, what just happened —
 * and an exact clock time makes the reader do the subtraction themselves.
 */
export function formatAgo(value, now = Date.now()) {
  const date = parseWhen(value);
  if (!date) return "—";
  const seconds = Math.round((now - date.getTime()) / 1000);
  if (seconds < 0) return formatWhen(value);      // clock skew; do not say "in the future".
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatWhen(value);
}

/** "48m" / "2h 05m" — an elapsed span, not a point in time. */
export function formatDuration(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
