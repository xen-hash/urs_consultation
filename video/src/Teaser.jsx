import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { Backdrop, Captions, OVERLAP, Scene } from "./frame";
import { CircleWipe, Flash, GlitchBars, Grain, LightLeak, ShapeWipe, Vignette } from "./fx";
import { cue, FPS, INTRO, phrases, sec, TOTAL_FRAMES, vo } from "./timing";
import { ColdOpen, Hook, Title } from "./scenes/Opening";
import { Board, Faculty } from "./scenes/Availability";
import { Booking, NaviScene } from "./scenes/Booking";
import { Campus, EndCard, Login } from "./scenes/Closing";

// Set to the file name in public/ once the background track is added.
export const MUSIC = null;

// Each scene begins just before the line that introduces it.
const LEAD = 0.3;
const at = (phrase, after) => vo(cue(phrase, after) - LEAD);
// [name, first frame, scene, the cut into it]
const CUTS = [
  ["open", 0, ColdOpen, "fade"],
  ["hook", vo(-0.15), Hook, "zoom"],
  ["title", at("meet the"), Title, "cover"],
  ["board", at("open the live"), Board, "zoom"],
  ["faculty", at("for faculty"), Faculty, "whip"],
  ["booking", at("need a consultation"), Booking, "whip"],
  ["navi", at("rather just ask"), NaviScene, "cover"],
  ["login", at("sign in fast"), Login, "glitch"],
  ["campus", at("on campus"), Campus, "zoom"],
  ["end", at("u r s faculty", 70), EndCard, "cover"],
];
const cutAt = (name) => CUTS.find((c) => c[0] === name)[1];

// What is drawn over each cut, above the scenes.
const CutEffects = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <Flash frame={frame} at={cutAt("hook")} color="#fff3d6" peak={0.7} />
      <LightLeak frame={frame} at={cutAt("hook") - 10} dur={44} />
      <ShapeWipe frame={frame} at={cutAt("title")} />
      <LightLeak frame={frame} at={cutAt("title") + 4} dur={60} from="right" strength={0.6} />
      <Flash frame={frame} at={cutAt("board")} peak={0.45} />
      <CircleWipe frame={frame} at={cutAt("navi")} x={560} y={560} />
      <GlitchBars frame={frame} at={cutAt("login")} />
      <LightLeak frame={frame} at={cutAt("campus") - 12} dur={40} strength={0.7} />
      <ShapeWipe frame={frame} at={cutAt("end")} dir={-1} />
      <Flash frame={frame} at={cutAt("end") + 2} color={"#ffb733"} peak={0.22} />
      <LightLeak frame={frame} at={cutAt("end") + 6} dur={70} />
    </>
  );
};

// Real motion blur, but only where things move fast enough to need it: it
// renders each of those frames several times over.
const BLUR_WINDOWS = CUTS.filter(([, , , cut]) => cut === "whip" || cut === "zoom")
  .map(([, from, , cut]) => [from - 2, from + OVERLAP[cut] + 2]);

const Blurred = ({ children }) => {
  const frame = useCurrentFrame();
  return BLUR_WINDOWS.some(([a, b]) => frame >= a && frame <= b)
    ? <CameraMotionBlur samples={7} shutterAngle={240}>{children}</CameraMotionBlur>
    : children;
};

// Big on-screen type already says these lines, so no caption under them.
const NO_CAPTIONS = [
  [cue("meet the") - 0.2, cue("open the live") - 0.2],
  [cue("u r s faculty", 70) - 0.2, Infinity],
];

// Music sits under the voice: louder in the gaps, quieter while Navi talks.
const speaking = new Uint8Array(TOTAL_FRAMES);
for (const p of phrases) {
  for (let f = vo(p.start - 0.2); f < Math.min(TOTAL_FRAMES, vo(p.end + 0.3)); f++) speaking[f] = 1;
}
const musicVolume = (f) => {
  let sum = 0;
  for (let k = -8; k <= 8; k++) sum += speaking[Math.max(0, Math.min(TOTAL_FRAMES - 1, f + k))];
  const duck = sum / 17;
  const level = 0.42 - duck * 0.3;
  const fadeIn = Math.min(1, f / (FPS * 0.5));
  const fadeOut = Math.min(1, (TOTAL_FRAMES - f) / (FPS * 2.5));
  return level * fadeIn * fadeOut;
};

export const Teaser = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#0d1b2a" }}>
      <Blurred>
        <AbsoluteFill>
          <Backdrop />
          {CUTS.map(([name, from, Component, enter], i) => {
            const next = CUTS[i + 1];
            const to = next ? next[1] : TOTAL_FRAMES;
            return (
              <Scene key={name} from={from} to={to} enter={enter} exit={next ? next[3] : "cover"}>
                <Component len={to - from} />
              </Scene>
            );
          })}
          <CutEffects />
        </AbsoluteFill>
      </Blurred>
      <Vignette />
      <Captions hidden={NO_CAPTIONS} />
      <Grain frame={frame} />
      <Sequence from={sec(INTRO)} name="Narration">
        <Audio src={staticFile("voiceover.mp3")} />
      </Sequence>
      {MUSIC && <Audio src={staticFile(MUSIC)} volume={musicVolume} loop />}
    </AbsoluteFill>
  );
};
