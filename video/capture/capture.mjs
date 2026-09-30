// Drive the real app through every moment the teaser shows, and save each
// screen with the positions of the elements the video points at.
//
//   node capture/capture.mjs        (backend.py, seed.py, sessions.py and vite running)
//
// Writes public/screens/*.png and src/data/screens.json.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { launch, open, settle, APP } from "./browser.mjs";

const OUT = new URL("../public/screens/", import.meta.url);
const DATA = new URL("../src/data/screens.json", import.meta.url);
const API = "http://127.0.0.1:5000/api";
const sessions = JSON.parse(readFileSync(new URL("./sessions.json", import.meta.url)));
mkdirSync(OUT, { recursive: true });

const screens = {};

// Find elements by their visible text, optionally widened to the ancestor that
// is at least `up` px wide (a row, a card), and return page coordinates.
async function locate(page, queries) {
  return page.evaluate((queries) => {
    const out = {};
    const all = [...document.querySelectorAll("body *")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    });
    for (const [key, q] of Object.entries(queries)) {
      let el;
      if (q.css) el = document.querySelector(q.css);
      else {
        const hits = all.filter((e) => {
          const t = (e.innerText || e.getAttribute("placeholder") || e.getAttribute("aria-label") || "").trim();
          return q.exact === false ? t.includes(q.text) : t === q.text;
        });
        // The innermost match: the element that holds the text itself.
        el = hits.find((h) => !hits.some((o) => o !== h && h.contains(o))) ?? hits[0];
        if (q.nth) el = hits.filter((h) => !hits.some((o) => o !== h && h.contains(o)))[q.nth];
      }
      if (!el) { out[key] = null; continue; }
      if (q.up) {
        while (el.parentElement && el.getBoundingClientRect().width < q.up) el = el.parentElement;
      }
      if (q.upH) {
        while (el.parentElement && el.getBoundingClientRect().height < q.upH) el = el.parentElement;
      }
      const r = el.getBoundingClientRect();
      out[key] = [r.x + scrollX, r.y + scrollY, r.width, r.height].map((v) => Math.round(v));
    }
    return out;
  }, queries);
}

async function snap(page, name, queries = {}, { full = false } = {}) {
  await page.waitForTimeout(150);
  const boxes = await locate(page, queries);
  // A viewport shot is taken where the page is scrolled to; a full-page one
  // from the top. Boxes come back in page coordinates, so shift them to match.
  if (!full) {
    const sy = await page.evaluate(() => scrollY);
    for (const b of Object.values(boxes)) if (b) b[1] -= sy;
  }
  const missing = Object.entries(boxes).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) console.warn(`  ${name}: not found ${missing.join(", ")}`);
  const size = await page.evaluate(() => [innerWidth, document.documentElement.scrollHeight]);
  const vp = page.viewportSize();
  await page.screenshot({ path: new URL(`${name}.png`, OUT).pathname, fullPage: full });
  screens[name] = {
    width: vp.width, height: full ? size[1] : vp.height,
    dpr: page.__dpr, boxes,
  };
  console.log(name);
}

async function api(path, who, body) {
  const r = await fetch(API + path, {
    method: "POST", body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessions.faculty[who]}` },
  });
  if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`);
}
const setStatus = (who, s) => api("/teacher/save-manual-status", who, { manual_status: s });

async function page(browser, opts) {
  const p = await open(browser, opts);
  p.__dpr = opts.mobile ? 3 : (opts.dpr ?? 1.5);
  p.on("pageerror", (e) => console.warn("  pageerror:", e.message));
  return p;
}

const ANA = "Engr. Ana Villareal";
const browser = await launch();

// ── Live availability board ───────────────────────────────────────────────
{
  const p = await page(browser, {});
  await p.goto(APP + "/availability"); await settle(p, 1500);
  const rows = {};
  for (const n of ["Engr. Ana Villareal", "Engr. Nico Valdez", "Engr. Tomas Rivera", "Prof. Marco Dizon",
    "Prof. Rina Torres", "Engr. Kaye Bautista", "Engr. Liza Manalo", "Engr. Rey Padilla"]) {
    rows[n] = { text: n, up: 1100 };
  }
  await snap(p, "board", { ...rows, available: { text: "AVAILABLE", upH: 80 } }, { full: true });
  // A professor comes out of their meeting while the board is open.
  await setStatus("Prof. Marco Dizon", "Available");
  await p.reload(); await settle(p, 1500);
  await snap(p, "board-live", { ...rows, available: { text: "AVAILABLE", upH: 80 } }, { full: true });
  await setStatus("Prof. Marco Dizon", "In Meeting");
  await p.context().close();
}

// ── The teacher changes their status; a student's phone follows ──────────
{
  const s = await page(browser, { role: "student", mobile: true });
  await s.goto(APP + "/student/dashboard"); await settle(s);
  await snap(s, "m-home", { civil: { text: "Civil Engineering Department", up: 300, upH: 250 } });
  await s.getByText("Civil Engineering Department").first().click(); await settle(s, 800);
  await snap(s, "m-civil", { ana: { text: "Ana Villareal", up: 150, upH: 250 }, slots: { text: "10:00 AM", exact: false } });

  const t = await page(browser, { role: "teacher" });
  await t.goto(APP + "/teacher/dashboard"); await settle(t);
  await t.getByRole("button", { name: /Status & Schedule/ }).click(); await settle(t, 800);
  const tq = {
    badge: { text: "Available", exact: true },
    select: { css: "select" },
    update: { text: "Update status" },
    thu: { text: "THU", up: 250 },
    hours: { text: "Weekly consultation hours", up: 300, upH: 300 },
    card: { text: "Your availability", up: 300, upH: 300 },
  };
  await snap(t, "t-status", tq);
  await t.locator("select").first().selectOption("Unavailable"); await settle(t, 300);
  await snap(t, "t-status-picked", tq);
  await t.getByRole("button", { name: /Update status/ }).click(); await settle(t, 1200);
  await snap(t, "t-status-set", { ...tq, badge: { text: "Unavailable", nth: 1 } });

  await s.clock.runFor(2000); await settle(s, 1500);
  await snap(s, "m-civil-live", { ana: { text: "Ana Villareal", up: 150, upH: 250 } });
  await s.reload(); await settle(s);
  await setStatus(ANA, "Auto (use schedule)");
  await t.context().close();
  await s.context().close();
}

// ── Booking: the student asks, the teacher accepts, the student hears ────
{
  const s = await page(browser, { role: "student", mobile: true });
  await s.goto(APP + "/student/dashboard"); await settle(s);
  await s.getByText("Civil Engineering Department").first().click(); await settle(s, 800);
  await snap(s, "m-pick", { ana: { text: "Ana Villareal", up: 150, upH: 250 }, slots: { text: "10:00 AM", exact: false } }, { full: true });
  await s.getByRole("button", { name: /Ana Villareal/ }).first().click(); await settle(s, 800);
  const mq = {
    thesis: { text: "Thesis" }, purpose: { css: "textarea" },
    submit: { text: "Submit Request", exact: false }, header: { text: ANA, up: 300 },
  };
  await snap(s, "m-modal", mq);
  await s.getByRole("button", { name: "Thesis", exact: true }).click();
  const PURPOSE = "Feedback on my thesis, chapter 2";
  const area = s.locator("textarea");
  for (let i = 0; i <= 4; i++) {
    await area.fill(PURPOSE.slice(0, Math.round((PURPOSE.length * i) / 4)));
    await snap(s, `m-type-${i}`, mq);
  }
  const t = await page(browser, { role: "teacher" });
  await t.goto(APP + "/teacher/dashboard"); await settle(t, 1500);
  await snap(t, "t-empty", {});
  await s.getByRole("button", { name: /Submit Request/ }).click(); await settle(s, 400);
  await snap(s, "m-sent", {});

  await t.clock.runFor(1500); await settle(t, 800);
  const rq = { accept: { text: "Accept", exact: true }, card: { text: "Mika Soriano", up: 900, upH: 150 } };
  await snap(t, "t-request", rq);
  await t.getByRole("button", { name: /^Accept/ }).first().click(); await settle(t, 1200);
  await snap(t, "t-accepted", rq);

  await s.clock.runFor(1000); await settle(s, 300);
  await snap(s, "m-accepted-live", { bell: { css: "button[aria-label='Notifications']" } });
  // notify() stamps created_at in Manila time, but the API serves created_at as
  // UTC, so the panel would read 8 hours late. Show the time it is meant to.
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "55432", "-U", "urs", "-d", "ursdb_video", "-qc",
    "UPDATE notifications SET created_at = created_at - interval '8 hours'"]);
  await s.getByRole("button", { name: "Notifications" }).first().click(); await settle(s, 800);
  await snap(s, "m-notifications", { first: { text: "Engr. Ana Villareal accepted", exact: false, upH: 90 } });
  await t.context().close();
  await s.context().close();
}

// ── Navi ──────────────────────────────────────────────────────────────────
{
  const s = await page(browser, { role: "student", mobile: true });
  await s.goto(APP + "/student/dashboard"); await settle(s);
  await s.getByRole("button", { name: "Ask Navi for help" }).click(); await settle(s, 800);
  const nq = { input: { text: "Ask a question" }, mic: { css: "[aria-label='Ask by voice']" }, send: { css: "[aria-label='Send question']" } };
  await snap(s, "m-navi", nq);
  await s.getByPlaceholder("Ask a question").fill(process.env.NAVI_Q ?? "Is Engr. Villareal free today?");
  await snap(s, "m-navi-typed", nq);
  await s.getByRole("button", { name: "Send question" }).click(); await settle(s, 2500);
  await snap(s, "m-navi-answer", { ...nq, link: { text: "Open the availability board", exact: false } });
  await s.getByText("Open the availability board").last().click(); await settle(s, 1500);
  await snap(s, "m-navi-board", { ana: { text: ANA, up: 300 } });
  await s.context().close();
}

// ── Signing in, installing, and going offline ─────────────────────────────
{
  const s = await page(browser, { mobile: true });
  await s.goto(APP + "/student"); await settle(s);
  await snap(s, "m-student-login", { qr: { text: "Scan QR code", up: 300, upH: 120 }, id: { text: "Enter student number", up: 300, upH: 100 } });
  await s.goto(APP + "/teacher"); await settle(s);
  await snap(s, "m-teacher-login", { qr: { text: "Scan Faculty ID", up: 150, upH: 150 }, pin: { text: "Employee ID + PIN", up: 150, upH: 100 } });
  await s.context().close();

  const a = await page(browser, { role: "student", mobile: true });
  await a.goto(APP + "/student/dashboard"); await settle(a);
  await snap(a, "m-app", {});
  await a.context().setOffline(true);
  await a.evaluate(() => window.dispatchEvent(new Event("offline"))); await settle(a, 800);
  await snap(a, "m-offline", { bar: { text: "You're offline", exact: false, up: 300 } });
  await a.context().close();
}

// ── Kiosk and the Dean's Office ───────────────────────────────────────────
{
  const k = await page(browser, { dpr: 1.2 });
  await k.setViewportSize({ width: 1600, height: 900 });
  await k.goto(APP + "/availability"); await settle(k, 1500);
  await snap(k, "kiosk", {});
  await k.context().close();

  const d = await page(browser, { role: "admin" });
  await d.goto(APP + "/dean/dashboard"); await settle(d, 2500);
  const dq = {
    stats: { text: "FACULTY", up: 1000, upH: 100 }, online: { text: "Students online", up: 700 },
    chart: { text: "Requests over time", up: 500, upH: 300 }, today: { text: "Today", exact: true },
    requests: { text: "Requests", exact: true },
  };
  await snap(d, "dean", dq);
  await d.getByText("Requests over time").first().scrollIntoViewIfNeeded();
  await d.mouse.wheel(0, 250); await settle(d, 600);
  await snap(d, "dean-charts", { chart: { text: "Requests over time", up: 500, upH: 300 }, today: { text: "Today", exact: true } });
  await d.mouse.wheel(0, -5000); await settle(d, 400);
  const [download] = await Promise.all([
    d.waitForEvent("download", { timeout: 8000 }).catch(() => null),
    d.getByRole("button", { name: /^Today$/ }).first().click(),
  ]);
  await settle(d, 1200);
  await snap(d, "dean-exported", dq);
  if (download) screens["dean-exported"].download = download.suggestedFilename();
  await d.context().close();
}

await browser.close();
writeFileSync(DATA, JSON.stringify(screens, null, 1));
console.log(`${Object.keys(screens).length} screens → public/screens, src/data/screens.json`);
