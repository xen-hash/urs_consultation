/**
 * Questions Navi answers from the database rather than from a written answer.
 *
 * The FAQ in navi-faq.js explains how the system works. This answers questions
 * about what is true in it right now — who is free, what happened to a request,
 * how many people are waiting on a professor. "Who is available?" deserves the
 * list, not a paragraph explaining where the list lives.
 *
 * Everything here reads endpoints the signed-in reader is already entitled to,
 * with their own session. Navi has no privileges of its own: a student asking
 * about "my requests" gets their own requests because the server checks the
 * token, and a question about somebody else's inbox has nowhere to go.
 *
 * Matching is deliberately narrow. A question that is only probably about live
 * data should fall through to the FAQ, because a wrong live answer states a
 * fact about a named professor and a wrong FAQ answer merely explains the
 * wrong feature.
 */

import api from "../httpClient.js";

import { currentRole, getSession } from "../auth.js";
import { DAY_LABELS, DAYS } from "../constants.js";

/**
 * How long a live answer may take before Navi admits it does not know.
 *
 * The shared client waits ninety seconds and retries three times, because a
 * dashboard whose panels are empty is worth waiting out a sleeping backend
 * for. A question in a help bubble is not: nobody watches "Checking…" for
 * sixteen seconds and concludes the software is being thorough. So these calls
 * opt out of the retries and give up quickly, and the answer says where to go
 * instead.
 */
const LIVE_TIMEOUT_MS = 8000;
const FAST = { timeout: LIVE_TIMEOUT_MS, __noRetry: true };

/** Lowercase, strip punctuation, collapse spaces. */
const norm = t => String(t || "").toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

const has = (q, ...words) => words.some(w => q.includes(w));

/** "3 professors" / "1 professor" — saying "1 professors" undoes the trust. */
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ── Reading the board ────────────────────────────────────────────────────────

const allProfessors = board =>
  (board || []).flatMap(d => (d?.professors || []).map(p => ({
    ...p, department: p?.department || d?.department,
  })));

/**
 * Find the department a question names.
 *
 * Matches on the short word people actually say — "civil", "computer" — rather
 * than the full "Civil Engineering Department", which nobody types.
 */
function matchDepartment(question, board) {
  const q = norm(question);
  for (const dept of board || []) {
    const full = norm(dept?.department);
    if (!full) continue;
    const short = full.replace(/ engineering department| department/g, "").trim();
    if (short && q.includes(short)) return dept;
  }
  return null;
}

/**
 * Titles, which are on every name and identify nobody.
 *
 * Without this, "engr" matches the entire roster, and so does any question
 * that happens to contain the word.
 */
const TITLES = new Set([
  "engr", "engineer", "prof", "professor", "dr", "doc", "doctor", "sir",
  "maam", "ma", "mr", "mrs", "ms", "atty", "arch",
]);

const nameParts = name => norm(name).split(" ")
  .filter(w => w.length > 2 && !TITLES.has(w));

/**
 * Find the professor a question names.
 *
 * Surnames, because a question says "is santos free" rather than "is Engr.
 * Juan Santos free". Matches are scored by how much of the name they account
 * for, and only the best-scoring professors are returned: "dela cruz" matches
 * both Dela Cruz and Cruz, but it matches Dela Cruz twice as well, and that is
 * plainly who was meant.
 *
 * A genuine tie is left as a tie. Answering about the wrong Cruz sends
 * somebody to the wrong office, which is worse than admitting the ambiguity.
 */
function matchProfessors(question, board) {
  const q = norm(question);
  const scored = allProfessors(board)
    .map(p => ({
      p,
      hits: nameParts(p?.name).filter(part => new RegExp(`\\b${part}\\b`).test(q)).length,
    }))
    .filter(x => x.hits > 0);

  if (!scored.length) return [];

  const best = Math.max(...scored.map(x => x.hits));
  const winners = scored.filter(x => x.hits === best).map(x => x.p);
  // De-duplicate: the same professor can appear under two departments.
  return [...new Map(winners.map(p => [p.name + p.department, p])).values()];
}

const statusWord = p => {
  if (p.status === "Available") return "free now";
  if (p.manual_status) return p.manual_status.toLowerCase();
  return "not free right now";
};

/** "Mon 9:00 AM-11:00 AM, Wed 1:00 PM-3:00 PM", or null if none is set. */
function describeSchedule(weekly) {
  if (!weekly || typeof weekly !== "object") return null;
  const parts = [];
  for (const day of DAYS) {
    const entry = weekly[day];
    if (!entry) continue;
    const slots = Array.isArray(entry?.slots) ? entry.slots
      : entry?.start && entry?.end ? [{ start: entry.start, end: entry.end }]
      : [];
    const times = slots
      .filter(s => s?.start && s?.end)
      .map(s => `${s.start}-${s.end}`)
      .join(", ");
    if (times) parts.push(`${DAY_LABELS[day]} ${times}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

// ── The answers ──────────────────────────────────────────────────────────────

const BOARD = { to: "/availability", label: "Open the availability board" };

function answerAvailability(question, board) {
  const named = matchProfessors(question, board);

  // "is santos free"
  if (named.length === 1) {
    const p = named[0];
    const free = p.status === "Available";
    const slots = typeof p.slots_left === "number" && p.slots_left >= 0
      ? ` ${plural(p.slots_left, "consultation")} left today.`
      : "";
    return {
      text: `${p.name} is ${statusWord(p)}.${free ? slots : ""}`,
      go: BOARD,
    };
  }
  if (named.length > 1) {
    return {
      text: `More than one professor matches that name: ${named.map(p => p.name).join(", ")}. `
          + "The board lists them by department.",
      go: BOARD,
    };
  }

  // "anyone free in computer engineering"
  const dept = matchDepartment(question, board);
  const pool = dept ? allProfessors([dept]) : allProfessors(board);
  const where = dept ? ` in ${dept.department}` : "";
  const free = pool.filter(p => p.status === "Available");

  if (!pool.length) return null;

  if (!free.length) {
    return { text: `Nobody is free${where} right now.`, go: BOARD };
  }

  // Naming a few beats a bare number: it is the next thing they would ask.
  const names = free.slice(0, 4).map(p => p.name).join(", ");
  const more = free.length > 4 ? `, and ${free.length - 4} more` : "";
  return {
    text: `${plural(free.length, "professor")} free${where} right now, `
        + `out of ${pool.length}: ${names}${more}.`,
    go: BOARD,
  };
}

function answerSchedule(question, board) {
  const named = matchProfessors(question, board);
  if (named.length !== 1) return null;
  const p = named[0];
  const when = describeSchedule(p.weekly_schedule);
  if (!when) {
    return {
      text: `${p.name} has not published consultation hours. `
          + `Right now they are ${statusWord(p)}.`,
      go: BOARD,
    };
  }
  return { text: `${p.name} holds consultations ${when}.`, go: BOARD };
}

function answerSlotsLeft(question, board) {
  const named = matchProfessors(question, board);
  if (named.length !== 1) return null;
  const p = named[0];
  if (typeof p.slots_left !== "number") {
    return {
      text: `${p.name} has not set a daily limit, so there is no cap to run out. `
          + `They are ${statusWord(p)}.`,
      go: BOARD,
    };
  }
  if (p.slots_left === 0) {
    return {
      text: `${p.name} has taken all ${p.day_limit} consultations for today. `
          + "Try tomorrow, or another professor.",
      go: BOARD,
    };
  }
  return {
    text: `${p.name} has ${plural(p.slots_left, "consultation")} left today, `
        + `out of ${p.day_limit}.`,
    go: BOARD,
  };
}

const STATUS_WORDING = {
  pending: "still waiting for an answer",
  accepted: "accepted",
  declined: "declined",
  cancelled: "cancelled by you",
  done: "already held",
  archived: "closed",
};

/** Both endpoints answer differently: the history is paged, the queue is not. */
const rowsOf = payload =>
  Array.isArray(payload) ? payload : (payload?.data || payload?.requests || []);

function answerMyRequests(payload) {
  const list = rowsOf(payload);
  if (!list.length) {
    return {
      text: "You have not sent any consultation requests yet.",
      go: { to: "/student/dashboard", label: "Open your dashboard" },
    };
  }

  const open = list.filter(r => ["pending", "accepted"].includes(r.status));
  const newest = open[0] || list[0];
  // The appointment is two columns: a DATE and a time string. Either may be
  // missing on an acceptance that did not name a slot.
  const when = [newest.appointment_date, newest.appointment_time]
    .filter(Boolean).join(" at ") || null;

  const lead = open.length
    ? `You have ${plural(open.length, "open request")}.`
    : `Nothing open. Your last request was ${STATUS_WORDING[newest.status] || newest.status}.`;

  const detail = `The most recent is with ${newest.professor_name}, `
    + `${STATUS_WORDING[newest.status] || newest.status}`
    + (newest.status === "accepted" && when ? ` for ${when}` : "")
    + ".";

  return {
    text: `${lead} ${detail}`,
    go: { to: "/student/dashboard", label: "Open your inbox" },
  };
}

function answerTeacherQueue(payload) {
  const pending = rowsOf(payload).filter(r => r.status === "pending");
  if (!pending.length) {
    return {
      text: "Nobody is waiting on you — there are no unanswered requests.",
      go: { to: "/teacher/dashboard", label: "Open your dashboard" },
    };
  }
  const names = pending.slice(0, 4).map(r => r.student_name || r.student_id).join(", ");
  const more = pending.length > 4 ? `, and ${pending.length - 4} more` : "";
  return {
    text: `${plural(pending.length, "student is", "students are")} waiting for an answer: ${names}${more}.`,
    go: { to: "/teacher/dashboard", label: "Open your requests" },
  };
}

// ── Working out which question was asked ─────────────────────────────────────

/**
 * Which live answer a question is asking for, or null for "not a live one".
 *
 * Order matters: "how many slots does santos have left" mentions both a
 * professor and availability, and the more specific reading is the right one.
 */
export function classify(question) {
  const q = norm(question);
  if (!q) return null;

  // Asked before anything else, because these questions contain the same words
  // as the live ones and mean something completely different. "Who can see my
  // request" is about who is allowed to read it, not about what became of it,
  // and answering it with a status is answering a different question.
  if (has(q, "who can see", "who sees", "who can view", "who can read",
    "who reads", "can see my", "private", "confidential", "visible to",
    "allowed to see", "is it kept", "are records"))
    return null;

  // "How do I cancel my request" is asking to be shown the way, not told the
  // status. Procedure questions belong to the FAQ even when they name the
  // same things the live answers read. "How many" is excluded from this,
  // because that genuinely is a question about the data.
  if (has(q, "how do i", "how can i", "how do you", "how to ", "where do i",
    "where can i", "how does"))
    return null;

  const mine = has(q, "my request", "my requests", "my consultation", "did my",
    "my professor reply", "my professor replied", "what happened to my",
    "my booking", "my appointment", "status of my");
  if (mine) return "my-requests";

  if (has(q, "waiting on me", "waiting for me", "who is waiting", "whos waiting",
    "my queue", "my pending", "requests for me", "how many are waiting"))
    return "teacher-queue";

  if (has(q, "slot", "slots left", "how many left", "still book", "can i still",
    "full today", "any slots")) return "slots-left";

  if (has(q, "schedule", "consultation hours", "office hours", "what time",
    "what days", "when is", "when does")) return "schedule";

  if (has(q, "available", "free", "who is in", "whos in", "anyone in",
    "is anyone", "who can i see", "in right now", "on campus"))
    return "availability";

  return null;
}

/**
 * Answer a live question, or return null to let the FAQ handle it.
 *
 * Returns `{ text, go }`. Never throws: the panel has to keep working when the
 * backend does not, and "I could not reach the system" is itself an answer.
 */
export async function askLive(question) {
  const kind = classify(question);
  if (!kind) return null;

  try {
    if (kind === "my-requests") {
      const student = getSession("student");
      if (!student) {
        return {
          text: "Sign in as a student and I can tell you what happened to your requests.",
          go: { to: "/student", label: "Sign in" },
        };
      }
      const { data } = await api.get(`/consultation/history/${student.student_id}`, FAST);
      return answerMyRequests(data);
    }

    if (kind === "teacher-queue") {
      const teacher = getSession("teacher");
      if (!teacher) {
        return currentRole() === "student"
          // A student asking "who is waiting" means the board, not a queue.
          ? null
          : {
            text: "Sign in as faculty and I can tell you who is waiting on you.",
            go: { to: "/teacher", label: "Sign in" },
          };
      }
      const { data } = await api.get(`/teacher/requests/${teacher.employee_id}`, FAST);
      return answerTeacherQueue(data);
    }

    // The rest all come from the public board, in one request.
    const { data: board } = await api.get("/teacher-logs", FAST);
    if (kind === "schedule") return answerSchedule(question, board) || answerAvailability(question, board);
    if (kind === "slots-left") return answerSlotsLeft(question, board) || answerAvailability(question, board);
    return answerAvailability(question, board);
  } catch {
    return {
      // Deliberately mentions waking: this gives up after eight seconds, and
      // the backend sleeps when nobody has used it, so "not answering" and
      // "still getting up" look identical from here and the board is the
      // thing that waits patiently.
      text: "I could not reach the system just now — it may still be waking up. "
          + "The board will show who is free once it answers.",
      go: BOARD,
    };
  }
}

// Exported for tests: these are claims about real people, so the wording and
// the counting are worth pinning down.
export const _internals = {
  answerAvailability, answerSchedule, answerSlotsLeft,
  answerMyRequests, answerTeacherQueue, describeSchedule, matchProfessors,
  matchDepartment,
};
