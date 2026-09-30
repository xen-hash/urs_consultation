import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import { Composition, continueRender, delayRender } from "remotion";
import { Teaser } from "./Teaser";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./timing";

// Hold every frame until the font has loaded, or the first frames render in
// the fallback face.
const fonts = delayRender("Loading Plus Jakarta Sans");
Promise.all([500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px "Plus Jakarta Sans"`)))
  .then(() => continueRender(fonts));

export const Root = () => (
  <Composition id="Teaser" component={Teaser} durationInFrames={TOTAL_FRAMES}
               fps={FPS} width={WIDTH} height={HEIGHT} />
);
