import { describe, expect, it } from "vitest";

// Imported rather than read off disk: Vite parses JSON imports itself, and
// import.meta.url is not a file URL once the test has been through the jsdom
// transform.
import config from "../vercel.json";

/**
 * The deploy headers, checked here because nothing else checks them.
 *
 * vercel.json is applied by Vercel and by nothing else: `vite preview` and the
 * dev server both ignore it. So a header that breaks a feature does not fail a
 * build, does not fail a test, and does not throw in a browser — it just makes
 * the feature quietly not work, on production only, and the first report comes
 * from somebody holding a phone.
 *
 * That is exactly how `microphone=()` shipped. An empty allowlist denies every
 * origin, this one included, and SpeechRecognition is gated on it — so Navi's
 * microphone button raised no permission prompt, no error, and nothing anybody
 * could act on. These tests exist so the next edit to that line has to be
 * deliberate.
 */

const permissionsPolicy = () => {
  const global = config.headers.find(rule => rule.source === "/(.*)");
  const header = global.headers.find(h => h.key === "Permissions-Policy");
  return header.value;
};

/** "camera=(self), microphone=()" -> { camera: "(self)", microphone: "()" } */
const directives = () =>
  Object.fromEntries(
    permissionsPolicy().split(",").map(part => {
      const [name, ...rest] = part.trim().split("=");
      return [name, rest.join("=")];
    }),
  );

describe("Permissions-Policy", () => {
  it("lets this page use the microphone", () => {
    // Navi's ask-by-voice needs it. "()" is the denial that broke it.
    expect(directives().microphone).toBe("(self)");
  });

  it("lets this page use the camera", () => {
    // The QR scanner on the student and faculty portals.
    expect(directives().camera).toBe("(self)");
  });

  it("still denies what the app does not use", () => {
    const d = directives();
    for (const feature of ["geolocation", "payment", "usb"]) {
      expect(d[feature], feature).toBe("()");
    }
  });

  it("grants nothing to arbitrary third parties", () => {
    // (self) and () are the only two values this app should ever carry. A bare
    // * would hand the camera and microphone to anything that framed the page.
    for (const [feature, value] of Object.entries(directives())) {
      expect(["(self)", "()"], feature).toContain(value);
    }
  });
});

describe("service worker headers", () => {
  it("serves sw.js without caching it", () => {
    // A cached sw.js is an app that can never update: the browser re-fetches
    // this file to find a new build, and a max-age on it stalls every deploy.
    const rule = config.headers.find(r => r.source === "/sw.js");
    const cacheControl = rule.headers.find(h => h.key === "Cache-Control").value;
    expect(cacheControl).toMatch(/max-age=0/);
    expect(cacheControl).toMatch(/must-revalidate/);
  });
});
