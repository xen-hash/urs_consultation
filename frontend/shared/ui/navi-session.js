/**
 * How long Navi's panel remembers what was asked.
 *
 * The panel is mounted above the router and never unmounts, so without a
 * policy the transcript is a single unbroken list from the moment the tab was
 * opened. Six questions in, the answer somebody is reading is a thumb-scroll
 * above the box they are typing into, and the panel reads as a backlog rather
 * than a help window.
 *
 * Two rules, and they solve different halves of that:
 *
 *   - A cap, so one sitting cannot grow without limit.
 *   - A reset after a gap, so coming back later starts clean.
 *
 * The gap matters more than it looks. Clearing on every close would throw away
 * the answer somebody just closed the panel to go and act on — they shut it to
 * look at the screen behind, and reopening to an empty box loses the thing
 * they were checking against. A few minutes is long enough to mean "that was a
 * different question".
 */

/** Questions kept on screen at once. */
export const TURN_LIMIT = 6;

/** How long a closed panel keeps its conversation. */
export const STALE_MS = 3 * 60 * 1000;

/**
 * The turns worth keeping, newest last.
 *
 * Trims from the front: the oldest question is the one least likely to still
 * be wanted, and the newest has to stay because it is the one being read.
 */
export function trimTurns(turns, limit = TURN_LIMIT) {
  if (!Array.isArray(turns)) return [];
  return limit > 0 && turns.length > limit ? turns.slice(-limit) : turns;
}

/**
 * Whether reopening the panel should start a fresh conversation.
 *
 * `lastActivityAt` is when the reader last asked something or closed the
 * panel. Never having used it is not staleness — there is nothing to clear —
 * so that answers false.
 */
export function shouldReset(lastActivityAt, now = Date.now(), staleMs = STALE_MS) {
  if (!lastActivityAt) return false;
  return now - lastActivityAt >= staleMs;
}
