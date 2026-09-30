import { Config } from "@remotion/cli/config";

// Render with the Chromium that's already on the machine instead of letting
// Remotion download its own. Override with REMOTION_BROWSER if it lives
// elsewhere, or unset it to fall back to Remotion's download.
const browser = process.env.REMOTION_BROWSER ??
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (browser) Config.setBrowserExecutable(browser);

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setCrf(18);
Config.setPixelFormat("yuv420p");
