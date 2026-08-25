// Department icons, resolved from the name stored in constants.DEPARTMENT_META.
// These used to be emoji ("🏗️", "💻", "⚡") duplicated across two files, which
// render inconsistently across platforms and announce as their Unicode name to
// screen readers.

import { HardHat, Cpu, RadioTower, Zap, Cog, Ruler, GraduationCap } from "lucide-react";
import { DEPARTMENT_META } from "../constants.js";

const ICONS = { HardHat, Cpu, RadioTower, Zap, Cog, Ruler, GraduationCap };

export default function DepartmentIcon({ department, size = 20, className = "" }) {
  const name = DEPARTMENT_META[department]?.icon;
  const Icon = ICONS[name] || GraduationCap;
  return <Icon size={size} className={className} aria-hidden="true" />;
}

/** "Computer Engineering Department" -> "Computer". Falls back to trimming the
 *  suffixes so a department added later still shortens sensibly. */
export function shortDepartment(department) {
  return DEPARTMENT_META[department]?.short
    || (department || "").replace(" Department", "").replace(" Engineering", "");
}
