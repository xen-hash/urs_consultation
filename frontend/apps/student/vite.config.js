import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

import ursApp from "@urs/shared/build/vite-app.js";

// Everything that is not in this file is in shared/build/vite-app.js, which all
// three apps share. What is here is only what makes this deployment itself.
export default defineConfig(ursApp({
  id: "student",
  root: fileURLToPath(new URL(".", import.meta.url)),
  name: "URS Consultation — Student",
  shortName: "URS Student",
  description:
    "University of Rizal System – College of Engineering. Request a consultation and see who is free.",
  themeColor: "#003366",
  background: "#001946",
  port: 5173,
  shortcuts: [
    { name: "Who's available", short_name: "Available", url: "/availability" },
    { name: "My dashboard",    short_name: "Dashboard", url: "/dashboard" },
    { name: "Register",        short_name: "Register",  url: "/register" },
  ],
}));
