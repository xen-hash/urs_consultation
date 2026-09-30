import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Backdrop, Captions, Scene } from "./frame";
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
const CUTS = [
  ["open", 0, ColdOpen],
  ["hook", vo(-0.15), Hook],
  ["title", at("meet the"), Title],
  ["board", at("open the live"), Board],
  ["faculty", at("for faculty"), Faculty],
  ["booking", at("need a consultation"), Booking],
  ["navi", at("rather just ask"), NaviScene],
  ["login", at("sign in fast"), Login],
  ["campus", at("on campus"), Campus],
  ["end", at("u r s faculty", 70), EndCard],
];

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

export const Teaser = () => (
  <AbsoluteFill style={{ background: "#0d1b2a" }}>
    <Backdrop />
    {CUTS.map(([name, from, Component], i) => {
      const to = i + 1 < CUTS.length ? CUTS[i + 1][1] : TOTAL_FRAMES;
      const last = i + 1 === CUTS.length;
      return (
        <Scene key={name} from={from} to={to} overlap={last ? 0 : 10}>
          <Component len={to - from} />
        </Scene>
      );
    })}
    <Captions hidden={NO_CAPTIONS} />
    <Sequence from={sec(INTRO)} name="Narration">
      <Audio src={staticFile("voiceover.mp3")} />
    </Sequence>
    {MUSIC && <Audio src={staticFile(MUSIC)} volume={musicVolume} loop />}
  </AbsoluteFill>
);

