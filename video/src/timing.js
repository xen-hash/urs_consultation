import captions from "./data/captions.json";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Seconds of logo sting before the narration starts, and of end card after it.
export const INTRO = 3;
export const OUTRO = 7;

export const TOTAL_FRAMES = Math.round((INTRO + captions.duration + OUTRO) * FPS);

export const sec = (s) => Math.round(s * FPS);

// The video frame a moment in the narration lands on.
export const vo = (voSec) => sec(INTRO + voSec);

// Every spoken word, flattened, so a cue can name what's said rather than a
// hard-coded time. Re-aligning a new recording moves every cue with it.
const spoken = captions.words.flatMap((w) =>
  w.key.split(" ").map((k, i, all) => ({
    k, start: w.start, end: w.end, first: i === 0, last: i === all.length - 1,
  })));

const find = (phrase, after) => {
  const keys = phrase.toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/).filter(Boolean);
  for (let i = 0; i + keys.length <= spoken.length; i++) {
    if (spoken[i].start < after) continue;
    if (keys.every((k, j) => spoken[i + j].k === k)) return [spoken[i], spoken[i + keys.length - 1]];
  }
  throw new Error(`cue not found in narration: "${phrase}" after ${after}s`);
};

// Narration time (seconds) at which a phrase starts / ends.
export const cue = (phrase, after = 0) => find(phrase, after)[0].start;
export const cueEnd = (phrase, after = 0) => find(phrase, after)[1].end;

export const { phrases, duration: SPEECH_END } = captions;
