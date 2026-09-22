/**
 * Serving one folder of static files from three different apps.
 *
 * Vite has exactly one `publicDir` per build, and the three apps need two: the
 * assets they share — Navi's poses, the URS favicons — and the handful that are
 * theirs alone, which is how an installed student app and an installed faculty
 * app end up with different icons on the same home screen.
 *
 * Pointing `publicDir` at the shared folder would mean no app-owned assets;
 * pointing it at the app's own would mean three copies of a 228 KB mascot that
 * have to be updated together. So `publicDir` stays the app's, and this adds
 * the shared folder underneath it: served in dev, emitted at build, and in both
 * cases losing to a file of the same name in the app's own folder. That
 * precedence is the point — an app overrides a shared asset by simply having
 * one, with no list to keep in step.
 *
 * The build half emits through Rollup rather than copying into `dist` at the
 * end, because vite-plugin-pwa builds its precache manifest by globbing the
 * output directory once the bundle is written. A file copied after that is a
 * file the service worker has never heard of — which is precisely how the
 * mascot on the offline help bubble would go missing.
 */

import fs from "node:fs";
import path from "node:path";

// Only the types that actually live in these folders. An unknown extension is
// served without a Content-Type rather than guessed at, which is what a static
// file server does anyway and what the browser sniffs correctly.
const TYPES = {
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};

/** Whether `p` names a file that exists. */
function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false; // Missing, or a path we are not allowed to look at.
  }
}

/** Every file under `dir`, as paths relative to it, with "/" separators. */
function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.relative(dir, path.join(entry.parentPath || entry.path, entry.name)))
    .map(rel => rel.split(path.sep).join("/"));
}

export default function sharedPublic(sharedDir) {
  let appPublicDir = null;

  return {
    name: "urs-shared-public",

    configResolved(config) {
      appPublicDir = config.publicDir || null;
    },

    generateBundle() {
      // A shared asset the app also has is simply not emitted. Emitting both
      // and letting one overwrite the other would make which one ships depend
      // on the order Vite happens to write them in.
      const owned = new Set(appPublicDir ? filesUnder(appPublicDir) : []);
      for (const rel of filesUnder(sharedDir)) {
        if (owned.has(rel)) continue;
        this.emitFile({
          type: "asset",
          fileName: rel,
          source: fs.readFileSync(path.join(sharedDir, rel)),
        });
      }
    },

    // Dev: before Vite's own middlewares, not after.
    //
    // After was the obvious place — let Vite answer for anything it has, and
    // pick up what is left — and it does not work. What is left never reaches
    // here: Vite's SPA fallback sits in that stack and rewrites any path it
    // does not recognise to index.html, with the dot rule disabled so that
    // deep links survive. So every shared asset came back as a 200 carrying
    // the HTML shell, which a browser renders as a broken image rather than
    // as an error — the mascot vanished from all three apps in development
    // and nothing in the console said why.
    //
    // Running first means precedence has to be stated rather than inherited,
    // which is the explicit check below: a file the app has of its own is left
    // to Vite, and only then is the shared folder consulted. Same rule the
    // build half applies, said the other way round.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();

        const url = (req.url || "").split("?")[0];
        let decoded;
        try {
          decoded = decodeURIComponent(url);
        } catch {
          return next(); // Malformed escape — not a file we have.
        }

        // path.join on a URL containing "../" would climb out of the shared
        // folder and serve anything on disk, so the result is checked to be
        // inside it rather than the input checked for ways out.
        const file = path.join(sharedDir, decoded);
        if (!file.startsWith(sharedDir + path.sep)) return next();
        if (!isFile(file)) return next();

        // The app's own copy wins, and Vite is already set up to serve it.
        if (appPublicDir && isFile(path.join(appPublicDir, decoded))) return next();

        const type = TYPES[path.extname(file).toLowerCase()];
        if (type) res.setHeader("Content-Type", type);
        res.setHeader("Cache-Control", "no-cache");
        if (req.method === "HEAD") return res.end();
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}
