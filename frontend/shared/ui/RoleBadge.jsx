import { GraduationCap, BookOpen, Shield } from "lucide-react";

import { THIS_APP, labelOf } from "../lib/origins.js";

/**
 * Which of the three apps you are looking at.
 *
 * When the roles shared one site, the address said which one you were in and
 * getting there wrong was hard. Three separate sites make it easy: three URLs
 * to remember, three home-screen icons that are the same seal, and a faculty
 * member who opens the student app sees a sign-in form that looks exactly like
 * theirs and fails with "student not found".
 *
 * So every door says whose it is, in the one place a reader is already looking
 * — beside the university name — and in the role's own colour. The colour is
 * not doing the work on its own: the word is there, and so is a distinct icon,
 * because a badge that only differs by hue tells a colour-blind reader nothing
 * and tells a photocopier nothing at all.
 */
const ICONS = { student: GraduationCap, faculty: BookOpen, admin: Shield };

export default function RoleBadge({ app = THIS_APP, tone = "backdrop", className = "" }) {
  const label = labelOf(app);
  if (!label) return null;

  const Icon = ICONS[app];
  const styles = tone === "light"
    ? "bg-role-50 text-role border-role/20"
    // On the navy backdrop the role tint is not available — it is a light
    // value — so the badge borrows the backdrop's own translucency and keeps
    // only the icon in colour, which stays legible against navy.
    : "bg-on-backdrop/10 text-on-backdrop border-on-backdrop/20";

  return (
    <span className={`badge border shrink-0 ${styles} ${className}`}>
      <Icon size={13} aria-hidden="true" />
      {label}
    </span>
  );
}
