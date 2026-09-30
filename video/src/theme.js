// The app's own tokens (frontend/index.css), so the mockups read as the app.
export const C = {
  navy: "#003366",
  navy700: "#002a55",
  navy800: "#002044",
  navy900: "#0d1b2a",
  brand500: "#1a4e85",
  brand400: "#3f73a8",
  brand300: "#6e9bc8",
  brand200: "#a1c1df",
  brand100: "#d0e0ef",
  brand50: "#eaf1f8",
  amber: "#ffa000",
  amberText: "#b45309",
  amber50: "#fff7e6",
  success: "#15803d",
  success50: "#dcfce7",
  danger: "#dc2626",
  danger50: "#fee2e2",
  warning: "#a16207",
  warning50: "#fef3c7",
  canvas: "#f8fafc",
  surface: "#ffffff",
  fg: "#1e293b",
  muted: "#475569",
  subtle: "#64748b",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
};

export const FONT = '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';

export const STATUS = {
  Available: { fg: C.success, bg: C.success50, dot: "#22c55e" },
  "Not Available": { fg: C.danger, bg: C.danger50, dot: "#ef4444" },
  "On Leave": { fg: C.warning, bg: C.warning50, dot: "#f59e0b" },
};

// Fictional faculty. The real roster is never shown.
export const FACULTY = [
  { name: "Engr. Ana Villareal", dept: "Civil Engineering", status: "Available" },
  { name: "Prof. Marco Dizon", dept: "Computer Engineering", status: "Not Available" },
  { name: "Engr. Liza Manalo", dept: "Electrical Engineering", status: "Available" },
  { name: "Dr. Carlo Aquino", dept: "Mechanical Engineering", status: "On Leave" },
  { name: "Prof. Bea Salcedo", dept: "GEC / GEAS", status: "Available" },
  { name: "Engr. Paolo Lim", dept: "Electronics Engineering", status: "Not Available" },
  { name: "Prof. Rina Torres", dept: "Computer Engineering", status: "Available" },
  { name: "Engr. Nico Valdez", dept: "Civil Engineering", status: "On Leave" },
  { name: "Prof. Iris Ferrer", dept: "GEC / GEAS", status: "Available" },
  { name: "Engr. Ben Ocampo", dept: "Mechanical Engineering", status: "Not Available" },
  { name: "Dr. Joy Lacson", dept: "Electronics Engineering", status: "Available" },
  { name: "Engr. Rey Padilla", dept: "Electrical Engineering", status: "Available" },
];

export const initials = (name) =>
  name.replace(/^(Engr|Prof|Dr)\.\s*/, "").split(" ").map((p) => p[0]).slice(0, 2).join("");

const AVATAR_TINTS = ["#1a4e85", "#0f766e", "#7c3aed", "#b45309", "#be123c", "#0369a1", "#4d7c0f", "#9333ea"];
export const avatarTint = (name) =>
  AVATAR_TINTS[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_TINTS.length];
