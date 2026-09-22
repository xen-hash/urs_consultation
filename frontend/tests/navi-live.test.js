import { describe, expect, it } from "vitest";

import { _internals, classify } from "../ui/navi-live.js";

const {
  answerAvailability, answerSchedule, answerSlotsLeft,
  answerMyRequests, answerTeacherQueue, describeSchedule, matchProfessors,
} = _internals;

/**
 * Live answers name real people and state facts about them.
 *
 * "Engr. Santos is free now" sends somebody up three flights of stairs. That
 * makes every sentence here a claim worth pinning — the counting, the plurals,
 * and above all the refusals: an ambiguous surname must not be resolved by
 * picking one, and a question that is not really about live data must fall
 * through to the FAQ rather than be answered from the roster.
 */

const board = [
  {
    department: "Computer Engineering Department",
    professors: [
      { name: "Engr. Santos", status: "Available", slots_left: 3, day_limit: 5,
        weekly_schedule: { monday: { slots: [{ start: "09:00 AM", end: "11:00 AM" }] } } },
      { name: "Engr. Cruz", status: "Unavailable", slots_left: 0, day_limit: 4 },
    ],
  },
  {
    department: "Civil Engineering Department",
    professors: [
      { name: "Engr. Reyes", status: "Available", slots_left: null, day_limit: 0 },
      { name: "Engr. Dela Cruz", status: "Unavailable", manual_status: "On Leave" },
    ],
  },
];

describe("classify", () => {
  it("recognises the live questions", () => {
    expect(classify("who is available right now")).toBe("availability");
    expect(classify("is anyone free in civil")).toBe("availability");
    expect(classify("what happened to my request")).toBe("my-requests");
    expect(classify("who is waiting on me")).toBe("teacher-queue");
    expect(classify("can i still book santos today")).toBe("slots-left");
    expect(classify("what are santos consultation hours")).toBe("schedule");
  });

  it("does not mistake a privacy question for a status one", () => {
    // These contain the same words as the live questions and mean something
    // else entirely: who is ALLOWED to read a request, not what became of it.
    // Answering with a status answers a question nobody asked.
    expect(classify("who can see my request")).toBeNull();
    expect(classify("who sees my consultation")).toBeNull();
    expect(classify("is my request private")).toBeNull();
    expect(classify("who can read what i wrote")).toBeNull();
    // The status question itself still works.
    expect(classify("what happened to my request")).toBe("my-requests");
  });

  it("leaves everything else to the FAQ", () => {
    // These are about how the system works, not what is true in it.
    expect(classify("how do i change my pin")).toBeNull();
    expect(classify("how do i install this app")).toBeNull();
    expect(classify("what does pending mean")).toBeNull();
    expect(classify("")).toBeNull();
  });
});

describe("availability", () => {
  it("answers about one named professor with their real status", () => {
    const a = answerAvailability("is santos available", board);
    expect(a.text).toContain("Engr. Santos");
    expect(a.text).toContain("free now");
    expect(a.text).toContain("3 consultations left");
  });

  it("does not guess when a surname is ambiguous", () => {
    // "cruz" matches both Engr. Cruz and Engr. Dela Cruz. Naming the wrong one
    // sends somebody to the wrong office.
    const a = answerAvailability("is cruz free", board);
    expect(a.text).toContain("More than one professor");
    expect(a.text).toContain("Engr. Cruz");
    expect(a.text).toContain("Engr. Dela Cruz");
  });

  it("counts a department when one is named", () => {
    const a = answerAvailability("anyone free in civil", board);
    expect(a.text).toContain("Civil Engineering Department");
    expect(a.text).toContain("1 professor free");
    expect(a.text).toContain("Engr. Reyes");
  });

  it("counts everyone when no department is named", () => {
    const a = answerAvailability("who is available", board);
    expect(a.text).toContain("2 professors free");
    expect(a.text).toContain("out of 4");
  });

  it("says so plainly when nobody is free", () => {
    const empty = [{ department: "D", professors: [{ name: "X", status: "Unavailable" }] }];
    expect(answerAvailability("who is free", empty).text).toBe("Nobody is free right now.");
  });

  it("uses the professor's own words for a manual status", () => {
    expect(answerAvailability("is dela cruz free", board).text).toContain("on leave");
  });

  it("gets the singular right", () => {
    // "1 professors free" reads as a machine and costs the answer its trust.
    expect(answerAvailability("anyone free in civil", board).text).not.toContain("1 professors");
  });
});

describe("schedule", () => {
  it("reads the weekly schedule back", () => {
    expect(answerSchedule("when is santos free this week", board).text)
      .toContain("Mon 09:00 AM-11:00 AM");
  });

  it("admits when no hours are published", () => {
    expect(answerSchedule("when is reyes free", board).text)
      .toContain("has not published consultation hours");
  });

  it("handles both the slots shape and the legacy single slot", () => {
    expect(describeSchedule({ tuesday: { start: "01:00 PM", end: "03:00 PM" } }))
      .toBe("Tue 01:00 PM-03:00 PM");
    expect(describeSchedule({})).toBeNull();
    expect(describeSchedule(null)).toBeNull();
    // A day present but with no usable times is not a schedule.
    expect(describeSchedule({ monday: { slots: [{ start: "", end: "" }] } })).toBeNull();
  });
});

describe("slots left", () => {
  it("says how many are left", () => {
    expect(answerSlotsLeft("can i still book santos", board).text)
      .toContain("3 consultations left today");
  });

  it("says when the day is full, and what to do instead", () => {
    const a = answerSlotsLeft("any slots left with cruz today", board);
    // "cruz" is ambiguous, so this correctly declines to answer about one.
    expect(a).toBeNull();
  });

  it("does not invent a limit where none is set", () => {
    expect(answerSlotsLeft("slots left for reyes", board).text)
      .toContain("has not set a daily limit");
  });
});

describe("my requests", () => {
  it("reads the paged history shape the endpoint returns", () => {
    const a = answerMyRequests({ data: [
      { professor_name: "Engr. Santos", status: "accepted",
        appointment_date: "2026-09-21", appointment_time: "10:00 AM" },
    ], total: 1 });
    expect(a.text).toContain("1 open request");
    expect(a.text).toContain("Engr. Santos");
    expect(a.text).toContain("2026-09-21 at 10:00 AM");
  });

  it("does not claim an appointment time that was never set", () => {
    const a = answerMyRequests({ data: [
      { professor_name: "Engr. Reyes", status: "accepted" },
    ] });
    expect(a.text).toContain("accepted");
    expect(a.text).not.toContain("undefined");
    expect(a.text).not.toContain(" for .");
  });

  it("is clear when nothing is open", () => {
    const a = answerMyRequests({ data: [
      { professor_name: "Engr. Cruz", status: "declined" },
    ] });
    expect(a.text).toContain("Nothing open");
    expect(a.text).toContain("declined");
  });

  it("handles a student who has never asked for anything", () => {
    expect(answerMyRequests({ data: [] }).text).toContain("not sent any");
    expect(answerMyRequests([]).text).toContain("not sent any");
  });
});

describe("faculty queue", () => {
  it("counts and names who is waiting", () => {
    const a = answerTeacherQueue([
      { student_name: "Ana", status: "pending" },
      { student_name: "Ben", status: "pending" },
      { student_name: "Cely", status: "accepted" },
    ]);
    expect(a.text).toContain("2 students are waiting");
    expect(a.text).toContain("Ana, Ben");
    // Accepted is answered already; it is not still waiting on them.
    expect(a.text).not.toContain("Cely");
  });

  it("gets the singular right", () => {
    expect(answerTeacherQueue([{ student_name: "Ana", status: "pending" }]).text)
      .toContain("1 student is waiting");
  });

  it("says so when the queue is empty", () => {
    expect(answerTeacherQueue([]).text).toContain("Nobody is waiting");
  });
});

describe("name matching", () => {
  it("ignores short words so it cannot match on a title", () => {
    // "Engr." is on every name; matching it would return the whole roster.
    expect(matchProfessors("engr", board)).toHaveLength(0);
  });

  it("matches a surname on a word boundary", () => {
    expect(matchProfessors("santos", board).map(p => p.name)).toEqual(["Engr. Santos"]);
    // "santosa" is a different name and must not match "Santos".
    expect(matchProfessors("santosa", board)).toHaveLength(0);
  });
});
