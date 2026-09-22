import { describe, expect, it } from "vitest";

// Imported rather than read off disk: Vite parses JSON imports itself, and
// import.meta.url is not a file URL once the test has been through the jsdom
// transform.
import student from "../../apps/student/vercel.json";
import faculty from "../../apps/faculty/vercel.json";
import admin from "../../apps/admin/vercel.json";

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
 *
 * There are three of these files now, one per deployment, and three chances to
 * get it wrong rather than one — so every app is checked, and the one place
 * they are allowed to differ is named rather than left to drift.
 */

const APPS = [
  { name: "student", config: student, camera: "(self)" },
  { name: "faculty", config: faculty, camera: "(self)" },
  // Administration issues QR cards and never scans one, so it is the only app
  // with no reason to ask for a camera. Navi is on all three, so the
  // microphone is granted everywhere.
  { name: "admin", config: admin, camera: "()" },
];

const permissionsPolicy = (config) => {
  const global = config.headers.find(rule => rule.source === "/(.*)");
  const header = global.headers.find(h => h.key === "Permissions-Policy");
  return header.value;
};

/** "camera=(self), microphone=()" -> { camera: "(self)", microphone: "()" } */
const directives = (config) =>
  Object.fromEntries(
    permissionsPolicy(config).split(",").map(part => {
      const [name, ...rest] = part.trim().split("=");
      return [name, rest.join("=")];
    }),
  );

describe.each(APPS)("$name: Permissions-Policy", ({ config, camera }) => {
  it("lets this page use the microphone", () => {
    // Navi's ask-by-voice needs it, on every one of the three apps. "()" is
    // the denial that broke it.
    expect(directives(config).microphone).toBe("(self)");
  });

  it("grants the camera exactly where a screen uses it", () => {
    // The QR scanner on the student and faculty sign-ins, and nowhere else.
    expect(directives(config).camera).toBe(camera);
  });

  it("still denies what the app does not use", () => {
    const d = directives(config);
    for (const feature of ["geolocation", "payment", "usb"]) {
      expect(d[feature], feature).toBe("()");
    }
  });

  it("grants nothing to arbitrary third parties", () => {
    // (self) and () are the only two values this app should ever carry. A bare
    // * would hand the camera and microphone to anything that framed the page.
    for (const [feature, value] of Object.entries(directives(config))) {
      expect(["(self)", "()"], feature).toContain(value);
    }
  });
});

describe.each(APPS)("$name: service worker headers", ({ config }) => {
  it("serves sw.js without caching it", () => {
    // A cached sw.js is an app that can never update: the browser re-fetches
    // this file to find a new build, and a max-age on it stalls every deploy.
    const rule = config.headers.find(r => r.source === "/sw.js");
    const cacheControl = rule.headers.find(h => h.key === "Cache-Control").value;
    expect(cacheControl).toMatch(/max-age=0/);
    expect(cacheControl).toMatch(/must-revalidate/);
  });
});

describe.each(APPS)("$name: deep links", ({ config }) => {
  it("serves the app shell for every path", () => {
    // Each app owns its whole origin and routes in the browser, so a reload on
    // /dashboard has to reach index.html rather than 404 at the CDN.
    const rewrite = config.rewrites.find(r => r.source === "/(.*)");
    expect(rewrite.destination).toBe("/index.html");
  });
});
