/**
 * What the first-run guide says.
 *
 * Kept out of the components so the wording can be edited without touching the
 * dashboards, and so the three tours read as one voice.
 *
 * House rules for the writing, learned from a first draft nobody could skim:
 *
 *   - Short sentences. Two or three, and none of them long.
 *   - Name the control exactly as the screen labels it — "the Cards tab", not
 *     "credential management" — so the word you just read is findable.
 *   - Say what it does, then what to do. Explanation with no action leaves the
 *     reader nodding and none the wiser.
 *   - Plain words. Not "consultation slots remaining", just "how many are
 *     left". Not "is not undoable", just "you cannot get it back".
 *
 * Each step points at one control rather than a whole region: a highlight the
 * size of the screen is the same as no highlight at all.
 */

/**
 * The student tour is a live demo rather than a description.
 *
 * Booking a consultation is the one thing a student is here to do, and it is
 * four screens deep — reading about it does not help much. So the tour opens a
 * real department, a real professor and the real request form as it goes, and
 * stops at the send button rather than pressing it. Nothing is submitted on
 * anyone's behalf.
 *
 * The steps that drive the app need callbacks into it, so this is a function
 * rather than a constant; the dashboard passes its own setters in.
 */
export function studentTour({
  showDepartments, openDepartment, openRequestFor, showInbox, showProfile, demo,
}) {
  const professor = demo?.professor;

  return [
    {
      title: "Pick a department",
      body: "These cards are the departments. Tap one to see its professors. The number tells you how many are free right now.",
      target: ['[data-tour="student-first-department"]', '[data-tour="student-departments"]'],
      before: showDepartments,
    },
    {
      title: "Then pick a professor",
      body: demo
        ? `We opened ${demo.department} for you. Green means free now. Tap whoever you need.`
        : "Green means the professor is free now. Tap whoever you need.",
      // One card, not the whole grid — a highlight the size of the list does
      // not tell anybody what to press.
      target: ['[data-tour="student-first-professor"]', '[data-tour="student-professors"]'],
      before: openDepartment,
    },
    {
      title: "This is the request form",
      body: professor
        ? `We opened it against ${professor}, so you can see what it looks like. Nothing has been sent.`
        : "Tapping a professor opens this form. Nothing has been sent.",
      // The professor being requested, not the whole overlay. Pointing at the
      // form itself highlighted the entire screen, which dims nothing and
      // singles out nothing.
      target: '[data-tour="request-header"]',
      before: openRequestFor,
    },
    {
      title: "Say what you need",
      body: "Pick a category, then write it in a sentence or two. Your professor reads this before saying yes, so be clear.",
      target: '[data-tour="request-purpose"]',
    },
    {
      title: "Send it when it is real",
      body: "This is the send button. We have not pressed it. When you do, your professor gets the request straight away.",
      target: '[data-tour="request-submit"]',
    },
    {
      title: "Their answer comes here",
      body: "Yes, no, or yes with a date and time. A dot on this tab means you have something unread.",
      // Both navigations: the bar on a phone, the tab strip on a desktop.
      target: ['[data-tour="nav-inbox"]', '[data-tour="tab-inbox"]'],
      before: showInbox,
    },
    {
      title: "Your ID lives here",
      body: "Your QR code, your photo and your PIN. Scan that QR next time instead of typing your student number.",
      target: ['[data-tour="nav-profile"]', '[data-tour="tab-profile"]'],
      before: showProfile,
    },
    {
      title: "That is everything",
      body: "Only want to check if someone is in? The front page has a live board that needs no sign-in at all.",
    },
  ];
}

/**
 * The teacher tour opens the tab each control lives on.
 *
 * The status select and the schedule button are on the Schedule tab, and the
 * dashboard opens on Requests — so two of the five steps described controls
 * that were not on screen and highlighted nothing at all.
 */
export function teacherTour(setTab) {
  return [
    {
      title: "Set whether you are free",
      body: "Available, Unavailable, On Leave or In Meeting. Leave it on Auto and it follows your schedule by itself.",
      target: '[data-tour="teacher-status"]',
      before: () => setTab("status"),
    },
    {
      title: "Cap your day",
      body: "This is how many students you will see today. Type a number and press Enter. It is saved to your account, so it holds on any device.",
      target: '[data-tour="teacher-limit"]',
      before: () => setTab("requests"),
    },
    {
      title: "Requests land here",
      body: "Accept one to hold a slot. Mark it Done once you have met. Decline it if you cannot — either way the student is told.",
      target: '[data-tour="teacher-requests"]',
      before: () => setTab("requests"),
    },
    {
      title: "Delete is only for mistakes",
      body: "Use it on duplicates and test entries. Decline is the answer a student sees; delete removes the row and you cannot get it back.",
      target: '[data-tour="teacher-requests"]',
    },
    {
      title: "Your schedule does the work",
      body: "Set your weekly consultation hours once. The board then shows you as free during them without you touching anything.",
      target: '[data-tour="teacher-schedule"]',
      before: () => setTab("status"),
    },
  ];
}

/**
 * The admin tour opens each section as it describes it.
 *
 * It used to point at the bottom bar and talk about screens you could not see —
 * and on a desktop, where that bar is hidden, it pointed at a hidden element
 * and appeared to highlight nothing at all. Each step now switches to its tab,
 * so the section is on screen while you read about it, and each target names
 * both navigations: the bar on a phone, the rail on a desktop, whichever is
 * actually laid out.
 */
export function adminTour(setTab) {
  const step = (id, title, body) => ({
    title,
    body,
    target: [`[data-tour="nav-${id}"]`, `[data-tour="side-${id}"]`],
    before: () => setTab(id),
  });

  return [
    step("overview", "Start here",
      "Your totals, the activity graph and the newest requests. Exports are here too — today only, or everything."),
    step("credentials", "Give faculty their ID card",
      "Issue a QR card here. It is shown once, so print it there and then. Issuing a new one kills the old card — that is how you replace a lost one."),
    step("requests", "Every consultation",
      "Filter by status, department or date. Archive tidies old rows away but keeps them. Free space deletes them when the database is filling up."),
    step("students", "When a student is locked out",
      "Reset their PIN here and they pick a new one next time they sign in. You can remove an account from here too."),
    step("faculty", "Your roster",
      "Add a new faculty member, and see who is free at a glance. Removing one asks you why, and that answer is kept."),
  ];
}
