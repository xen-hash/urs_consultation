/**
 * Getting a new deploy onto screens that are already open.
 *
 * The service worker is registered with `autoUpdate`, which means a new build
 * is fetched and activated without anybody tapping anything. What that does
 * *not* do is change the page already running: the tab keeps executing the
 * bundle it loaded, and only picks up the new one whenever it is next opened
 * from cold. On a phone with the app on the home screen that can be days —
 * the window is resumed, not reloaded.
 *
 * So two things have to happen that the plugin does not do on its own:
 *
 *   1. Ask whether there is a new build, often enough to matter. A timer alone
 *      is not enough, because a backgrounded PWA has its timers throttled or
 *      frozen; the check that counts is the one on the way back to the
 *      foreground.
 *   2. Reload the page once the new worker takes over.
 *
 * The one thing worth protecting against is reloading somebody mid-sentence.
 * A student writing out why they need a consultation loses the lot, and it
 * looks like the app crashed rather than updated. So a reload waits — but only
 * while they are actually typing something, and it goes ahead the moment they
 * stop, move on, or put the phone down.
 */

/** How often to ask the server whether sw.js has changed. */
export const UPDATE_INTERVAL_MS = 15 * 60 * 1000;

/** How often to re-check whether it has become safe to reload. */
export const SAFETY_POLL_MS = 3000;

const TYPELESS_INPUTS = new Set([
  "button", "submit", "reset", "image", "checkbox", "radio", "range", "file",
  "color", "hidden",
]);

/**
 * Is the reader part-way through writing something?
 *
 * Only the focused field counts. A form someone filled and walked away from is
 * not protected, and should not be: the reload is what gets them a working app
 * back, and anything genuinely valuable has been sent by then.
 */
export function hasUnsavedTyping(doc = globalThis.document) {
  const el = doc?.activeElement;
  if (!el) return false;

  if (el.tagName === "TEXTAREA") return Boolean(el.value?.trim());

  if (el.tagName === "INPUT") {
    const type = String(el.type || "text").toLowerCase();
    // A focused checkbox or Send button is not work in progress.
    if (TYPELESS_INPUTS.has(type)) return false;
    return Boolean(el.value?.trim());
  }

  if (el.isContentEditable) return Boolean(el.textContent?.trim());

  return false;
}

/**
 * Whether the page should reload right now.
 *
 * Hidden wins over everything: if the app is in the background there is no
 * typing to interrupt and no flash to see, which makes it the best possible
 * moment to swap the bundle over.
 */
export function canReloadNow(doc = globalThis.document) {
  if (doc?.visibilityState === "hidden") return true;
  return !hasUnsavedTyping(doc);
}
