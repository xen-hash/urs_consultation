/**
 * Taking somebody to the screen they just asked for.
 *
 * The FAQ in navi-faq.js explains how the system works, and navi-live.js says
 * what is true in it right now. This is the third kind of question, and it is
 * the one people ask most in a corridor: "open the student login page". That
 * is not a question at all — it is an instruction, and the only right answer
 * to it is the page itself.
 *
 * Before this, the FAQ answered "how do I sign in as a student" with a
 * paragraph and a button underneath, which is correct for somebody asking how
 * it works and one tap too many for somebody asking to be let in. So the two
 * readings are kept apart rather than merged:
 *
 *   "How do I sign in as a student?"   explain it, offer the button.
 *   "Open the student sign-in."        go there.
 *
 * What separates them is one rule: a question is an instruction when it holds
 * the name of a screen and nothing else except go-words and filler. "Open the
 * student login page" is a go-word, a name and two filler words, so it goes.
 * "Where do I see my professor's answer?" holds a name — professor — and then
 * the words "see" and "answer", which carry a question, so it does not. Every
 * word that survives has to be one nobody needs an answer to.
 *
 * That is stricter than looking for a go-word, and deliberately: "show me my
 * professor's schedule" begins with one and is a question about a person, not
 * a request to be moved. Getting that wrong yanks the page out from under
 * somebody mid-sentence, which is the failure worth paying for.
 *
 * Every screen in the app is listed here, including the tabs inside the three
 * dashboards: a tab is where a job actually gets done, and "open my inbox"
 * should land on the Inbox, not on the dashboard it lives in. The dashboards
 * read the tab from the URL hash — see the `hash` field below.
 *
 * The wording of `say` is read aloud, like every other answer, so it is plain
 * sentences with no markdown and no links inside them.
 */

import { audienceForPath } from "./navi-faq.js";

// ── Reading the question ─────────────────────────────────────────────────────

/**
 * Words that turn a name into an instruction.
 *
 * "Show me" is in here and "show me around" is not a trip: it names no screen,
 * so nothing matches and the tour answer in the FAQ keeps it.
 */
const GO_WORDS = [
  "open", "go to", "goto", "go back to", "back to", "take me", "bring me",
  "send me", "get me to", "redirect", "navigate", "show me", "launch", "visit",
  "jump to", "switch to", "head to", "head over", "pull up", "bring up",
  "let me", "i want to go", "i need to go", "can i go", "where is",
  "where do i", "where can i", "how do i get to", "how can i get to",
  "direct me",
];

/**
 * Words left over after a screen has been named that still mean "just that".
 *
 * "Page", "screen" and "tab" are in here because the phrases below are written
 * without them: "student sign in" is what matches inside "the student sign in
 * page", and the leftover word must not be read as a second subject.
 */
const FILLER = new Set([
  "the", "a", "an", "my", "me", "i", "to", "for", "of", "on", "in", "at",
  "this", "that", "it", "its", "please", "now", "then", "and", "or", "just",
  "page", "pages", "screen", "window", "view", "section", "tab", "site", "app",
  "want", "wanna", "need", "like", "can", "you", "would", "could", "will",
  "kindly", "url", "link", "here", "there", "find", "form",
]);

/** Spoken and typed wordings folded onto the words the list below uses. */
const SAME = [
  [/\blog ?in\b/g, "sign in"], [/\bsignin\b/g, "sign in"], [/\blogon\b/g, "sign in"],
  [/\blog ?on\b/g, "sign in"], [/\bsign ?on\b/g, "sign in"],
  [/\blog ?out\b/g, "sign out"], [/\bsignout\b/g, "sign out"],
  [/\bprofessors?\b/g, "teacher"], [/\bprofs?\b/g, "teacher"],
  [/\binstructors?\b/g, "teacher"], [/\bfaculty\b/g, "teacher"],
  [/\bteachers\b/g, "teacher"], [/\bstaff\b/g, "teacher"],
  [/\badministrators?\b/g, "dean"], [/\badmin\b/g, "dean"], [/\bdeans\b/g, "dean"],
  [/\bstudents\b/g, "student"],
  [/\bregistration\b/g, "register"], [/\bsign ?up\b/g, "register"],
  [/\bsignup\b/g, "register"], [/\benroll?\b/g, "register"],
  [/\bhomepage\b/g, "home page"], [/\bdash\b/g, "dashboard"],
  [/\bappointments?\b/g, "consultation"], [/\bavailabilities\b/g, "availability"],
];

/** Lowercase, drop punctuation and apostrophes, fold the synonyms in. */
export function normalize(text) {
  let s = String(text || "").toLowerCase().replace(/['’]/g, "");
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " ");
  for (const [pattern, to] of SAME) s = s.replace(pattern, to);
  return s.replace(/\s+/g, " ").trim();
}

// ── Where there is to go ─────────────────────────────────────────────────────

/**
 * One screen, in the words people use for it.
 *
 * `hash` is a tab inside a dashboard, carried in the URL so the dashboard can
 * open on it. `needs` is the role the screen belongs to; asking for one while
 * signed out sends the reader to that role's sign-in instead of to a page that
 * would only bounce them. `phrases` are matched whole, longest first, so
 * "student dashboard" wins over the bare "dashboard".
 */
export const DESTINATIONS = [
  {
    id: "home",
    to: "/",
    label: "Open the home page",
    say: "Here is the home page.",
    phrases: ["home page", "landing", "front page", "main page", "start page", "home"],
  },

  // ── Students ──────────────────────────────────────────────────────────────
  {
    id: "student-signin",
    to: "/student",
    label: "Open the student sign-in",
    say: "Here is the student sign-in. Scan your card, or tap Enter ID and type your student number.",
    phrases: [
      "student sign in", "student portal", "student side", "sign in as a student",
      "sign in as student", "student log", "student", "scan my student card",
    ],
  },
  {
    id: "student-register",
    to: "/student/register",
    label: "Open student registration",
    say: "Here is the registration form. It needs your name, course, year level, department and email.",
    phrases: [
      "student register", "register as a student", "register", "new account",
      "create an account", "make an account", "registration form",
    ],
  },
  {
    id: "student-dashboard",
    to: "/student/dashboard",
    // The tab a bare "open my dashboard" means is the one it opens on. Naming
    // it puts somebody who is three tabs deep back at the front, which is what
    // asking for the dashboard by name is asking for.
    hash: "home",
    needs: "student",
    label: "Open your dashboard",
    say: "Here is your dashboard.",
    gate: "Your dashboard is behind a sign-in. Here is the student sign-in.",
    phrases: ["student dashboard", "student home"],
  },
  {
    id: "student-faculty",
    to: "/student/dashboard",
    hash: "home",
    needs: "student",
    label: "Open the Faculty tab",
    say: "Here is the Faculty tab. Pick your department, then the professor you want to see.",
    gate: "The Faculty tab is behind a sign-in. Here is the student sign-in.",
    phrases: [
      "department list", "departments", "book a consultation",
      "request a consultation", "request form", "make a request", "send a request",
    ],
  },
  {
    id: "student-inbox",
    to: "/student/dashboard",
    hash: "inbox",
    needs: "student",
    label: "Open your Inbox",
    say: "Here is your Inbox. Your professor's answer shows up on this tab.",
    gate: "Your Inbox is behind a sign-in. Here is the student sign-in.",
    phrases: ["inbox", "my requests", "request history", "my consultation"],
  },
  {
    id: "student-profile",
    to: "/student/dashboard",
    hash: "profile",
    needs: "student",
    label: "Open your Profile",
    say: "Here is your Profile tab. Your photo, course and year level are changed here.",
    gate: "Your Profile is behind a sign-in. Here is the student sign-in.",
    phrases: ["student profile", "my details", "my id card", "change my pin"],
  },

  // ── Faculty ───────────────────────────────────────────────────────────────
  {
    id: "teacher-signin",
    to: "/teacher",
    label: "Open the faculty sign-in",
    say: "Here is the faculty sign-in. Scan your ID card, or use your Employee ID and PIN.",
    phrases: [
      "teacher sign in", "teacher portal", "teacher side", "sign in as a teacher",
      "sign in as teacher", "teacher log", "employee sign in", "teacher",
    ],
  },
  {
    id: "teacher-dashboard",
    to: "/teacher/dashboard",
    hash: "requests",
    needs: "teacher",
    label: "Open your dashboard",
    say: "Here is your dashboard.",
    gate: "The faculty dashboard is behind a sign-in. Here is the faculty sign-in.",
    phrases: ["teacher dashboard", "teacher home"],
  },
  {
    id: "teacher-requests",
    to: "/teacher/dashboard",
    hash: "requests",
    needs: "teacher",
    label: "Open your Requests",
    say: "Here is your Requests tab. Accepting one lets you set the date and time.",
    gate: "The Requests tab is behind a sign-in. Here is the faculty sign-in.",
    phrases: ["my queue", "student requests", "pending requests"],
  },
  {
    id: "teacher-status",
    to: "/teacher/dashboard",
    hash: "status",
    needs: "teacher",
    label: "Open Status & Schedule",
    say: "Here is Status and Schedule. Your consultation hours, your daily limit and your status are set here.",
    gate: "Status and Schedule is behind a sign-in. Here is the faculty sign-in.",
    phrases: [
      "status and schedule", "status schedule", "status tab", "schedule tab",
      "my schedule", "my consultation hours", "my office hours", "set my status",
    ],
  },
  {
    id: "teacher-profile",
    to: "/teacher/dashboard",
    hash: "profile",
    needs: "teacher",
    label: "Open your Profile",
    say: "Here is your Profile and ID tab.",
    gate: "Your Profile is behind a sign-in. Here is the faculty sign-in.",
    phrases: ["teacher profile", "my profile and id"],
  },

  // ── Dean's Office ─────────────────────────────────────────────────────────
  {
    id: "dean-signin",
    to: "/dean",
    label: "Open the Dean's Office sign-in",
    say: "Here is the Dean's Office sign-in. It takes the administrator username and password.",
    phrases: [
      "dean sign in", "dean office", "dean portal", "dean side", "dean log",
      "sign in as dean", "dean",
    ],
  },
  {
    id: "dean-dashboard",
    to: "/dean/dashboard",
    hash: "overview",
    needs: "admin",
    label: "Open the Dean's Office dashboard",
    say: "Here is the Dean's Office dashboard.",
    gate: "The Dean's Office dashboard is behind a sign-in. Here is where to sign in.",
    phrases: ["dean dashboard", "dean office dashboard", "dean overview"],
  },
  {
    id: "dean-credentials",
    to: "/dean/dashboard",
    hash: "credentials",
    needs: "admin",
    label: "Open Credentials",
    say: "Here is the Credentials section, where cards are issued and revoked.",
    gate: "Credentials is behind a sign-in. Here is the Dean's Office sign-in.",
    phrases: ["credentials", "issue a card", "revoke a card", "qr codes"],
  },
  {
    id: "dean-faculty",
    to: "/dean/dashboard",
    hash: "faculty",
    needs: "admin",
    label: "Open the Faculty section",
    say: "Here is the Faculty section.",
    gate: "The Faculty section is behind a sign-in. Here is the Dean's Office sign-in.",
    phrases: ["manage teacher", "add a teacher", "remove a teacher"],
  },
  {
    id: "dean-students",
    to: "/dean/dashboard",
    hash: "students",
    needs: "admin",
    label: "Open the Students section",
    say: "Here is the Students section.",
    gate: "The Students section is behind a sign-in. Here is the Dean's Office sign-in.",
    phrases: ["student section", "student list", "manage student", "verify a student"],
  },
  {
    id: "dean-requests",
    to: "/dean/dashboard",
    hash: "requests",
    needs: "admin",
    label: "Open the Requests section",
    say: "Here is every request, across all departments.",
    gate: "The Requests section is behind a sign-in. Here is the Dean's Office sign-in.",
    phrases: ["all requests", "every request", "requests section"],
  },
  {
    id: "dean-activity",
    to: "/dean/dashboard",
    hash: "activity",
    needs: "admin",
    label: "Open the Activity log",
    say: "Here is the Activity log.",
    gate: "The Activity log is behind a sign-in. Here is the Dean's Office sign-in.",
    phrases: ["activity log", "audit log", "activity", "audit"],
  },

  // ── Open to everyone ──────────────────────────────────────────────────────
  {
    id: "availability",
    to: "/availability",
    label: "Open the availability board",
    say: "Here is the availability board. It shows who is free right now, department by department.",
    phrases: [
      "availability board", "availability", "the board", "consultation board",
      "public board", "status board", "who is free board", "board",
    ],
  },
];

const BY_ID = new Map(DESTINATIONS.map(d => [d.id, d]));

/**
 * Names that mean a different screen depending on who is asking.
 *
 * "My dashboard" is three screens. The reader's own session answers it when
 * there is one; otherwise the page they are standing on does, because somebody
 * typing "open my dashboard" on the faculty portal is faculty.
 */
const BY_ROLE = [
  {
    phrases: ["my dashboard", "dashboard", "my portal"],
    roles: { student: "student-dashboard", teacher: "teacher-dashboard", admin: "dean-dashboard" },
  },
  {
    phrases: ["sign in", "sign in form"],
    roles: { student: "student-signin", teacher: "teacher-signin", admin: "dean-signin" },
  },
  {
    phrases: ["my profile", "profile"],
    roles: { student: "student-profile", teacher: "teacher-profile", admin: "dean-dashboard" },
  },
  {
    phrases: ["my inbox", "requests tab", "requests", "my pending"],
    roles: { student: "student-inbox", teacher: "teacher-requests", admin: "dean-requests" },
  },
  {
    // A card and a scanner are on both sign-ins, and are the Credentials
    // section at the Dean's Office, which is where cards come from.
    phrases: ["qr scanner", "scan my card", "scan qr", "scan my id", "qr code"],
    roles: { student: "student-signin", teacher: "teacher-signin", admin: "dean-credentials" },
  },
  {
    // The word is on all three screens and means a different one on each: the
    // student's list of professors, the Dean's Office roster, and — for a
    // professor, who is the faculty — their own dashboard.
    phrases: ["teacher tab", "teacher list", "teacher section", "list of teacher"],
    roles: { student: "student-faculty", teacher: "teacher-dashboard", admin: "dean-faculty" },
  },
];

/** The role the reader is acting as: their session first, then the page. */
function readerRole(role, pathname) {
  if (role) return role;
  const here = audienceForPath(pathname);
  return here === "dean" ? "admin" : here || "student";
}

// Built once, at load. Word boundaries matter: "board" must not match inside
// "boarding", and "dean" must not match inside "deanery".
const boundary = phrase => new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`);

// Phrases go through the same normalizer the question does, so a list written
// in ordinary words — "registration form" — still matches a question the
// synonyms have rewritten as "register form".
const candidate = (phrase, extra) => {
  const normalized = normalize(phrase);
  return { phrase: normalized, test: boundary(normalized), ...extra };
};

const CANDIDATES = [
  ...DESTINATIONS.flatMap(d => d.phrases.map(p => candidate(p, { id: d.id }))),
  ...BY_ROLE.flatMap(g => g.phrases.map(p => candidate(p, { roles: g.roles }))),
].sort((a, b) => b.phrase.length - a.phrase.length);

// Longest first, for the same reason the names are: stripping "where do i"
// out of "where do i find the board" leaves a "find" that reads as a question.
const GO_TESTS = [...GO_WORDS]
  .map(normalize)
  .sort((a, b) => b.length - a.length)
  .map(boundary);

/**
 * Whether what is left, once the screen has been named, is asking for anything.
 *
 * Typing "student login page" into the box is an instruction as plainly as
 * "open the student login page" is, and people type the short one — so a
 * go-word is not required, only allowed. What has to hold either way is that
 * nothing else in the question carries a question: "what does the availability
 * board mean" keeps "what", "does" and "mean", and belongs to the FAQ.
 */
function isRequestToGo(asked, phrase) {
  let rest = asked.replace(boundary(phrase), " ");
  for (const test of GO_TESTS) rest = rest.replace(test, " ");
  return rest.split(/\s+/).filter(Boolean).every(word => FILLER.has(word));
}

/**
 * The screen a question is asking to be taken to, or null for "not a trip".
 *
 * Null is the common answer and the important one: a question that only
 * mentions a screen is a question about it, and belongs to the FAQ.
 */
export function matchDestination(question, { pathname = "", role = null } = {}) {
  const asked = normalize(question);
  if (!asked) return null;

  const hit = CANDIDATES.find(c => c.test.test(asked));
  if (!hit || !isRequestToGo(asked, hit.phrase)) return null;

  if (!hit.roles) return BY_ID.get(hit.id) || null;
  return BY_ID.get(hit.roles[readerRole(role, pathname)]) || null;
}

/** Where a role signs in, for a screen asked for while signed out. */
const GATEWAY = { student: "student-signin", teacher: "teacher-signin", admin: "dean-signin" };

/**
 * The trip itself: the address, what Navi says on the way, and the label for
 * the button that repeats it.
 *
 * A screen the reader is not signed in for is not refused — it is answered
 * with the sign-in that leads to it, because that is the next thing they have
 * to do either way.
 */
export function resolveDestination(dest, role = null) {
  if (!dest) return null;

  if (dest.needs && role !== dest.needs) {
    const gate = BY_ID.get(GATEWAY[dest.needs]);
    return { id: gate.id, to: gate.to, label: gate.label, text: dest.gate };
  }

  return {
    id: dest.id,
    to: dest.hash ? `${dest.to}#${dest.hash}` : dest.to,
    label: dest.label,
    text: dest.say,
  };
}

/** Both halves at once, which is all the panel ever needs. */
export function navigationFor(question, { pathname = "", role = null } = {}) {
  return resolveDestination(matchDestination(question, { pathname, role }), role);
}

/** The tab ids a dashboard accepts from the URL, for the dashboards to check. */
export function tabsFor(prefix) {
  return [...new Set(DESTINATIONS.filter(d => d.hash && d.to === prefix).map(d => d.hash))];
}
