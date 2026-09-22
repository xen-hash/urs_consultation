import { describe, expect, it } from "vitest";

import {
  formatAgo,
  formatDate,
  formatDuration,
  formatTime,
  parseWhen,
} from "../ui/datetime.js";

/**
 * These pin the Manila timezone behaviour. The device clock in CI is UTC, so a
 * formatter that leaked the local timezone would show 6am for a 2pm
 * consultation — which is exactly the bug the module exists to prevent, and
 * which passes unnoticed on a laptop already set to Manila.
 */
describe("parseWhen", () => {
  it("reads an ISO string carrying the +08:00 offset", () => {
    expect(parseWhen("2026-08-26T14:41:00+08:00").toISOString())
      .toBe("2026-08-26T06:41:00.000Z");
  });

  it("treats a bare timestamp as Manila, not as UTC", () => {
    // An older backend build serving a newer frontend still sends these, and
    // the app clock is Manila.
    expect(parseWhen("2026-08-26 14:41:00").toISOString())
      .toBe("2026-08-26T06:41:00.000Z");
  });

  it("accepts a bare timestamp without seconds", () => {
    expect(parseWhen("2026-08-26 14:41")).not.toBeNull();
  });

  it("passes a Date through", () => {
    const d = new Date("2026-08-26T00:00:00Z");
    expect(parseWhen(d)).toBe(d);
  });

  it.each([null, undefined, "", "not a date", new Date("nonsense")])(
    "returns null for %s", (value) => {
      expect(parseWhen(value)).toBeNull();
    },
  );
});

describe("formatters", () => {
  it("renders a UTC instant against the Manila clock", () => {
    // 06:41 UTC is 14:41 in Manila.
    expect(formatTime("2026-08-26T06:41:00Z")).toMatch(/2:41/);
  });

  it("renders the Manila date, which can differ from the UTC date", () => {
    // 20:00 UTC on the 25th is already the 26th in Manila.
    expect(formatDate("2026-08-25T20:00:00Z")).toMatch(/26/);
  });

  it("falls back rather than printing Invalid Date", () => {
    expect(formatTime(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });

  it("honours a caller's fallback", () => {
    expect(formatTime(null, "not set")).toBe("not set");
  });
});

describe("formatAgo", () => {
  const now = new Date("2026-08-26T06:41:00Z").getTime();
  const ago = (seconds) => formatAgo(new Date(now - seconds * 1000), now);

  it("says just now inside 45 seconds", () => {
    expect(ago(10)).toBe("just now");
  });

  it("counts minutes", () => {
    expect(ago(6 * 60)).toBe("6m ago");
  });

  it("counts hours", () => {
    expect(ago(3 * 3600)).toBe("3h ago");
  });

  it("gives up and shows a date past a day", () => {
    expect(ago(50 * 3600)).not.toMatch(/ago/);
  });

  it("does not claim the future when the clock is skewed", () => {
    expect(formatAgo(new Date(now + 60_000), now)).not.toMatch(/ago/);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0m"],
    [48, "48m"],
    [60, "1h 00m"],
    [125, "2h 05m"],
  ])("renders %i minutes as %s", (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });

  it("clamps a negative span rather than rendering a minus sign", () => {
    expect(formatDuration(-5)).toBe("0m");
  });

  it("treats junk as zero", () => {
    expect(formatDuration("abc")).toBe("0m");
  });
});
