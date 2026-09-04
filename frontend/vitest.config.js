import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Separate from vite.config.js on purpose: that config carries the PWA plugin,
 * which generates a service worker and precache manifest. None of that is
 * wanted for a unit run, and it slows every invocation down.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{js,jsx}"],
  },
});
