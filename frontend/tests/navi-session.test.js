import { describe, expect, it } from "vitest";

import { STALE_MS, TURN_LIMIT, shouldReset, trimTurns } from "../ui/navi-session.js";

/**
 * When the help panel forgets.
 *
 * Both halves are easy to get subtly wrong in a way nobody notices until it
 * annoys somebody: trimming from the wrong end drops the answer being read,
 * and resetting on every close throws away the answer somebody shut the panel
 * to go and act on.
 */

const turns = n => Array.from({ length: n }, (_, i) => ({ id: i }));

describe("trimTurns", () => {
  it("keeps the newest, which is the one being read", () => {
    const kept = trimTurns(turns(10), 3);
    expect(kept.map(t => t.id)).toEqual([7, 8, 9]);
  });

  it("leaves a short conversation alone", () => {
    expect(trimTurns(turns(3), 6)).toHaveLength(3);
    expect(trimTurns(turns(6), 6)).toHaveLength(6);
  });

  it("caps at the limit the panel actually uses", () => {
    expect(trimTurns(turns(20))).toHaveLength(TURN_LIMIT);
  });

  it("survives being handed nothing", () => {
    expect(trimTurns([])).toEqual([]);
    expect(trimTurns(null)).toEqual([]);
    expect(trimTurns(undefined)).toEqual([]);
  });
});

describe("shouldReset", () => {
  const now = 1_000_000;

  it("starts fresh after a gap", () => {
    expect(shouldReset(now - STALE_MS - 1, now)).toBe(true);
  });

  it("keeps the conversation across a quick look at the page behind", () => {
    // Closing the panel to check something and reopening a few seconds later
    // must not wipe the answer that was just given.
    expect(shouldReset(now - 5_000, now)).toBe(false);
    expect(shouldReset(now - 60_000, now)).toBe(false);
  });

  it("has nothing to clear on a first ever open", () => {
    expect(shouldReset(0, now)).toBe(false);
    expect(shouldReset(null, now)).toBe(false);
    expect(shouldReset(undefined, now)).toBe(false);
  });

  it("treats the boundary as stale", () => {
    expect(shouldReset(now - STALE_MS, now)).toBe(true);
  });
});
