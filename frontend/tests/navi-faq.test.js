import { describe, expect, it } from "vitest";

import { AUDIENCES, FAQ, STARTERS, askNavi } from "../ui/navi-faq.js";

/**
 * These pin the matcher against the way the questions actually arrive.
 *
 * Navi has no model behind it, so every wrong answer traces back to a keyword
 * list somebody edited. The risk is not that matching breaks loudly — it is
 * that adding one entry quietly steals another's questions, and nobody notices
 * because the panel still answers something.
 *
 * The phrasings below are deliberately not the entries' own wording: a matcher
 * that only recognises its own questions back is no matcher at all.
 */

/** The entry Navi answers with, or undefined when it admits it does not know. */
const top = q => askNavi(q)[0]?.id;

describe("askNavi", () => {
  it("answers the question it was written for, however it is phrased", () => {
    expect(top("how do i book a consultation")).toBe("book-request");
    expect(top("i forgot my pin")).toBe("signin-forgot-pin");
    expect(top("where do i see the reply")).toBe("status-where");
    expect(top("what does pending mean")).toBe("status-meaning");
    expect(top("how do i install this on my phone")).toBe("app-install");
    expect(top("how do i cancel my request")).toBe("book-cancel");
  });

  it("reads spoken phrasings, which arrive without punctuation", () => {
    // Dictation gives "log in" as two words and never a hyphen.
    expect(top("i cannot log in")).toBe("signin-student");
    expect(top("my teacher has not answered")).toBe("status-waiting");
    expect(top("can i make an appointment")).toBe("book-request");
  });

  it("keeps the student and faculty sides of a shared word apart", () => {
    // Both are about consultation hours. One is asking, one is setting.
    expect(askNavi("how do i set my consultation hours")[0].audience).toBe("teacher");
    expect(askNavi("is my professor free right now")[0].audience).toBe("student");
  });

  it("admits it does not know rather than guessing", () => {
    expect(askNavi("what is the tuition fee for next semester")).toEqual([]);
    expect(askNavi("who won the basketball game")).toEqual([]);
    expect(askNavi("")).toEqual([]);
    expect(askNavi("   ")).toEqual([]);
  });

  it("does not match on one incidental word of a long question", () => {
    // "the" and "a" carry no meaning, and a lone "app" in a long sentence
    // about something else should not drag the install answer up.
    expect(askNavi("i was walking to the app building and hurt my knee")).toEqual([]);
  });

  it("returns at most the limit asked for, strongest first", () => {
    const hits = askNavi("pin", { limit: 2 });
    expect(hits.length).toBeLessThanOrEqual(2);
    expect(hits.every(h => h.id)).toBe(true);
  });

  it("offers no alternatives when one answer is clearly the answer", () => {
    // Everything else carrying the word "consultation" used to be listed under
    // "did you mean", which reads as Navi hedging on a question it got right.
    expect(askNavi("how do i book a consultation")).toHaveLength(1);
    expect(askNavi("what do the availability statuses mean")).toHaveLength(1);
  });

  it("still offers alternatives when they are genuinely close", () => {
    // Forgetting, changing and resetting a PIN are three different answers and
    // the question does not say which one is wanted.
    const hits = askNavi("i forgot my pin").map(h => h.id);
    expect(hits[0]).toBe("signin-forgot-pin");
    expect(hits).toContain("account-change-pin");
  });
});

describe("the FAQ itself", () => {
  it("has no duplicate ids", () => {
    const ids = FAQ.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every entry an audience the panel can group under", () => {
    for (const entry of FAQ) {
      expect(Object.keys(AUDIENCES)).toContain(entry.audience);
    }
  });

  it("writes answers that can be read aloud", () => {
    for (const entry of FAQ) {
      // speechSynthesis reads markdown out as punctuation. So does a screen
      // reader. Neither is what anybody wants to hear.
      expect(entry.answer, entry.id).not.toMatch(/[*_#`]|\]\(/);
      expect(entry.answer.trim(), entry.id).not.toBe("");
      expect(entry.keywords.length, entry.id).toBeGreaterThan(2);
    }
  });

  it("sends every in-app link somewhere the router serves", () => {
    const routes = [
      "/", "/student", "/student/register", "/student/dashboard",
      "/teacher", "/teacher/dashboard", "/dean", "/dean/dashboard", "/availability",
    ];
    for (const entry of FAQ) {
      if (entry.go) expect(routes, entry.id).toContain(entry.go.to);
    }
  });

  it("offers starters that Navi can actually answer", () => {
    for (const starter of STARTERS) {
      expect(askNavi(starter).length, starter).toBeGreaterThan(0);
    }
  });
});
