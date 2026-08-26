// Set VITE_API_BASE in the host's environment (Vercel -> Settings ->
// Environment Variables). A value there overrides the committed
// .env.production, so the checked-in URL only ever acts as a fallback.
//
//   VITE_API_BASE = https://your-backend.onrender.com/api

export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

/**
 * Socket.IO connects to the API's origin unless told otherwise.
 *
 * This used to be a second variable that had to be kept in step with
 * VITE_API_BASE by hand. Setting only one of the pair -- easy to do, since
 * dashboard values override .env.production per-variable rather than
 * wholesale -- pointed the websocket at a stale host while the REST calls went
 * somewhere else, and nothing failed loudly. Deriving it removes the pairing.
 */
function socketOrigin() {
  const explicit = import.meta.env.VITE_SOCKET_URL;
  if (explicit) return explicit;
  try {
    // "https://host/api" -> "https://host". A relative API_BASE ("/api") means
    // same-origin, which socket.io already assumes when handed an empty string.
    return API_BASE.startsWith("http") ? new URL(API_BASE).origin : "";
  } catch {
    return "";
  }
}

export const SOCKET_URL = socketOrigin();

export const DEPARTMENTS = [
  "Civil Engineering Department",
  "Computer Engineering Department",
  "Electronics Engineering Department",
  "Electrical Engineering Department",
  "Mechanical Engineering Department",
  "GEC GEAS Department"
];

export const PROFESSOR_LIST = {
  "Civil Engineering Department": [
    "Engr. Von Cyrel DL. San Jose","Engr. John Troy Borromeo",
    "Engr. John Louie Cuerdo","Engr. Jasmin M. Panganiban",
    "Engr. Joanna Marie Reyes","Engr. John Carlo L. Ramos",
    "Engr. Paul Ryan M. Reyes","Engr. John Jerby A. Ytang",
    "AR. Lyndon Sheridan P. Trinidad"
  ],
  "Computer Engineering Department": [
    "Engr. Cystaleene Jade A. Santos","Engr. Paul Arvy A. Alfonso",
    "Engr. Allan P. Anorico","Engr. Lester A. Espiritu",
    "Engr. Fredelina F. De Leon"
  ],
  "Electronics Engineering Department": [
    "Engr. Erickson T. Marcos (ECE)","Dr. Marvin P. Amoin",
    "Engr. Jenadel DL. Antipolo","Engr. Jessie O. Barreto",
    "Dr. Francisco F. Culibrina","Engr. Jemuel V. Landerito",
    "Engr. Joan Baez D. Obien","Engr. Rio Camille M. Pedrocillo"
  ],
  "Electrical Engineering Department": [
    "Engr. John Niel B. Herrera","Engr. Roy John E. Balajadia",
    "Engr. Marlon A. Bautista","Engr. Norman C. Francisco",
    "Engr. Michael I. Pascua","Engr. Joshua P. Tejada"
  ],
  "Mechanical Engineering Department": [
    "Engr. Jakki Stacy Wayne A. Serra","Engr. Lean Jo B. Anievas",
    "Engr. Jayson Full B. Cabubas","Engr. Merie Ann C. Dudang",
    "Engr. Wilson Jr. C. Freo","Engr. Alliken Jett I. Ruallo",
    "Engr. Mhaezie Nhelle R. Sexon","Engr. Ver Ian J. Victorio"
  ],
  "GEC GEAS Department": [
    "Engr. Erickson T. Marcos (GEAS)","Engr. Glenda A. Cabandong",
    "Engr. Eleonor F. Dilidili","Engr. Jocelyn C. Rubio",
    "Engr. John Paul J. Sacatrapos","Prof. Marissa Yolanda C. Samonte"
  ]
};

// Department display metadata. The icon is a lucide component name, resolved by
// DepartmentIcon in ui/DepartmentIcon.jsx — these used to be emoji duplicated
// across TeacherPortal and StudentDashboard.
export const DEPARTMENT_META = {
  "Civil Engineering Department":       { short: "Civil",      icon: "HardHat" },
  "Computer Engineering Department":    { short: "Computer",   icon: "Cpu" },
  "Electronics Engineering Department": { short: "Electronics", icon: "RadioTower" },
  "Electrical Engineering Department":  { short: "Electrical", icon: "Zap" },
  "Mechanical Engineering Department":  { short: "Mechanical", icon: "Cog" },
  "GEC GEAS Department":                { short: "GEC GEAS",   icon: "Ruler" },
};

export const CONSULTATION_CATEGORIES = ["Academic","Grades","Project","Schedule","Thesis","Other"];

export const STATUS_COLORS = {
  Available:"available", Unavailable:"unavailable",
  "On Leave":"on-leave", "In Meeting":"in-meeting"
};

export const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
export const DAY_LABELS = { monday:"Mon",tuesday:"Tue",wednesday:"Wed",thursday:"Thu",friday:"Fri",saturday:"Sat",sunday:"Sun" };

export const TIME_OPTIONS = [
  "06:00 AM","06:30 AM","07:00 AM","07:30 AM","08:00 AM","08:30 AM",
  "09:00 AM","09:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM",
  "12:00 PM","12:30 PM","01:00 PM","01:30 PM","02:00 PM","02:30 PM",
  "03:00 PM","03:30 PM","04:00 PM","04:30 PM","05:00 PM","05:30 PM",
  "06:00 PM","06:30 PM","07:00 PM","07:30 PM"
];

export const YEAR_LEVELS = ["1st Year","2nd Year","3rd Year","4th Year","5th Year","Graduate"];


/* ── Who built this ───────────────────────────────────────────────────────────
   Shown in the footer on the public screens. Edit it here and nowhere else.

   A group credit is one entry with no role. To name people individually
   instead, add a row each and give them roles:

     { name: "Juan Dela Cruz", role: "Backend and database" },

   An entry with an empty name is skipped, so a spare row can be left blank
   rather than deleted. Set PROJECT_CONTACT to "" to drop the contact block. */
export const DEVELOPERS = [
  { name: "Bautista et al.", role: "" },
];

export const PROJECT_CONTACT = "jnathbj@gmail.com";
