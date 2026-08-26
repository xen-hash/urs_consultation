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

export const STUDENT_TOUR = [
  {
    title: "Start with the departments",
    body: "Each card is a department. Tap one to see its faculty and who is free right now — the colour is just there to tell them apart.",
    target: '[data-tour="student-departments"]',
  },
  {
    title: "Request a consultation",
    body: "Open a professor who is available and you can send them a request saying what you need. They accept it, decline it, or give you an appointment time.",
    target: '[data-tour="student-departments"]',
  },
  {
    title: "Replies arrive in Inbox",
    body: "This is where their answer turns up, along with any appointment date and time they set. A dot means something is unread.",
    target: '[data-tour="nav-inbox"]',
  },
  {
    title: "Profile holds your ID",
    body: "Your student QR code and details live here. You can change your photo and your PIN from the same screen.",
    target: '[data-tour="nav-profile"]',
  },
  {
    title: "No sign-in needed to look",
    body: "Just checking if someone is in? The live availability board is open to everyone — there is a link to it on the front page.",
  },
];

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

export const ADMIN_TOUR = [
  {
    title: "Dashboard is the summary",
    body: "Totals, activity over time and the newest requests. Exports live here too — today only, or the whole record.",
    target: '[data-tour="nav-overview"]',
  },
  {
    title: "Cards is where you issue IDs",
    body: "A faculty QR card is created here and shown once. Issuing a replacement kills the old card automatically, which is how a lost one is revoked.",
    target: '[data-tour="nav-credentials"]',
  },
  {
    title: "Requests, and clearing them out",
    body: "Filter by status, department or date. Archive hides old rows but keeps them; Free space deletes them for good when the database is filling up.",
    target: '[data-tour="nav-requests"]',
  },
  {
    title: "Students and forgotten PINs",
    body: "Reset a student's PIN when they are locked out — they choose a new one on their next sign-in. You can remove an account from here too.",
    target: '[data-tour="nav-students"]',
  },
  {
    title: "Faculty is the roster",
    body: "Add someone new, and see who is available at a glance. Removing a faculty member asks why, and the reason goes into the audit log.",
    target: '[data-tour="nav-faculty"]',
  },
];
