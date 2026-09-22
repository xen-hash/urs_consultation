import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import NaviAssistant from "../ui/NaviAssistant.jsx";

/**
 * The trip itself, rather than the matching behind it.
 *
 * navi-go.test.js pins which screen a question names. What this pins is the
 * part somebody actually experiences: the address really changes, and the
 * panel gets out of the way instead of sitting over the screen it just opened.
 * Both have been broken by a one-line change in the panel while every matcher
 * test stayed green.
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

afterEach(cleanup);

describe("asking Navi to open a screen", () => {
  it("goes there, and closes so the screen is what is left", () => {
    openNavi();
    ask("open the student login page");

    expect(at()).toBe("/student");
    // The launcher is only rendered while the panel is shut.
    expect(screen.getByLabelText("Ask Navi for help")).toBeTruthy();
    expect(screen.queryByLabelText("Your question")).toBeNull();
  });

  it("keeps the trip in the transcript, with a way back to it", () => {
    openNavi();
    ask("take me to the faculty portal");
    expect(at()).toBe("/teacher");

    fireEvent.click(screen.getByLabelText("Ask Navi for help"));
    const again = screen.getByRole("link", { name: /faculty sign-in/i });
    expect(again.getAttribute("href")).toBe("/teacher");
  });

  it("answers a question about a screen without moving anybody", () => {
    openNavi();
    ask("how do i sign in as a student");

    expect(at()).toBe("/availability");
    expect(screen.getByText(/Scan the QR code on your student card/)).toBeTruthy();
  });
});
