import { describe, expect, it } from "vitest";

import { AUDIENCES, FAQ, STARTERS, askNavi, audienceForPath } from "../ui/navi-faq.js";

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

describe("new entries stealing old questions", () => {
  /**
   * Every one of these was a real regression, caught by hand after the
   * troubleshooting and etiquette entries went in. A vague multi-word keyword
   * is the failure mode: "change my" belonged to nothing in particular and
   * took "how do I change my PIN" off the entry that answers it.
   */
  it("keeps PIN questions on the PIN entries", () => {
    expect(top("how do i change my pin")).toBe("account-change-pin");
    expect(top("i forgot my pin")).toBe("signin-forgot-pin");
    expect(top("how many digits is my pin")).toBe("signin-pin-rules");
  });

  it("keeps the wrong-details entry to wrong details", () => {
    expect(top("my department is wrong")).toBe("trouble-wrong-details");
    expect(top("my course is incorrect on my account")).toBe("trouble-wrong-details");
  });

  it("does not let 'forgot' pull a no-show answer", () => {
    // "forgot" alone is a forgotten PIN; forgetting to turn up is said
    // differently, and conflating them answers the wrong question entirely.
    expect(top("i forgot my pin")).not.toBe("rules-no-show");
    expect(top("i forgot to come to my consultation")).toBe("rules-no-show");
  });

  it("answers the new topics it was given", () => {
    expect(top("who can see what i wrote")).toBe("privacy-who-sees");
    expect(top("what if i cannot make it")).toBe("rules-no-show");
    expect(top("how early should i arrive")).toBe("rules-arrive");
    expect(top("the page is stuck loading")).toBe("trouble-stuck");
    expect(top("can we book as a group")).toBe("rules-group");
  });
});

describe("the page the reader is on", () => {
  it("settles which audience a shared question belongs to", () => {
    // "How do I sign in?" has three right answers. The screen they are looking
    // at is better evidence of which one they meant than the words are.
    expect(askNavi("how do i sign in", { pathname: "/teacher" })[0].audience).toBe("teacher");
    expect(askNavi("how do i sign in", { pathname: "/student" })[0].audience).toBe("student");
    expect(askNavi("how do i sign in", { pathname: "/dean" })[0].audience).toBe("dean");
  });

  it("is a nudge, not an override", () => {
    // A professor on their own dashboard asking a plainly student question
    // still gets the student answer; context breaks ties, it does not outrank
    // a strong match from elsewhere.
    expect(askNavi("how do i register as a student", { pathname: "/teacher/dashboard" })[0].id)
      .toBe("account-register");
  });

  it("changes nothing when the path says nothing", () => {
    expect(askNavi("how do i cancel my request", { pathname: "/" })[0].id).toBe("book-cancel");
    expect(askNavi("how do i cancel my request")[0].id).toBe("book-cancel");
  });
});

describe("audienceForPath", () => {
  it("reads the route", () => {
    expect(audienceForPath("/teacher/dashboard")).toBe("teacher");
    expect(audienceForPath("/student/register")).toBe("student");
    expect(audienceForPath("/dean")).toBe("dean");
    expect(audienceForPath("/availability")).toBeNull();
    expect(audienceForPath("/")).toBeNull();
    expect(audienceForPath()).toBeNull();
  });
});
