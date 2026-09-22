/**
 * What Navi knows, and how a typed or spoken question finds it.
 *
 * Everything here is matched in the browser against a fixed list. There is no
 * model behind it and no network call, for three reasons that all matter on
 * this deployment: it answers with the campus WiFi down, it cannot invent a
 * policy this system does not have, and an answer is only ever wrong because
 * somebody wrote it wrong — which is fixable in this file.
 *
 * House rules for the writing, the same ones tours.js follows:
 *
 *   - Short sentences. Two or three, and none of them long.
 *   - Name the control exactly as the screen labels it — "the Inbox tab", not
 *     "your notifications area" — so the word just read is findable.
 *   - Say what it does, then what to do.
 *   - Plain words. Not "authentication credentials", just "your PIN".
 *
 * Answers are plain strings because they are also read aloud. No markdown, no
 * links inside the sentence: a screen reader and speechSynthesis both render
 * "see [the board](/availability)" as noise. Where an answer points somewhere
 * in the app, `go` carries the address and the panel draws a real button. The
 * address may be on one of the other two deployments — Navi is the same helper
 * in all three apps, and a student question asked on the faculty portal still
 * deserves the student screen as its answer.
 *
 * Adding an entry: give it keywords in the words a student would actually use,
 * including the wrong ones. "Cannot log in" is the question; "cant sign in",
 * "locked out" and "forgot password" are how it gets asked out loud.
 */

import { urlFor, THIS_APP } from "../lib/origins.js";

/**
 * The button under an answer, pointed at whichever app owns the screen.
 *
 * An entry says which of the three deployments its screen is on; this turns
 * that into something the button can use — a path when the screen is in this
 * app, an absolute URL when it is not. Resolved at module load because the app
 * a bundle belongs to is fixed at build time and cannot change under it.
 */
const goTo = (app, path) => ({ to: urlFor(app, path) });

/** Which portal an entry belongs to, for the topic chips and the heading. */
export const AUDIENCES = {
  student: "For students",
  teacher: "For faculty",
  dean: "For the Dean's Office",
  app: "About the app",
};

export const FAQ = [
  // ── Booking a consultation ────────────────────────────────────────────────
  {
    id: "book-request",
    audience: "student",
    topic: "Booking",
    question: "How do I request a consultation?",
    answer:
      "Sign in, then open the Faculty tab. Pick your department, pick the professor, and the request form opens. Choose a category, write what you need in a sentence or two, and press Send.",
    go: { ...goTo("student", "/sign-in"), label: "Go to the student portal" },
    keywords: [
      "book", "booking", "request", "consult", "consultation", "appointment",
      "schedule a meeting", "how do i request", "make a request", "ask professor",
      "set appointment", "reserve", "apply",
    ],
  },
  {
    id: "book-one-at-a-time",
    audience: "student",
    topic: "Booking",
    question: "Why can't I send a second request to the same professor?",
    answer:
      "You can only have one open request per professor. While your first one is still pending or accepted, a second one is blocked. Wait for their answer, or cancel the first from your Inbox tab.",
    keywords: [
      "second request", "another request", "already have a pending", "duplicate",
      "429", "cannot send", "blocked", "wont send", "error sending", "two requests",
      "again", "limit",
    ],
  },
  {
    id: "book-category",
    audience: "student",
    topic: "Booking",
    question: "What do the request categories mean?",
    answer:
      "They tell your professor what the consultation is about before they open it. The choices are Academic, Grades, Project, Schedule, Thesis and Other. Pick the closest one; the sentence you write matters more.",
    keywords: [
      "category", "categories", "academic", "grades", "project", "thesis",
      "type of request", "purpose", "what should i pick", "dropdown",
    ],
  },
  {
    id: "book-cancel",
    audience: "student",
    topic: "Booking",
    question: "How do I cancel a request I already sent?",
    answer:
      "Open the Inbox tab and cancel it there. You can cancel while it is still pending or accepted. Once it is declined or already held, it cannot be cancelled — the record stays so both sides can see what happened.",
    keywords: [
      "cancel", "withdraw", "take back", "undo request", "remove request",
      "delete request", "changed my mind", "cancel consultation",
    ],
  },
  {
    id: "book-no-slots",
    audience: "student",
    topic: "Booking",
    question: "The professor shows as unavailable but they are on campus. Why?",
    answer:
      "Two things turn a professor grey. Their weekly schedule says they are not in consultation hours right now, or they have already taken all the consultations they set for today. Either way the board will not let a new request through until tomorrow or their next slot.",
    keywords: [
      "unavailable", "grey", "gray", "not available", "full", "fully booked",
      "no slots", "slots left", "cannot request", "why cant i book", "limit reached",
      "daily limit",
    ],
  },

  // ── Signing in ────────────────────────────────────────────────────────────
  {
    id: "signin-student",
    audience: "student",
    topic: "Signing in",
    question: "How do I sign in as a student?",
    answer:
      "Two ways. Scan the QR code on your student card, or tap Enter ID and type your student number, then your 4-digit PIN.",
    go: { ...goTo("student", "/sign-in"), label: "Go to the student portal" },
    keywords: [
      "sign in", "signin", "login", "log in", "how to login", "enter", "access",
      "student login", "qr", "scan", "student number", "id number",
    ],
  },
  {
    id: "signin-forgot-pin",
    audience: "student",
    topic: "Signing in",
    question: "I forgot my PIN. What now?",
    answer:
      "Nobody can read your PIN back to you, not even the Dean's Office — it is stored scrambled. Ask the Dean's Office to reset it. The next time you sign in, the first 4 digits you type become your new PIN.",
    keywords: [
      "forgot pin", "forgot password", "lost pin", "reset pin", "cant remember",
      "wrong pin", "pin not working", "locked out", "change pin", "recover",
      "forgot my code",
    ],
  },
  {
    id: "signin-pin-rules",
    audience: "student",
    topic: "Signing in",
    question: "What can my PIN be?",
    answer:
      "Exactly 4 digits, numbers only. Set it the first time you sign in, and change it later from the Profile tab.",
    keywords: [
      "pin rules", "how many digits", "4 digit", "four digit", "pin length",
      "what pin", "set pin", "create pin", "new pin",
    ],
  },
  {
    id: "signin-not-found",
    audience: "student",
    topic: "Signing in",
    question: "It says my student number was not found.",
    answer:
      "That number has no account on this system yet. Register first — it takes a minute and needs your name, course, year level, department and email. Check for a typo before you do; the number must match your card exactly.",
    go: { ...goTo("student", "/register"), label: "Register as a student" },
    keywords: [
      "not found", "student not found", "no account", "doesnt exist", "not registered",
      "cant find me", "unknown student", "invalid id", "register", "sign up", "new account",
    ],
  },
  {
    id: "signin-qr-fails",
    audience: "student",
    topic: "Signing in",
    question: "The QR scanner will not read my card.",
    answer:
      "Give it more light and hold the card still, about a hand's width from the camera. If the camera never opens, the browser is blocking it — allow camera access for this site in your browser settings. You can always tap Enter ID and type your student number instead.",
    keywords: [
      "qr", "scanner", "camera", "wont scan", "not scanning", "cant scan",
      "camera not working", "blurry", "card not reading", "scan failed",
      "camera permission", "black screen",
    ],
  },
  {
    id: "signin-face",
    audience: "student",
    topic: "Signing in",
    question: "Why does face login say the service is offline?",
    answer:
      "Face recognition runs on a separate machine inside the campus, not on the website. When that machine is off, face login goes offline and nothing else is affected. Use your QR code or your PIN.",
    keywords: [
      "face", "facial", "biometric", "face recognition", "face login", "offline",
      "service offline", "camera login", "face id", "not working",
    ],
  },
  {
    id: "signin-signed-out",
    audience: "student",
    topic: "Signing in",
    question: "Why was I signed out on my own?",
    answer:
      "The app signs everybody out after a stretch with no activity. It is a shared-computer precaution — a lab machine left open should not still be your account an hour later. Sign back in and carry on; nothing is lost.",
    keywords: [
      "signed out", "logged out", "kicked out", "session expired", "timeout",
      "idle", "why did it log me out", "keeps logging out", "automatically",
    ],
  },

  // ── Availability ──────────────────────────────────────────────────────────
  {
    id: "avail-board",
    audience: "student",
    topic: "Availability",
    question: "How do I check if a professor is in without signing in?",
    answer:
      "Open the availability board. It is public, needs no account, and shows every department's faculty with their status right now.",
    go: { ...goTo("student", "/availability"), label: "Open the availability board" },
    keywords: [
      "who is available", "check availability", "is my professor in", "board",
      "without signing in", "no account", "public", "free right now", "available now",
      "who is free", "see professors",
    ],
  },
  {
    id: "avail-meaning",
    audience: "student",
    topic: "Availability",
    question: "What do the availability statuses mean?",
    answer:
      "Available means they are in consultation hours and still have room today. Unavailable means they are outside those hours or have taken everyone they can. On Leave and In Meeting are set by the professor by hand.",
    keywords: [
      "status", "statuses", "colors", "colours", "green", "red", "what does available mean",
      "on leave", "in meeting", "unavailable meaning", "legend", "badge",
    ],
  },
  {
    id: "avail-slots-left",
    audience: "student",
    topic: "Availability",
    question: "What is the number on the department card?",
    answer:
      "It is how many professors in that department are free right now. Inside the department, each professor card shows how many consultations they have left for today.",
    keywords: [
      "number", "count", "badge number", "slots left", "how many left", "capacity",
      "department card", "what is the number", "remaining",
    ],
  },
  {
    id: "avail-live",
    audience: "student",
    topic: "Availability",
    question: "How current is the availability shown?",
    answer:
      "It is live. Status comes from the professor's own schedule and whatever they set today, and it is never served from an offline cache — so it is either current or it does not load at all.",
    keywords: [
      "live", "real time", "realtime", "how often", "updated", "refresh", "stale",
      "accurate", "current", "cached", "out of date",
    ],
  },

  // ── Request status ────────────────────────────────────────────────────────
  {
    id: "status-where",
    audience: "student",
    topic: "My requests",
    question: "Where do I see my professor's answer?",
    answer:
      "In the Inbox tab. A dot on the tab means something there is unread. Every request you have sent is listed with what became of it.",
    keywords: [
      "answer", "reply", "response", "where", "inbox", "did they accept",
      "check status", "my requests", "history", "notification", "dot", "badge",
    ],
  },
  {
    id: "status-meaning",
    audience: "student",
    topic: "My requests",
    question: "What do pending, accepted and declined mean?",
    answer:
      "Pending means your professor has not opened it yet. Accepted means yes, usually with a date and time. Declined means no this time. Cancelled means you withdrew it, and Done means the consultation was held.",
    keywords: [
      "pending", "accepted", "declined", "rejected", "done", "cancelled", "canceled",
      "archived", "what does pending mean", "status meaning", "approved",
    ],
  },
  {
    id: "status-waiting",
    audience: "student",
    topic: "My requests",
    question: "My request has been pending for a long time.",
    answer:
      "It sits in your professor's Requests tab until they answer it, and nothing expires it on its own. If it is urgent, cancel it and approach them in person or by email. The Dean's Office can also see every open request.",
    keywords: [
      "long time", "no answer", "still pending", "waiting", "not responding",
      "ignored", "how long", "days", "never answered", "stuck", "answered",
      "not answered", "has not answered", "no reply", "no response yet",
    ],
  },
  {
    id: "status-declined",
    audience: "student",
    topic: "My requests",
    question: "My request was declined. Can I send another?",
    answer:
      "Yes. A declined request frees the slot straight away, so you can send a new one to the same professor immediately. It helps to say more about what you need the second time.",
    keywords: [
      "declined", "rejected", "said no", "try again", "resend", "send another",
      "denied", "refused", "what now",
    ],
  },

  // ── Account and profile ───────────────────────────────────────────────────
  {
    id: "account-register",
    audience: "student",
    topic: "My account",
    question: "How do I register?",
    answer:
      "Open the student portal and choose Register. You will need your student number, full name, course, year level, department, email and a 4-digit PIN you choose.",
    go: { ...goTo("student", "/register"), label: "Register as a student" },
    keywords: [
      "register", "registration", "sign up", "signup", "create account", "new student",
      "enroll", "join", "first time",
    ],
  },
  {
    id: "account-change-pin",
    audience: "student",
    topic: "My account",
    question: "How do I change my PIN?",
    answer:
      "Profile tab, then change your PIN. You need your current PIN to set a new one — which is why a forgotten PIN has to be reset by the Dean's Office instead.",
    keywords: [
      "change pin", "update pin", "new pin", "change password", "security",
      "edit pin", "set a different pin",
    ],
  },
  {
    id: "account-photo",
    audience: "student",
    topic: "My account",
    question: "How do I change my photo or details?",
    answer:
      "Profile tab. You can update your photo, your course and your year level there. Your student number is fixed — ask the Dean's Office if it is wrong.",
    keywords: [
      "photo", "picture", "avatar", "profile", "change details", "edit profile",
      "course", "year level", "update info", "wrong name", "change name",
    ],
  },

  // ── Faculty ───────────────────────────────────────────────────────────────
  {
    id: "teacher-signin",
    audience: "teacher",
    topic: "Faculty",
    question: "How do I sign in as faculty?",
    answer:
      "Scan the QR code on your faculty ID card, or use your Employee ID with your 4-digit PIN. On a first QR sign-in you are asked to set that PIN before the dashboard opens.",
    go: { ...goTo("faculty", "/"), label: "Go to the faculty portal" },
    keywords: [
      "teacher login", "faculty login", "professor login", "employee id", "staff",
      "how do i sign in as teacher", "faculty portal", "my card",
      // The bare phrasing too: on the faculty portal, "how do I sign in" is
      // this question, and the page is what says so.
      "sign in", "log in", "login", "how to sign in",
    ],
  },
  {
    id: "teacher-answer",
    audience: "teacher",
    topic: "Faculty",
    question: "How do I accept or decline a request?",
    answer:
      "Requests tab. Accepting lets you set the date and time the student should come. Declining frees the slot at once, so they can send you a new one.",
    keywords: [
      "accept", "decline", "approve", "reject", "answer request", "respond",
      "requests tab", "queue", "student request", "set time",
    ],
  },
  {
    id: "teacher-schedule",
    audience: "teacher",
    topic: "Faculty",
    question: "How do I set my consultation hours?",
    answer:
      "Status & Schedule tab. Set the days and times you are in, and how many consultations you will take each day. Students see Available only inside those hours and only while you still have room.",
    keywords: [
      "schedule", "consultation hours", "set hours", "weekly", "availability",
      "my schedule", "slots", "daily limit", "capacity", "how many per day",
      "office hours", "change schedule",
    ],
  },
  {
    id: "teacher-manual-status",
    audience: "teacher",
    topic: "Faculty",
    question: "How do I mark myself On Leave or In Meeting?",
    answer:
      "Status & Schedule tab, set your status by hand. It overrides your weekly schedule until you put it back to Auto, which hands the decision to your schedule again.",
    keywords: [
      "on leave", "in meeting", "manual status", "override", "mark unavailable",
      "set status", "auto", "busy", "out of office", "sick",
    ],
  },
  {
    id: "teacher-done",
    audience: "teacher",
    topic: "Faculty",
    question: "What does marking a consultation Done do?",
    answer:
      "It closes the record once you have actually held the consultation. It still counts against today's capacity — a consultation you gave is not a slot you can give again.",
    keywords: [
      "done", "mark done", "complete", "finished", "close request", "after consultation",
      "held", "what does done mean",
    ],
  },

  // ── Dean's Office ─────────────────────────────────────────────────────────
  {
    id: "dean-signin",
    audience: "dean",
    topic: "Dean's Office",
    question: "How do I get into the Dean's Office dashboard?",
    answer:
      "Go to the Dean's Office sign-in and use the administrator username and password. There is one administrator account and it is set on the server, not from inside the app.",
    go: { ...goTo("admin", "/"), label: "Go to the Dean's Office" },
    keywords: [
      "dean", "admin", "administrator", "dean login", "dashboard", "office",
      "admin password", "who can access",
      "sign in", "log in", "login", "how to sign in",
    ],
  },
  {
    id: "dean-reset-pin",
    audience: "dean",
    topic: "Dean's Office",
    question: "How do I reset a student's or professor's PIN?",
    answer:
      "Students tab or Faculty tab, find the person, and clear their PIN. The next 4 digits they type when signing in become their new PIN, so tell them to sign in soon.",
    keywords: [
      "reset pin", "clear pin", "forgot pin student", "help student", "unlock",
      "reset password", "locked out student",
    ],
  },
  {
    id: "dean-cards",
    audience: "dean",
    topic: "Dean's Office",
    question: "How do I print ID cards or QR codes?",
    answer:
      "Credentials tab. It generates the login QR codes for students and faculty, ready to print onto cards.",
    keywords: [
      "card", "cards", "qr code", "print", "credentials", "id card", "generate qr",
      "badge", "new card",
    ],
  },
  {
    id: "dean-faculty",
    audience: "dean",
    topic: "Dean's Office",
    question: "How do I add or remove a professor?",
    answer:
      "Faculty tab. Adding needs their name, department and employee ID. Removing asks you to confirm, because their consultation history goes with them.",
    keywords: [
      "add faculty", "add teacher", "new professor", "remove teacher", "delete faculty",
      "hire", "resigned", "manage faculty", "roster",
    ],
  },
  {
    id: "dean-reports",
    audience: "dean",
    topic: "Dean's Office",
    question: "Where do I see overall consultation activity?",
    answer:
      "The Dashboard tab has the totals and charts, the Requests tab lists every request across all departments, and the Activity tab is the running log of what changed and who changed it.",
    keywords: [
      "report", "reports", "statistics", "stats", "analytics", "charts", "export",
      "overview", "activity", "audit", "log", "history", "totals",
    ],
  },

  // ── The app itself ────────────────────────────────────────────────────────
  {
    id: "app-install",
    audience: "app",
    topic: "The app",
    question: "How do I install this as an app?",
    answer:
      "Tap Install App in the top bar. On Android and desktop it installs straight away. On iPhone, tap Install App, then Share, then Add to Home Screen.",
    keywords: [
      "install", "app", "pwa", "home screen", "download", "phone", "android",
      "iphone", "ios", "add to home", "shortcut", "icon",
    ],
  },
  {
    id: "app-offline",
    audience: "app",
    topic: "The app",
    question: "Does it work without internet?",
    answer:
      "The app itself opens offline and an amber bar tells you so. Live information does not — faculty status and requests always come from the server, because a cached availability is worse than none.",
    keywords: [
      "offline", "no internet", "no wifi", "no connection", "data", "works offline",
      "amber bar", "disconnected", "signal",
    ],
  },
  {
    id: "app-update",
    audience: "app",
    topic: "The app",
    question: "It says a new version is available.",
    answer:
      "The app was updated while your tab was open. Press Reload when you are between things — it will not interrupt you on its own, which is deliberate during a consultation.",
    keywords: [
      "new version", "update", "reload", "refresh", "upgrade", "banner",
      "version available",
    ],
  },
  // ── How a consultation actually goes ──────────────────────────────────────
  // Not in the software at all, which is exactly why they get asked: the app
  // can say when to turn up, and a poster on a door cannot.
  {
    id: "rules-arrive",
    audience: "student",
    topic: "On the day",
    question: "When should I arrive for an accepted consultation?",
    answer:
      "A few minutes early, at the time your professor set in the Inbox tab. They are fitting you around classes, so a late arrival usually means the slot is gone.",
    keywords: [
      "arrive", "early", "late", "what time", "on the day", "turn up", "show up",
      "how early", "punctual", "be there",
    ],
  },
  {
    id: "rules-no-show",
    audience: "student",
    topic: "On the day",
    question: "What happens if I cannot make it?",
    answer:
      "Cancel it from the Inbox tab as soon as you know. The slot goes back to your professor and somebody else can take it. Not turning up without cancelling is the one thing that makes a professor slower to accept next time.",
    keywords: [
      "cannot make it", "cant make it", "miss", "missed", "no show", "not show up",
      "absent", "forgot to come", "forgot to attend", "skip", "reschedule",
      "move it", "change the time", "did not attend",
    ],
  },
  {
    id: "rules-group",
    audience: "student",
    topic: "On the day",
    question: "Can we book as a group?",
    answer:
      "The request is one student, because it is tied to your account. For a group, one of you sends the request and says in the purpose how many are coming, so your professor can plan the time.",
    keywords: [
      "group", "together", "friends", "classmates", "team", "thesis group",
      "more than one", "we", "partner", "groupmates",
    ],
  },
  {
    id: "rules-purpose",
    audience: "student",
    topic: "Booking",
    question: "What makes a good reason to write?",
    answer:
      "Say the subject and the specific thing you are stuck on. \"Consultation\" tells your professor nothing. \"I cannot get the Thevenin equivalent in problem set 3\" lets them bring the right material.",
    keywords: [
      "reason", "what to write", "purpose", "what should i say", "good reason",
      "valid", "example", "how to write", "message", "explain",
    ],
  },

  // ── Privacy ───────────────────────────────────────────────────────────────
  {
    id: "privacy-who-sees",
    audience: "student",
    topic: "Privacy",
    question: "Who can see my request and what I wrote?",
    answer:
      "The professor you sent it to, and the Dean's Office, which can see every request across all departments. Other students never see it, and neither do other professors.",
    keywords: [
      "who can see", "who sees", "private", "privacy", "confidential", "read",
      "other students", "visible", "who reads", "shared", "secret",
    ],
  },
  {
    id: "privacy-photo",
    audience: "student",
    topic: "Privacy",
    question: "Who can see my photo?",
    answer:
      "Only people who are signed in. The public availability board is served without any photos at all, so nobody browsing it can see faces.",
    keywords: [
      "photo", "picture", "face", "image", "who sees my photo", "profile picture",
      "public", "anyone see",
    ],
  },
  {
    id: "privacy-records",
    audience: "student",
    topic: "Privacy",
    question: "Are my old requests kept?",
    answer:
      "Yes. Cancelling or declining changes the status rather than deleting the record, so both you and your professor can see what happened. Ask the Dean's Office if something needs correcting.",
    keywords: [
      "kept", "history", "deleted", "delete", "record", "records", "stored",
      "how long", "erase", "remove my data", "old requests", "permanent",
    ],
  },

  // ── When something is wrong ───────────────────────────────────────────────
  {
    id: "trouble-stuck",
    audience: "app",
    topic: "Something is wrong",
    question: "A page is stuck loading or will not open.",
    answer:
      "Pull down to refresh first. If the amber offline bar is showing, the connection is the problem and the app will catch up on its own. If it persists, close the app fully and reopen it.",
    keywords: [
      "stuck", "loading", "spinner", "wont load", "not loading", "blank", "frozen",
      "hang", "slow", "broken", "white screen", "nothing happens", "crash",
    ],
  },
  {
    id: "trouble-notifications",
    audience: "student",
    topic: "Something is wrong",
    question: "I am not getting notified when my professor replies.",
    answer:
      "Answers appear on the Inbox tab with a dot on it, not as a phone notification. Open the app and check there. The dot clears once you have read it.",
    keywords: [
      "notification", "notifications", "notify", "alert", "not getting", "no dot",
      "badge", "push", "reply", "didnt know", "how will i know", "email me",
    ],
  },
  {
    id: "trouble-wrong-details",
    audience: "student",
    topic: "Something is wrong",
    question: "My department or course is wrong on my account.",
    answer:
      "Course and year level you can fix yourself on the Profile tab. Your student number and department are set when the account is made — ask the Dean's Office to change those.",
    keywords: [
      "wrong", "incorrect", "mistake", "department", "course", "year level",
      "wrong department", "wrong course", "change my department",
      "change my course", "fix my account", "wrong name", "typo",
    ],
  },

  {
    id: "app-help",
    audience: "app",
    topic: "The app",
    question: "Can you show me around?",
    answer:
      "Yes. Every dashboard has a guide in its top bar that walks you through the real screen, step by step. On the student side it opens a real department and a real request form and stops at the Send button, so nothing gets sent by accident.",
    keywords: [
      "tour", "guide", "walkthrough", "show me", "tutorial", "help", "how does this work",
      "first time", "lost", "confused", "onboarding",
    ],
  },
];

/**
 * Words people actually say, mapped to the words the entries are written in.
 *
 * Spoken questions especially: dictation returns "log in" as two words and
 * "sign-in" with a hyphen, and a student says "teacher" where the app says
 * "professor" roughly half the time.
 *
 * Only mappings that are safe in both directions are listed. "schedule" is not
 * here, for instance: folding it into "book" would make a professor asking
 * about their own consultation hours look exactly like a student booking one.
 */
const SYNONYMS = {
  login: "sign in", signin: "sign in", "log in": "sign in", logon: "sign in",
  password: "pin", passcode: "pin",
  teacher: "professor", prof: "professor", instructor: "professor",
  sir: "professor", maam: "professor", "ma'am": "professor",
  appointment: "consultation", consult: "consultation",
  booking: "book", reserve: "book",
  withdraw: "cancel",
  vacant: "available",
  cant: "cannot", "can't": "cannot", wont: "cannot", "won't": "cannot",
  doesnt: "cannot", "doesn't": "cannot", dont: "cannot", "don't": "cannot",
};

// Built once. The replacement runs over every keyword of every entry on every
// keystroke otherwise, which is a few thousand regex compilations per question.
const SYNONYM_RULES = Object.entries(SYNONYMS).map(([from, to]) => [
  new RegExp(`\\b${from}\\b`, "g"),
  to,
]);

/** Words too common to carry meaning; scoring them makes every entry match. */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "does",
  "for", "from", "get", "how", "i", "if", "in", "is", "it", "me", "my", "of", "on",
  "or", "so", "that", "the", "then", "there", "this", "to", "up", "was", "what",
  "when", "where", "which", "who", "why", "will", "with", "you", "your", "am",
  "please", "help", "need", "want", "would", "should", "could", "did", "have", "has",
]);

/** Lowercase, drop punctuation, expand the words people actually say. */
function normalize(text) {
  let s = String(text || "").toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, " ");
  for (const [pattern, to] of SYNONYM_RULES) s = s.replace(pattern, to);
  return s.replace(/\s+/g, " ").trim();
}

function tokens(text) {
  return normalize(text).split(" ").filter(w => w && !STOPWORDS.has(w));
}

// Each entry's keywords and question, normalized once at load rather than on
// every question asked.
// De-duplicated, because synonym expansion collapses several keywords onto
// one phrase -- "sign in", "signin", "login" and "log in" all become "sign in"
// -- and counting each of them scored that entry four times over, which no
// amount of context could then outweigh.
const INDEX = new Map(FAQ.map(entry => {
  const normalized = [...new Set(entry.keywords.map(normalize).filter(Boolean))];
  return [entry.id, {
    phrases: normalized.filter(k => k.includes(" ")),
    words: normalized.filter(k => !k.includes(" ")),
    question: tokens(entry.question),
  }];
}));

/**
 * How well one entry answers one question.
 *
 * A keyword phrase appearing whole is worth much more than its words appearing
 * scattered: "forgot pin" in a question about a forgotten PIN should beat an
 * entry that merely uses the words "pin" and "forgot" somewhere in its prose.
 */
function score(entry, asked, askedTokens) {
  const index = INDEX.get(entry.id);
  let total = 0;
  let phraseHit = false;
  const matched = new Set();

  // Multi-word keywords are phrases; only a whole-phrase hit counts.
  for (const phrase of index.phrases) {
    if (asked.includes(phrase)) {
      total += 6 + phrase.split(" ").length;
      phraseHit = true;
    }
  }
  for (const word of index.words) {
    if (askedTokens.includes(word)) {
      total += 3;
      matched.add(word);
    }
  }

  // The entry's own question, so a near-verbatim ask lands on it even when the
  // keyword list missed that phrasing.
  for (const t of askedTokens) {
    if (index.question.includes(t)) {
      total += 2;
      matched.add(t);
    }
  }

  // One shared word out of a long question is a coincidence, not a match:
  // "I was walking to the app building" is not a question about installing the
  // app. Counting distinct words rather than points is what makes this hold —
  // a single word that happens to be both a keyword and in the question scores
  // 5, which any flat threshold has to let through.
  if (!phraseHit && matched.size < 2 && askedTokens.length >= 4) return 0;

  return total;
}

/**
 * Best answers for a question, strongest first.
 *
 * Returns at most `limit`. An empty array means Navi should say it does not
 * know rather than offer its least-bad guess — a confidently wrong answer
 * about a PIN reset costs more than an admission.
 *
 * The entries after the first are offered as "did you mean", so they are held
 * to a relative bar: at least half the leader's score. Without it, "how do I
 * book a consultation" is answered correctly and then followed by every other
 * entry containing the word "consultation", which reads as Navi not being sure.
 * A weak alternative is worse than none.
 */
const RUNNER_UP_RATIO = 0.5;

/**
 * Which audience the reader is plainly acting as, from the page they are on.
 *
 * "How do I sign in?" is one question with three answers, and the screen the
 * reader is looking at settles which one they meant far more reliably than the
 * words do. Somebody on /teacher is not asking about student registration.
 *
 * A nudge, not an override: it breaks ties and lifts a close second, and it is
 * never enough on its own to beat a strong match from another audience. A
 * professor on their own dashboard may well be asking what their students see.
 */
export function audienceForApp(app = THIS_APP) {
  if (app === "faculty") return "teacher";
  if (app === "admin") return "dean";
  if (app === "student") return "student";
  return null;
}

const CONTEXT_BONUS = 1.35;

export function askNavi(question, { limit = 3, app = THIS_APP } = {}) {
  const asked = normalize(question);
  if (asked.length < 2) return [];
  const askedTokens = tokens(question);
  if (!askedTokens.length) return [];

  // The student app carries the public pages too, and the overwhelming
  // majority of people on them are students, so that is the standing
  // assumption — and the right one for a reader Navi knows nothing else about.
  const here = audienceForApp(app) || "student";

  const ranked = FAQ
    .map(entry => {
      const base = score(entry, asked, askedTokens);
      // "app" entries are true everywhere, so they are never demoted by being
      // on somebody else's page.
      const boosted = here && entry.audience === here ? base * CONTEXT_BONUS : base;
      return { entry, score: boosted };
    })
    .filter(hit => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));

  if (!ranked.length) return [];

  const floor = ranked[0].score * RUNNER_UP_RATIO;
  return ranked
    .filter((hit, i) => i === 0 || hit.score >= floor)
    .slice(0, limit)
    .map(hit => hit.entry);
}

/** The entries grouped by audience, for the topic chips in the panel. */
export function faqByAudience() {
  return Object.keys(AUDIENCES).map(audience => ({
    audience,
    label: AUDIENCES[audience],
    entries: FAQ.filter(e => e.audience === audience),
  }));
}

/**
 * What the panel offers before anything has been asked.
 *
 * Six, not thirty: a wall of questions is read by nobody. These are the ones
 * that come up most, weighted towards the things somebody cannot work out for
 * themselves by looking at the screen.
 */
export const STARTERS = [
  "How do I request a consultation?",
  "I forgot my PIN",
  "Where do I see my professor's answer?",
  "What do the availability statuses mean?",
  "How do I install this as an app?",
  "Can you show me around?",
];
