// Shared Playwright setup for capturing the real app.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright");

export const APP = process.env.APP_URL ?? "http://localhost:5173";
// Thursday 1 October 2026, 10:24 in Manila, matching capture/backend.py.
export const NOW = new Date("2026-10-01T10:24:00+08:00");
const sessions = JSON.parse(readFileSync(new URL("./sessions.json", import.meta.url)));

export async function launch() {
  return chromium.launch({ args: ["--disable-gpu"] });
}

// A page signed in as `role` (or signed out), with the tours already seen.
export async function open(browser, { role = null, mobile = false, theme = "light" } = {}) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: mobile ? 3 : 1.5,
    isMobile: mobile,
    hasTouch: mobile,
    timezoneId: "Asia/Manila",
    locale: "en-PH",
    colorScheme: "light",
  });
  await context.clock.install({ time: NOW });
  await serveFontsLocally(context);
  await context.addInitScript(({ role, session, theme }) => {
    const KEYS = { student: "urs.student", teacher: "urs.teacher", admin: "urs.admin" };
    if (role) sessionStorage.setItem(KEYS[role], JSON.stringify(session));
    localStorage.setItem("urs.theme", theme);
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) {
      return typeof k === "string" && k.startsWith("urs.tour.") ? "done" : get.call(this, k);
    };
  }, { role, session: role ? sessions[role] : null, theme });
  const page = await context.newPage();
  return page;
}

// The app pulls Plus Jakarta Sans from Google Fonts. Where that host is out of
// reach, answer with the same font from the @fontsource package, so the
// screens render in the app's real typeface rather than a fallback.
const FONT_DIR = new URL("../node_modules/@fontsource/plus-jakarta-sans/files/", import.meta.url);
const WEIGHTS = [400, 500, 600, 700, 800];

async function serveFontsLocally(context) {
  await context.route("https://fonts.googleapis.com/**", (route) => route.fulfill({
    contentType: "text/css",
    body: WEIGHTS.map((w) => `@font-face{font-family:"Plus Jakarta Sans";font-style:normal;` +
      `font-weight:${w};font-display:swap;src:url(https://fonts.gstatic.com/local/${w}.woff2) format("woff2");}`).join("\n"),
  }));
  await context.route("https://fonts.gstatic.com/local/*.woff2", (route) => {
    const w = route.request().url().match(/(\d+)\.woff2$/)[1];
    route.fulfill({
      contentType: "font/woff2",
      body: readFileSync(new URL(`plus-jakarta-sans-latin-${w}-normal.woff2`, FONT_DIR)),
    });
  });
}

export async function settle(page, ms = 1200) {
  // The live-update socket keeps the network busy, so idle may never come.
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
  await page.clock.runFor(ms);
  await page.waitForTimeout(300);
}
