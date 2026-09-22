import { describe, expect, it } from "vitest";

import { worthRetrying } from "../httpClient.js";

/**
 * Which failures are waited out, and which are not.
 *
 * The backoff here is 1.5s + 4s + 9s, sized for a Render backend that sleeps
 * and has to boot before it can answer. That is right for a dashboard whose
 * panels are empty until it does, and wrong for anything a person is watching
 * — Navi's help bubble sat on "Checking…" for sixteen seconds because it
 * inherited this policy by default.
 */

const err = (over = {}) => ({ config: { method: "get", ...over.config }, ...over });

describe("worthRetrying", () => {
  it("waits out a failure that carries no reply at all", () => {
    // A dropped connection or a timeout is what a waking backend looks like.
    expect(worthRetrying(err())).toBe(true);
  });

  it("waits out a gateway saying the service is not up", () => {
    for (const status of [502, 503, 504]) {
      expect(worthRetrying(err({ response: { status } })), String(status)).toBe(true);
    }
  });

  it("never retries an answer the server actually gave", () => {
    // A 4xx is a decision, not a hiccup, and repeating it changes nothing.
    for (const status of [400, 401, 403, 404, 429]) {
      expect(worthRetrying(err({ response: { status } })), String(status)).toBe(false);
    }
  });

  it("never retries something that changes state", () => {
    for (const method of ["post", "put", "patch", "delete"]) {
      expect(worthRetrying(err({ config: { method } })), method).toBe(false);
    }
  });

  it("lets a caller opt out of being waited for", () => {
    // Navi's live answers: fail fast and say so, rather than look frozen.
    expect(worthRetrying(err({ config: { method: "get", __noRetry: true } }))).toBe(false);
    expect(worthRetrying(err({
      config: { method: "get", __noRetry: true }, response: { status: 503 },
    }))).toBe(false);
  });
});
