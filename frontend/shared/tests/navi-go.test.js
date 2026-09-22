import { describe, expect, it } from "vitest";

import { FAQ, STARTERS } from "../ui/navi-faq.js";
import {
  DESTINATIONS, matchDestination, navigationFor, tabsFor,
} from "../ui/navi-go.js";

/**
 * Two failures matter here and they pull in opposite directions.
 *
 * Not going is the visible one: somebody types "open the student login page"
 * and gets a paragraph about how signing in works.
 *
 * Going when nobody asked is the worse one, and it is silent. A question about
 * a screen would yank the reader off the screen they were reading, and the
 * only sign of it is that the app moved. So the second half of this file is
 * every question the FAQ is written to answer, asserted to move nobody.
 */

/**
 * The other two apps' dev addresses, written out rather than derived.
 *
 * Deriving them from origins.js would make these assertions agree with
 * whatever that file says, which is not a test of anything. What is worth
 * pinning is that a faculty screen named from the student app comes back as a
 * URL on the faculty origin — so the origin is spelled out here, and a change
 * to the dev ports has to be made in two places on purpose.
 *
 * The suite runs as the student app (see vitest.config.js), so student
 * destinations come back as bare paths.
 */
const FACULTY = "http://localhost:5174";
const ADMIN = "http://localhost:5175";

const to = (q, opts) => navigationFor(q, opts)?.to;

describe("navigationFor", () => {
  it("takes an instruction to the page it names", () => {
    expect(to("open the student login page")).toBe("/sign-in");
    expect(to("take me to the teacher login")).toBe(`${FACULTY}/`);
    expect(to("go to the availability board")).toBe("/availability");
    expect(to("open the dean's office")).toBe(`${ADMIN}/`);
    expect(to("take me home")).toBe("/");
    expect(to("i want to register")).toBe("/register");
  });

  it("reads the name of a screen on its own as an instruction", () => {
    // What people actually type into a box: the name, and nothing else.
    expect(to("student login page")).toBe("/sign-in");
    expect(to("faculty portal")).toBe(`${FACULTY}/`);
    expect(to("availability board")).toBe("/availability");
    expect(to("registration")).toBe("/register");
  });

  it("reads spoken phrasings, which arrive without punctuation", () => {
    expect(to("can you open the student sign in page please")).toBe("/sign-in");
    expect(to("bring me to the professor portal")).toBe(`${FACULTY}/`);
    expect(to("show me the board")).toBe("/availability");
  });

  it("reads the longer way of asking, and the shorter one", () => {
    expect(to("where do i find the availability board")).toBe("/availability");
    expect(to("where can i find the registration form")).toBe("/register");
    expect(to("how can i get to my inbox", { role: "student" }))
      .toBe("/dashboard#inbox");
    expect(to("let me sign in")).toBe("/sign-in");
  });

  it("knows the card scanner is a different screen for each role", () => {
    expect(to("open the qr scanner")).toBe("/sign-in");
    expect(to("open the qr scanner", { role: "teacher" })).toBe(`${FACULTY}/`);
    expect(to("open the qr scanner", { role: "admin" }))
      .toBe(`${ADMIN}/dashboard#credentials`);
  });

  it("prefers the longer name where two overlap", () => {
    // "student dashboard" contains "student", which is the sign-in page.
    expect(to("open the student dashboard", { role: "student" }))
      .toBe("/dashboard#home");
    expect(to("open the dean office dashboard", { role: "admin" }))
      .toBe(`${ADMIN}/dashboard#overview`);
  });

  it("lands on the tab, not on the dashboard the tab is inside", () => {
    expect(to("open my inbox", { role: "student" })).toBe("/dashboard#inbox");
    expect(to("open my profile", { role: "student" })).toBe("/dashboard#profile");
    expect(to("open status and schedule", { role: "teacher" }))
      .toBe(`${FACULTY}/dashboard#status`);
    expect(to("take me to the credentials section", { role: "admin" }))
      .toBe(`${ADMIN}/dashboard#credentials`);
    expect(to("open the activity log", { role: "admin" }))
      .toBe(`${ADMIN}/dashboard#activity`);
  });

  it("reads a name that means three things from who is asking", () => {
    expect(to("open my dashboard", { role: "student" })).toBe("/dashboard#home");
    expect(to("open my dashboard", { role: "teacher" })).toBe(`${FACULTY}/dashboard#requests`);
    expect(to("open my dashboard", { role: "admin" })).toBe(`${ADMIN}/dashboard#overview`);

    // The Requests tab is a different tab on each side of the system.
    expect(to("open the requests tab", { role: "student" })).toBe("/dashboard#inbox");
    expect(to("open the requests tab", { role: "teacher" }))
      .toBe(`${FACULTY}/dashboard#requests`);
  });

  it("falls back to the app somebody is in when nobody is signed in", () => {
    // Asked from inside the faculty app, "the sign-in" is the faculty one —
    // and it is a path, not a URL, because that app is the one asking.
    expect(to("open the sign in page", { app: "faculty" })).toBe("/");
    expect(to("open the sign in page", { app: "admin" })).toBe("/");
    // The student app carries the public screens, and they are overwhelmingly
    // students.
    expect(to("open the sign in page", { app: "student" })).toBe("/sign-in");
  });

  it("sends a signed-out reader to the sign-in a screen is behind", () => {
    const trip = navigationFor("open my inbox");
    expect(trip.to).toBe("/sign-in");
    expect(trip.text).toMatch(/sign.?in/i);

    expect(to("open the requests tab", { app: "faculty" })).toBe("/");
    expect(to("open the activity log")).toBe(`${ADMIN}/`);
  });

  it("carries a label and a sentence for every trip", () => {
    for (const dest of DESTINATIONS) {
      const trip = navigationFor(`open ${dest.phrases[0]}`, { role: dest.needs || null });
      expect(trip, dest.id).toBeTruthy();
      expect(trip.label.length, dest.id).toBeGreaterThan(0);
      // Read aloud, so no markdown and no bare URLs in the wording.
      expect(trip.text, dest.id).not.toMatch(/[[\]()<>]|https?:/);
    }
  });

  it("only ever names an address the app that owns it actually serves", () => {
    // One list per deployment, mirroring each app's App.jsx. A destination
    // naming a path its own app does not serve is a 404 nobody sees until
    // somebody asks Navi for it out loud.
    const ROUTES = {
      student: ["/", "/availability", "/sign-in", "/register", "/dashboard"],
      faculty: ["/", "/dashboard"],
      admin: ["/", "/dashboard"],
    };
    for (const dest of DESTINATIONS) {
      expect(Object.keys(ROUTES), dest.id).toContain(dest.app);
      expect(ROUTES[dest.app], dest.id).toContain(dest.to);
    }
  });

  it("names tabs the dashboards actually have", () => {
    // Scoped by app as well as path: all three dashboards are at /dashboard
    // now, so without the app the student dashboard would claim the
    // administration tabs as its own.
    expect(tabsFor("/dashboard", "student").sort()).toEqual(["home", "inbox", "profile"]);
    expect(tabsFor("/dashboard", "faculty").sort()).toEqual(["profile", "requests", "status"]);
    expect(tabsFor("/dashboard", "admin").sort()).toEqual([
      "activity", "credentials", "faculty", "overview", "requests", "students",
    ]);
  });
});

describe("questions that are not instructions", () => {
  it("leaves every question the FAQ answers where it is", () => {
    // If one of these starts moving the reader, an entry's wording and a
    // phrase in navi-go.js have collided and the FAQ answer is unreachable.
    for (const entry of FAQ) {
      expect(matchDestination(entry.question), entry.id).toBeNull();
    }
    for (const starter of STARTERS) {
      expect(matchDestination(starter), starter).toBeNull();
    }
  });

  it("does not move anybody who is asking what a screen is for", () => {
    expect(matchDestination("what does the availability board show")).toBeNull();
    expect(matchDestination("is the student portal down")).toBeNull();
    expect(matchDestination("who can see my requests")).toBeNull();
    expect(matchDestination("can you show me around")).toBeNull();
    expect(matchDestination("why is my dashboard empty")).toBeNull();
  });

  it("leaves a question about a person to the answer that has the data", () => {
    // Each of these names a screen in passing and asks about something else.
    // navi-live.js answers them from the database; a trip would replace a fact
    // with a page and look like the app had simply jumped.
    expect(matchDestination("show me my professor's schedule")).toBeNull();
    expect(matchDestination("is santos free right now")).toBeNull();
    expect(matchDestination("how many slots does santos have left")).toBeNull();
    expect(matchDestination("what happened to my requests")).toBeNull();
  });

  it("stays out of the way of a question naming no screen at all", () => {
    expect(matchDestination("who is free right now")).toBeNull();
    expect(matchDestination("open the window")).toBeNull();
    expect(matchDestination("")).toBeNull();
    expect(matchDestination("   ")).toBeNull();
  });
});
