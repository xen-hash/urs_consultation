// VITE_API_BASE and VITE_SOCKET_URL must be set in Vercel Environment Variables
// e.g. VITE_API_BASE = https://your-backend.railway.app/api
//      VITE_SOCKET_URL = https://your-backend.railway.app

export const API_BASE   = import.meta.env.VITE_API_BASE   || "/api";
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";

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

export const KIOSK_PASSWORD = "admin123";
