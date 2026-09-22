/**
 * Light, dark, or whatever the device is set to.
 *
 * Three states rather than two. A plain on/off switch has to pick a side the
 * first time someone arrives, and picking wrong means a phone in night mode
 * opening a white screen at 11pm. "System" is the default: the browser already
 * knows, via prefers-color-scheme, and it follows the phone flipping to dark on
 * schedule without anyone touching anything. The two explicit choices are for
 * people who want to override that.
 *
 * The choice is per-device and stored in localStorage, not on the account: it
 * describes the screen you are looking at, not who you are. A professor on a
 * bright office monitor and the same professor on a phone in a dark corridor
 * want different answers.
 */

const KEY = "urs.theme";
export const THEMES = ["system", "light", "dark"];

export function readTheme() {
  try {
    const stored = localStorage.getItem(KEY);
    return THEMES.includes(stored) ? stored : "system";
  } catch {
    return "system";   // storage blocked — follow the device.
  }
}

/** What `system` currently resolves to. */
export function systemPrefersDark() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function resolveTheme(theme) {
  return theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
}

/**
 * Write the choice onto <html>, where the CSS is waiting for it.
 *
 * `system` deliberately removes the attribute rather than stamping the resolved
 * value: the stylesheet's media query then does the work, so a device switching
 * to night mode while the page is open re-themes it with no JavaScript involved.
 */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") root.setAttribute("data-theme", theme);
  else root.removeAttribute("data-theme");

  // Native controls — scrollbars, form widgets, the URL bar on some browsers —
  // read this rather than our tokens, and look wrong if left behind.
  root.style.colorScheme = theme === "system" ? "light dark" : theme;
}

export function setTheme(theme) {
  const next = THEMES.includes(theme) ? theme : "system";
  try { localStorage.setItem(KEY, next); } catch { /* not fatal */ }
  applyTheme(next);
  // Same tab gets no storage event, so tell it directly. Several headers can be
  // mounted at once (a dashboard and a modal), and all of them should agree.
  window.dispatchEvent(new CustomEvent("urs:themechange", { detail: next }));
  return next;
}
