import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Separate from the apps' Vite configs on purpose: those carry the PWA plugin,
 * which generates a service worker and precache manifest. None of that is
 * wanted for a unit run, and it slows every invocation down.
 *
 * One run covers all three apps and the code they share, rather than three
 * runs that would each have to be remembered.
 */
export default defineConfig({
  plugins: [react()],

  // The shared code asks which app it is in — see shared/lib/origins.js — and
  // under test there is no app. "student" is the answer that makes the common
  // case read normally: it is the app that carries the public screens, so a
  // student destination comes back as a path and a faculty or administration
  // one comes back as the cross-origin URL it really would be. A test about
  // one of the other two says so by passing `app` itself.
  define: { "import.meta.env.VITE_APP": JSON.stringify("student") },

  test: {
    environment: "jsdom",
    globals: true,
    include: ["shared/tests/**/*.test.{js,jsx}", "apps/*/tests/**/*.test.{js,jsx}"],
  },
});
