import { describe, expect, it } from "vitest";

import { normalizeSchedule } from "../ScheduleModal.jsx";
import { DAYS } from "../constants.js";

/**
 * normalizeSchedule is what the weekly editor seeds itself from, so it decides
 * what a teacher sees before they touch anything — and, since the editor saves
 * what it is showing, what gets written back.
 */
describe("normalizeSchedule", () => {
  it("fills in every weekday when given nothing", () => {
    const result = normalizeSchedule(null);
    expect(Object.keys(result).sort()).toEqual([...DAYS].sort());
  });

  it("keeps a stored multi-slot day intact", () => {
    const stored = {
      monday: {
        unavailable: false,
        limit: 7,
        slots: [
          { start: "09:00 AM", end: "11:30 AM" },
          { start: "01:00 PM", end: "03:00 PM" },
        ],
      },
    };
    expect(normalizeSchedule(stored).monday).toEqual(stored.monday);
  });

  it("migrates the legacy single-slot shape", () => {
    // Rows written before multi-slot schedules carry start/end on the day.
    const result = normalizeSchedule({
      tuesday: { start: "08:00 AM", end: "10:00 AM", unavailable: false },
    });
    expect(result.tuesday.slots).toEqual([{ start: "08:00 AM", end: "10:00 AM" }]);
  });

  it("supplies an end time a legacy row omitted", () => {
    expect(normalizeSchedule({ tuesday: { start: "08:00 AM" } }).tuesday.slots[0].end)
      .toBe("05:00 PM");
  });

  it("preserves a day marked unavailable", () => {
    expect(normalizeSchedule({ wednesday: { unavailable: true } }).wednesday.unavailable)
      .toBe(true);
  });

  it("never leaves a day with an empty slot list", () => {
    // The editor renders slots[0] unconditionally, so an empty array is a crash.
    const result = normalizeSchedule({ thursday: { unavailable: false, slots: [] } });
    expect(result.thursday.slots.length).toBeGreaterThan(0);
  });

  it("defaults a missing limit to zero rather than undefined", () => {
    // 0 means "no cap of my own"; undefined would reach the number input.
    expect(normalizeSchedule({ friday: { slots: [] } }).friday.limit).toBe(0);
  });

  it("leaves untouched days at their defaults", () => {
    const result = normalizeSchedule({ monday: { unavailable: true } });
    expect(result.sunday.unavailable).toBe(false);
    expect(result.sunday.slots).toHaveLength(1);
  });

  it.each([undefined, "text", 42, []])("survives %s", (junk) => {
    expect(Object.keys(normalizeSchedule(junk))).toHaveLength(DAYS.length);
  });
});
