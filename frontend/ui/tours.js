/**
 * What the first-run guide says, per screen.
 *
 * Kept out of the components so the wording can be edited without touching the
 * dashboards, and so the three tours read as one voice rather than three
 * different people writing help text.
 *
 * Each step names the control the way it is labelled on screen — "the Cards
 * tab", not "credential management" — because the point is to connect a word
 * you just read to a thing you can see. A step whose target is missing is
 * skipped automatically, so it is safe to describe controls that only appear
 * in some states.
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
export function studentTour({ showDepartments, openDepartment, openRequestFor, showInbox, demo }) {
  const professor = demo?.professor;

  return [
    {
      title: "Start with the departments",
      body: "Each card is a department, coloured so they are easy to tell apart. The number on it is how many of its faculty are free right now.",
      target: '[data-tour="student-departments"]',
      before: showDepartments,
    },
    {
      title: "Open one to see the faculty",
      body: professor
        ? `Here is ${demo.department}, opened for you. Every professor shows whether they are available, and their consultation slots for today.`
        : "Tap a department and you get its faculty, each showing whether they are available and how many consultation slots are left today.",
      target: '[data-tour="student-professors"]',
      before: openDepartment,
    },
    {
      title: "This is the request form",
      body: professor
        ? `Opened against ${professor}, exactly as it would be if you tapped them. Nothing has been sent — this is your own form to look at.`
        : "Tapping a professor opens this form. It is how a consultation is requested.",
      target: '[data-tour="request-form"]',
      before: openRequestFor,
    },
    {
      title: "Say what it is about",
      body: "Pick a category, then write what you need in a sentence or two. The professor sees this before they accept, so it is worth being specific.",
      target: '[data-tour="request-purpose"]',
    },
    {
      title: "Then send it — when it is real",
      body: "This is the button. We have not pressed it, and this form will close empty when the guide ends. Do this for real and the request goes straight to them.",
      target: '[data-tour="request-submit"]',
    },
    {
      title: "Their answer arrives in Inbox",
      body: "Accepted, declined, or accepted with a date and time. A dot on the tab means something is waiting to be read.",
      target: '[data-tour="nav-inbox"]',
      before: showInbox,
    },
    {
      title: "Profile holds your ID",
      body: "Your student QR code, your photo and your PIN. That QR is how you sign in without typing your ID.",
      target: '[data-tour="nav-profile"]',
    },
    {
      title: "No sign-in needed to just look",
      body: "Only checking whether someone is in? The live board on the front page is open to everyone, no account required.",
    },
  ];
}

export const TEACHER_TOUR = [
  {
    title: "Your status is the top control",
    body: "Available, Unavailable, On Leave or In Meeting. Leave it on Auto and it follows the schedule you set; change it by hand when the day does not go to plan.",
    target: '[data-tour="teacher-status"]',
  },
  {
    title: "Set how many you will take",
    body: "The daily limit stops requests piling up past what you can actually see. Type a number and press Enter — it is remembered for next time.",
    target: '[data-tour="teacher-limit"]',
  },
  {
    title: "Requests come in below",
    body: "Accept one to hold a slot, mark it Done when the consultation has happened, or Decline it with the student notified either way.",
    target: '[data-tour="teacher-requests"]',
  },
  {
    title: "Delete is for mistakes only",
    body: "Duplicates and test entries can be removed outright. Declining is the answer a student sees; deleting removes the row and is not undoable.",
    target: '[data-tour="teacher-requests"]',
  },
  {
    title: "Your schedule drives everything",
    body: "Set your weekly consultation hours and the board shows you as available during them automatically, without you touching anything.",
    target: '[data-tour="teacher-schedule"]',
  },
];

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
    step("overview", "Dashboard is the summary",
      "Totals, activity over time and the newest requests. Exports live here too — today only, or the whole record."),
    step("credentials", "Cards is where you issue IDs",
      "A faculty QR card is created here and shown once. Issuing a replacement kills the old card automatically, which is how a lost one is revoked."),
    step("requests", "Requests, and clearing them out",
      "Filter by status, department or date. Archive hides old rows but keeps them; Free space deletes them for good when the database is filling up."),
    step("students", "Students and forgotten PINs",
      "Reset a student's PIN when they are locked out — they choose a new one on their next sign-in. You can remove an account from here too."),
    step("faculty", "Faculty is the roster",
      "Add someone new, and see who is available at a glance. Removing a faculty member asks why, and the reason goes into the audit log."),
  ];
}
