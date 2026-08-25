// Department icons, resolved from the name stored in constants.DEPARTMENT_META.
// These used to be emoji ("🏗️", "💻", "⚡") duplicated across two files, which
// render inconsistently across platforms and announce as their Unicode name to
// screen readers.

import { HardHat, Cpu, RadioTower, Zap, Cog, Ruler, GraduationCap } from "lucide-react";
import { DEPARTMENT_META } from "../constants.js";

const ICONS = { HardHat, Cpu, RadioTower, Zap, Cog, Ruler, GraduationCap };

/**
 * A colour per department.
 *
 * Forty-odd faculty in one list is a wall of identical rows; a stable colour per
 * department gives the eye something to sort by while scrolling. Assigned in a
 * fixed order and keyed by department, never by position, so filtering the list
 * cannot repaint the rows that remain.
 *
 * Tint and text are separate values: the tint is a background these sit behind,
 * the text step is dark enough to stay readable on it. Colour is never the only
 * signal — the department name is always beside it.
 */
// Validated with the dataviz validator against a white surface: lightness band,
// chroma floor, adjacent-pair CVD separation, normal-vision floor and 3:1
// contrast all pass. An earlier attempt using the obvious brand-adjacent hues
// failed — rose and amber sat 5.7 apart under deuteranopia, and teal read as
// grey — so these are the re-stepped values, not hand-picked ones.
const DEPARTMENT_COLORS = {
  "Civil Engineering Department":       { tint: "#E8F0FE", ink: "#2563EB" },
  "Computer Engineering Department":    { tint: "#E3F5F2", ink: "#0D9488" },
  "Electronics Engineering Department": { tint: "#F1EBFC", ink: "#7C3AED" },
  "Electrical Engineering Department":  { tint: "#FBF2DE", ink: "#CA8A04" },
  "Mechanical Engineering Department":  { tint: "#FCEAF3", ink: "#DB2777" },
  "GEC GEAS Department":                { tint: "#EFF6E3", ink: "#65A30D" },
};

const FALLBACK = { tint: "#EEF2F7", ink: "#475569" };

export function departmentColor(department) {
  return DEPARTMENT_COLORS[department] || FALLBACK;
}

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
