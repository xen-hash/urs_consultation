import { describe, expect, it } from "vitest";

import { countAvailable } from "../ui/useLiveAvailability.js";

/**
 * The front page now states a number about whether staff are at their desks.
 *
 * That makes this arithmetic a claim about real people rather than a bit of
 * chrome, so it is worth pinning: an over-count sends a student across campus
 * to a locked door, and an under-count stops them going at all.
 *
 * The board's payload is departments-of-professors, and only the exact status
 * string "Available" counts. Everything else — "Unavailable", "On Leave",
 * "In Meeting", and a professor who has used up the day's slots, whom the
 * backend already downgrades to "Unavailable" — is not free.
 */

const board = [
  {
    department: "Computer Engineering Department",
    professors: [
      { name: "A", status: "Available" },
      { name: "B", status: "Unavailable" },
      { name: "C", status: "In Meeting" },
    ],
  },
  {
    department: "Civil Engineering Department",
    professors: [
      { name: "D", status: "Available" },
      { name: "E", status: "On Leave" },
    ],
  },
];

describe("countAvailable", () => {
  it("counts only professors marked Available, across departments", () => {
    expect(countAvailable(board)).toEqual({ available: 2, total: 5 });
  });

  it("does not count the other statuses as free", () => {
    const none = [{ professors: [
      { status: "Unavailable" }, { status: "On Leave" }, { status: "In Meeting" },
    ] }];
    expect(countAvailable(none)).toEqual({ available: 0, total: 3 });
  });

  it("is exact about the status string", () => {
    // Not a case-insensitive or partial match: "Not Available" contains
    // "Available" and must not be counted as somebody free.
    const tricky = [{ professors: [
      { status: "Not Available" }, { status: "available" }, { status: "AVAILABLE" },
    ] }];
    expect(countAvailable(tricky).available).toBe(0);
  });

  it("survives a payload that is not the shape it expects", () => {
    // The landing page must render even when the API answers oddly; a throw
    // here takes the whole front page down with it.
    expect(countAvailable([])).toEqual({ available: 0, total: 0 });
    expect(countAvailable(null)).toEqual({ available: 0, total: 0 });
    expect(countAvailable(undefined)).toEqual({ available: 0, total: 0 });
    expect(countAvailable([{}])).toEqual({ available: 0, total: 0 });
    expect(countAvailable([{ professors: null }])).toEqual({ available: 0, total: 0 });
    expect(countAvailable([{ professors: [null] }])).toEqual({ available: 0, total: 1 });
  });
});
