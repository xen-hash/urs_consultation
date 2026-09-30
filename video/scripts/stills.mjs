// Render a handful of frames to check layout without a full render:
//   node scripts/stills.mjs 120 585 990
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const frames = process.argv.slice(2).map(Number);
const browserExecutable = process.env.REMOTION_BROWSER ??
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.js") });
const composition = await selectComposition({ serveUrl, id: "Teaser", browserExecutable });
for (const frame of frames) {
  const output = `out/stills/f${String(frame).padStart(4, "0")}.png`;
  await renderStill({ serveUrl, composition, frame, output, browserExecutable });
  console.log(output);
}
