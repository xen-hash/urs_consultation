import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import NaviAssistant from "../ui/NaviAssistant.jsx";

/**
 * The trip itself, rather than the matching behind it.
 *
 * navi-go.test.js pins which screen a question names. What this pins is the
 * part somebody actually experiences: the address really changes, and the
 * panel gets out of the way instead of sitting over the screen it just opened.
 * Both have been broken by a one-line change in the panel while every matcher
 * test stayed green.
 *
 * Since the split there are two ways for the address to change, and only one
 * of them is the router: a screen in one of the other two apps is on another
 * origin, so the trip is a real page load. Handing that URL to the router
 * instead produces a link to "/http://localhost:5174/" — a 404 that looks
 * exactly like a working link until it is clicked, which is why both paths
 * have a test.
 *
 * These run as the student app; see vitest.config.js.
 */

// jsdom implements no scrolling at all, and the panel scrolls its newest
// answer into view. Without this the answer arrives and the effect throws.
beforeAll(() => {
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
});

function Where() {
  const { pathname, hash } = useLocation();
  return <p data-testid="where">{pathname + hash}</p>;
}

const at = () => screen.getByTestId("where").textContent;

function openNavi(from = "/availability") {
  render(
    <MemoryRouter initialEntries={[from]}>
      <Where />
      <NaviAssistant />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByLabelText("Ask Navi for help"));
}

function ask(question) {
  fireEvent.change(screen.getByLabelText("Your question"), { target: { value: question } });
  fireEvent.click(screen.getByLabelText("Send question"));
}

// A cross-origin trip calls window.location.assign, which jsdom does not
// implement. Replaced wholesale rather than spied on, because jsdom's Location
// properties are not configurable — and MemoryRouter never reads it, so
// nothing else in this file notices.
const realLocation = window.location;
let assigned;

beforeEach(() => {
  assigned = [];
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { pathname: "/", assign: (url) => assigned.push(url) },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: realLocation,
  });
  cleanup();
});

describe("asking Navi to open a screen", () => {
  it("goes there, and closes so the screen is what is left", () => {
    openNavi();
    ask("open the student login page");

    expect(at()).toBe("/sign-in");
    // The launcher is only rendered while the panel is shut.
    expect(screen.getByLabelText("Ask Navi for help")).toBeTruthy();
    expect(screen.queryByLabelText("Your question")).toBeNull();
  });

  it("keeps the trip in the transcript, with a way back to it", () => {
    openNavi();
    ask("open my registration");
    expect(at()).toBe("/register");

    fireEvent.click(screen.getByLabelText("Ask Navi for help"));
    const again = screen.getByRole("link", { name: /registration/i });
    expect(again.getAttribute("href")).toBe("/register");
  });

  it("leaves the origin for a screen one of the other apps owns", () => {
    openNavi();
    ask("take me to the faculty portal");

    // A real navigation, not a route change — so the router has not moved and
    // the browser has been asked for the faculty origin instead.
    expect(at()).toBe("/availability");
    expect(assigned).toEqual(["http://localhost:5174/"]);

    fireEvent.click(screen.getByLabelText("Ask Navi for help"));
    const again = screen.getByRole("link", { name: /faculty sign-in/i });
    expect(again.getAttribute("href")).toBe("http://localhost:5174/");
  });

  it("answers a question about a screen without moving anybody", () => {
    openNavi();
    ask("how do i sign in as a student");

    expect(at()).toBe("/availability");
    expect(screen.getByText(/Scan the QR code on your student card/)).toBeTruthy();
  });
});
