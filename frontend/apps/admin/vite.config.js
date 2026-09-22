import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

import ursApp from "@urs/shared/build/vite-app.js";

// Everything that is not in this file is in shared/build/vite-app.js, which all
// three apps share. What is here is only what makes this deployment itself.
export default defineConfig(ursApp({
  id: "admin",
  root: fileURLToPath(new URL(".", import.meta.url)),
  name: "URS Consultation — Administration",
  shortName: "URS Admin",
  description:
    "University of Rizal System – College of Engineering. Credentials, activity and reporting.",
  themeColor: "#003366",
  background: "#001946",
  port: 5175,
  shortcuts: [
    { name: "Credentials",  short_name: "Credentials", url: "/dashboard#credentials" },
    { name: "Activity log", short_name: "Activity",    url: "/dashboard#activity" },
  ],
}));
