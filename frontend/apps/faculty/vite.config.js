import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

import ursApp from "@urs/shared/build/vite-app.js";

// Everything that is not in this file is in shared/build/vite-app.js, which all
// three apps share. What is here is only what makes this deployment itself.
export default defineConfig(ursApp({
  id: "faculty",
  root: fileURLToPath(new URL(".", import.meta.url)),
  name: "URS Consultation — Faculty",
  shortName: "URS Faculty",
  description:
    "University of Rizal System – College of Engineering. Your schedule, your availability, and who is waiting on you.",
  themeColor: "#003366",
  background: "#001946",
  port: 5174,
  shortcuts: [
    { name: "My requests",       short_name: "Requests", url: "/dashboard#requests" },
    { name: "Status & schedule", short_name: "Status",   url: "/dashboard#status" },
  ],
}));
