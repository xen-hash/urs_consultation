/** @type {import('tailwindcss').Config} */
import preset from "@urs/shared/build/tailwind-preset.js";

// The design system is the preset; this says only which files to scan. The
// shared paths have to be listed explicitly — Tailwind reads the file system,
// not the import graph, so a class used in shared/ui and nowhere else would
// otherwise be left out of this app's stylesheet.
export default {
  presets: [preset],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
    "../../shared/*.{js,jsx}",
    "../../shared/ui/**/*.{js,jsx}",
  ],
};
