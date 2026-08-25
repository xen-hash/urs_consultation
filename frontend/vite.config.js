import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // We surface our own "new version available" toast instead of
      // silently swapping the app out from under someone mid-consultation.
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png"],
      manifestFilename: "site.webmanifest",
      manifest: {
        name: "URS Faculty Consultation System",
        short_name: "URS Consultation",
        description:
          "University of Rizal System – College of Engineering faculty consultation management system.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "any",
        background_color: "#001946",
        theme_color: "#003366",
        lang: "en",
        dir: "ltr",
        categories: ["education", "productivity"],
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ],
        shortcuts: [
          { name: "Student Portal", short_name: "Student", url: "/student",
            icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
          { name: "Teacher Portal", short_name: "Teacher", url: "/teacher",
            icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
          { name: "Dean's Office", short_name: "Dean", url: "/dean",
            icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
          { name: "Public Kiosk", short_name: "Kiosk", url: "/kiosk",
            icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // Install-time icons are fetched by the OS, not the app — no point
        // making every first visit pay ~475 KB for them up front.
        globIgnores: [
          "**/icon-192.png",
          "**/icon-512.png",
          "**/icon-maskable-*.png",
          "**/apple-touch-icon.png"
        ],
        // The URS seal is ~1.7 MB; keep it in the shell so the app looks right offline.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // SPA deep links resolve to the shell, but live traffic must never be
        // answered from cache — consultation status has to be current.
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//, /^\/static\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" }
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      devOptions: { enabled: false }
    })
  ],
  server: {
    // Dev proxy — only active during `npm run dev` on localhost
    // Anchored to a trailing slash on purpose. A bare "/api" prefix also
    // matches sibling module paths like /apiClient.js, which then get proxied
    // to the backend and 404 instead of being served as source.
    proxy: {
      "^/api/": { target: "http://localhost:5000", changeOrigin: true },
      "^/socket\\.io/": { target: "http://localhost:5000", ws: false, changeOrigin: true }
    }
  },
  build: { outDir: "dist", sourcemap: false }
});
