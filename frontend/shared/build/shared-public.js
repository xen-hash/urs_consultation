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

    // Dev: answer for a shared asset only once Vite has decided it has nothing
    // of its own at that URL. `configureServer` returning a function installs
    // the middleware after Vite's own, which is what puts the app's publicDir
    // — and any real module — ahead of this one.
    configureServer(server) {
      return () => {
        server.middlewares.use((req, res, next) => {
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
          if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();

          const type = TYPES[path.extname(file).toLowerCase()];
          if (type) res.setHeader("Content-Type", type);
          res.setHeader("Cache-Control", "no-cache");
          fs.createReadStream(file).pipe(res);
        });
      };
    },
  };
}
