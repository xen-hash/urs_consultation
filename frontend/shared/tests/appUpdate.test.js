import { describe, expect, it } from "vitest";

import { canReloadNow, hasUnsavedTyping } from "../lib/appUpdate.js";

/**
 * These pin the one judgement in the auto-reload path: when it is rude to
 * reload. Everything else there is service worker plumbing the browser drives;
 * this is the part that decides whether somebody loses a paragraph they were
 * half-way through writing.
 *
 * The bar is deliberately narrow. Only the focused field counts, because a
 * form filled in and abandoned is not work in progress, and refusing to reload
 * for it would mean an app that never updates while a form is on screen.
 */

/** A document stand-in, so activeElement can be set without a real focus. */
const doc = (activeElement, visibilityState = "visible") =>
  ({ activeElement, visibilityState });

const input = (value, type = "text") => ({ tagName: "INPUT", type, value });
const textarea = value => ({ tagName: "TEXTAREA", value });

describe("hasUnsavedTyping", () => {
  it("is true for a text field with something in it", () => {
    expect(hasUnsavedTyping(doc(input("I need help with my grades")))).toBe(true);
    expect(hasUnsavedTyping(doc(textarea("Consultation about my thesis")))).toBe(true);
  });

  it("is false for an empty or whitespace-only field", () => {
    expect(hasUnsavedTyping(doc(input("")))).toBe(false);
    expect(hasUnsavedTyping(doc(input("   ")))).toBe(false);
    expect(hasUnsavedTyping(doc(textarea("\n  \t ")))).toBe(false);
  });

  it("ignores inputs that hold no typing", () => {
    // A focused Send button or a ticked checkbox is not a half-written
    // sentence, and treating it as one would stall the reload indefinitely.
    for (const type of ["button", "submit", "checkbox", "radio", "range", "file"]) {
      expect(hasUnsavedTyping(doc(input("on", type))), type).toBe(false);
    }
  });

  it("covers a contenteditable", () => {
    expect(hasUnsavedTyping(doc({ isContentEditable: true, textContent: "draft" }))).toBe(true);
    expect(hasUnsavedTyping(doc({ isContentEditable: true, textContent: "  " }))).toBe(false);
  });

  it("is false when nothing is focused", () => {
    expect(hasUnsavedTyping(doc(null))).toBe(false);
    expect(hasUnsavedTyping(doc({ tagName: "BODY" }))).toBe(false);
    expect(hasUnsavedTyping(undefined)).toBe(false);
  });
});

describe("canReloadNow", () => {
  it("holds the reload back while someone is typing", () => {
    expect(canReloadNow(doc(input("halfway through a request")))).toBe(false);
  });

  it("reloads when nothing is being typed", () => {
    expect(canReloadNow(doc(null))).toBe(true);
    expect(canReloadNow(doc(input("")))).toBe(true);
  });

  it("reloads regardless once the app is in the background", () => {
    // Nothing to interrupt and no flash to see: the best moment there is, even
    // with a field focused and half-filled.
    expect(canReloadNow(doc(input("halfway through"), "hidden"))).toBe(true);
  });
});
