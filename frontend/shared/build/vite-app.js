/**
 * The build every one of the three apps shares.
 *
 * Student, faculty and administration are deployed separately — three origins,
 * three bundles, three installable apps — but they are the same app three
 * times over in everything except which screens they carry and what they call
 * themselves. Keeping the Vite config here rather than copying it three times
 * is what stops that drifting: a change to the service worker's caching rules,
 * or to the dev proxy, is made once.
 *
 * What an app supplies is only what genuinely differs — its name, its colours,
 * its home-screen shortcuts, and the port it takes in development.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

import sharedPublic from "./shared-public.js";
import sharedHead from "./head.js";

const SHARED_PUBLIC = path.resolve(fileURLToPath(new URL("../public", import.meta.url)));

/**
 * @param {object} app
 * @param {string} app.id          "student" | "faculty" | "admin"
 * @param {string} app.root        the app's own directory (pass import.meta.url's dirname)
 * @param {string} app.name        full PWA name, e.g. "URS Consultation — Student"
 * @param {string} app.shortName   home-screen label, 12 characters or so
 * @param {string} app.description one sentence, shown in install prompts
 * @param {string} app.themeColor  the browser chrome colour for this role
 * @param {string} app.background  the splash-screen colour for this role
 * @param {Array}  app.shortcuts   long-press shortcuts, paths relative to this app
 * @param {number} app.port        dev server port — one per app, so all three run at once
 */
export default function ursApp({
  id,
  root,
  name,
  shortName,
  description,
  themeColor,
  background,
  shortcuts = [],
  port,
}) {
  return {
    root,

    // One .env for all three apps, at the workspace root rather than three
    // copies inside the app folders. VITE_API_BASE is the same backend for
    // every app, and the three cross-app URLs have to agree with each other —
    // which is exactly the thing three separate files stop doing. A deployment
    // still overrides any of them per app in its own dashboard.
    envDir: fileURLToPath(new URL("../..", import.meta.url)),

    // Which app this is, frozen into the bundle rather than worked out at
    // runtime. shared/lib/origins.js reads it to tell a link that stays inside
    // this app from one that crosses to another origin, and a faculty bundle
    // served from an unexpected host must still know it is the faculty app.
    define: { "import.meta.env.VITE_APP": JSON.stringify(id) },

    plugins: [
      react(),

      // The common <head> — icons, fonts, and the inline script that settles
      // the theme before the first paint. See head.js for why it is injected
      // rather than pasted into three files.
      {
        name: "urs-shared-head",
        transformIndexHtml: html =>
          html
            .replace("</head>", `${sharedHead}\n  </head>`)
            // Which app this is, on the element every stylesheet can see. The
            // role accent in index.css keys off it, so no component has to be
            // told which app it is rendering in — and it cannot be forgotten
            // in one app's index.html, because no index.html carries it.
            .replace("<html ", `<html data-role="${id}" `),
      },

      // Before VitePWA on purpose: this emits the shared assets into the
      // bundle, and the service worker's precache list is built from what the
      // bundle holds.
      sharedPublic(SHARED_PUBLIC),

      VitePWA({
        // autoUpdate, not prompt.
        //
        // Waiting for someone to tap "update" assumes the cached version still
        // works while they decide. Since the API authenticates every request,
        // an old cached bundle cannot talk to the backend at all — it has no
        // token to send — so the prompt would be asking people to tap a button
        // inside an app that is already broken, and a security release would
        // sit behind that tap indefinitely.
        registerType: "autoUpdate",
        injectRegister: null,
        includeAssets: ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png"],
        manifestFilename: "site.webmanifest",
        manifest: {
          name,
          short_name: shortName,
          description,
          // Each app owns its whole origin, so its scope is the origin. This is
          // what keeps three installed apps from being treated as one: a PWA is
          // identified by origin plus id, and these differ in both.
          id: "/",
          start_url: "/",
          scope: "/",
          display: "standalone",
          display_override: ["standalone", "minimal-ui"],
          orientation: "any",
          background_color: background,
          theme_color: themeColor,
          lang: "en",
          dir: "ltr",
          categories: ["education", "productivity"],
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
          shortcuts: shortcuts.map(s => ({
            ...s,
            icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
          })),
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
          // Install-time icons are fetched by the OS, not the app — no point
          // making every first visit pay ~475 KB for them up front.
          globIgnores: [
            "**/icon-192.png",
            "**/icon-512.png",
            "**/icon-maskable-*.png",
            "**/apple-touch-icon.png",
            // Navi's poses are decorative and appear on a handful of screens.
            // The shell has to work offline; a mascot arriving a moment later
            // does not, and the full set is 228 KB.
            //
            // navi-idle.png is the exception and is precached: it is the face
            // on the help bubble, which is on every screen, so leaving it out
            // means an empty circle in the corner of an offline app — and
            // offline is exactly when somebody is most likely to press it.
            "**/mascot/navi-helpful.png",
            "**/mascot/navi-happy.png",
            "**/mascot/navi-thinking.png",
            "**/mascot/navi-listening.png",
            "**/mascot/navi-excited.png",
            "**/mascot/navi-working.png",
            "**/mascot/navi-hero.png",
            "**/mascot/navi-bust.png",
          ],
          // The URS seal is ~1.7 MB; keep it in the shell so the app looks
          // right offline.
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
              options: { cacheName: "google-fonts-stylesheets" },
            },
            {
              urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-files",
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],

    server: {
      // One port per app so all three can run side by side, which is the only
      // way to exercise the links between them locally.
      port,
      strictPort: true,
      // Dev proxy — only active during `npm run dev` on localhost.
      // Anchored to a trailing slash on purpose. A bare "/api" prefix also
      // matches sibling module paths like /apiClient.js, which then get proxied
      // to the backend and 404 instead of being served as source.
      proxy: {
        "^/api/": { target: "http://localhost:5000", changeOrigin: true },
        "^/socket\\.io/": { target: "http://localhost:5000", ws: false, changeOrigin: true },
      },
    },

    build: { outDir: "dist", sourcemap: false },
  };
}
