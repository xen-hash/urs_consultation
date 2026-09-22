import { describe, expect, it } from "vitest";

import { APPS, isExternal, originOf, urlFor } from "../lib/origins.js";

/**
 * The join between the three deployments.
 *
 * Everything this file decides is invisible until it is wrong: a link that
 * should have crossed to another origin and did not renders as a path on this
 * one, which is a 404 that looks exactly like a working link. Nothing throws,
 * so nothing shows up anywhere except in somebody tapping it.
 *
 * The suite runs as the student app, and with no VITE_*_URL set — so these also
 * pin the development defaults, which are what makes three `npm run dev`
 * terminals behave like the real thing.
 */

describe("originOf", () => {
  it("gives each app its own development port", () => {
    expect(originOf("student")).toBe("http://localhost:5173");
    expect(originOf("faculty")).toBe("http://localhost:5174");
    expect(originOf("admin")).toBe("http://localhost:5175");
  });

  it("knows an origin for every app there is", () => {
    for (const app of APPS) expect(originOf(app), app).toMatch(/^https?:\/\/\S+[^/]$/);
  });
});

describe("urlFor", () => {
  it("keeps a link inside this app as a path", () => {
    // A path, so the router handles it and the page does not reload.
    expect(urlFor("student", "/dashboard")).toBe("/dashboard");
    expect(urlFor("student", "/")).toBe("/");
  });

  it("makes a link to another app absolute", () => {
    expect(urlFor("faculty", "/dashboard")).toBe("http://localhost:5174/dashboard");
    expect(urlFor("admin", "/")).toBe("http://localhost:5175/");
  });

  it("answers for an app other than this one when asked", () => {
    // What the unit tests for navi-go rely on, and what a build for one app
    // would do if it ever had to reason about another.
    expect(urlFor("student", "/sign-in", { from: "faculty" }))
      .toBe("http://localhost:5173/sign-in");
    expect(urlFor("faculty", "/dashboard", { from: "faculty" })).toBe("/dashboard");
  });

  it("carries a hash across", () => {
    // The hash is which tab, so dropping it turns a link to somebody's inbox
    // into a link to the dashboard's default screen.
    expect(urlFor("student", "/dashboard#inbox")).toBe("/dashboard#inbox");
    expect(urlFor("admin", "/dashboard#credentials"))
      .toBe("http://localhost:5175/dashboard#credentials");
  });

  it("does not care whether the path was given a leading slash", () => {
    expect(urlFor("faculty", "dashboard")).toBe("http://localhost:5174/dashboard");
  });

  it("never doubles a slash against a configured origin", () => {
    // Origins arrive from a dashboard field, where a trailing slash is the
    // most ordinary typo there is.
    expect(urlFor("faculty", "/", { from: "student" })).not.toMatch(/\/\/$/);
  });
});

describe("isExternal", () => {
  it("separates what the router can handle from what it cannot", () => {
    expect(isExternal("/dashboard")).toBe(false);
    expect(isExternal("/")).toBe(false);
    expect(isExternal("http://localhost:5174/")).toBe(true);
    expect(isExternal("https://faculty.example.edu/dashboard")).toBe(true);
  });

  it("treats nothing at all as internal", () => {
    // A missing address is a bug elsewhere; reading it as external would turn
    // it into a page load to nowhere rather than a link that does nothing.
    expect(isExternal(null)).toBe(false);
    expect(isExternal("")).toBe(false);
  });
});
