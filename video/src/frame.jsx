// What sits around the scenes for the whole video: the moving backdrop, the
// scene wrapper with its transitions, and the word-by-word captions.
import { AbsoluteFill, Easing, Sequence, random, useCurrentFrame } from "remotion";
import { C, FONT } from "./theme";
import { FPS, INTRO, phrases } from "./timing";
import { SceneStart, keys, ramp } from "./anim";

export const Backdrop = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const blob = (x, y, r, color) => `radial-gradient(circle ${r}px at ${x}px ${y}px, ${color}, transparent 70%)`;
  return (
    <AbsoluteFill style={{
      background: [
        blob(360 + Math.sin(t * 0.35) * 160, 260 + Math.cos(t * 0.3) * 90, 720, "rgba(26,78,133,0.85)"),
        blob(1560 + Math.cos(t * 0.28) * 140, 820 + Math.sin(t * 0.33) * 90, 640, "rgba(255,160,0,0.16)"),
        blob(1400 + Math.sin(t * 0.2) * 200, 180, 520, "rgba(63,115,168,0.45)"),
        `linear-gradient(160deg, ${C.navy800} 0%, ${C.navy900} 100%)`,
      ].join(", "),
    }}>
      <AbsoluteFill style={{
        backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1.6px, transparent 1.8px)",
        backgroundSize: "44px 44px",
        backgroundPosition: `${(t * 6) % 44}px ${(t * 10) % 44}px`,
        maskImage: "radial-gradient(ellipse at 50% 45%, black 30%, transparent 80%)",
      }} />
    </AbsoluteFill>
  );
};

// How long each kind of cut keeps both scenes on screen.
export const OVERLAP = { fade: 10, whip: 10, zoom: 12, cover: 0, glitch: 0 };

// One scene. `enter` is the cut into it and `exit` the cut out of it:
//   fade   — cross-fade
//   whip   — a fast pan: out to the left, in from the right
//   zoom   — the old scene rushes past the camera, the new one rises up
//   cover  — a hard cut hidden under a wipe drawn over the top
//   glitch — a hard cut that tears for a few frames
export const Scene = ({ from, to, enter = "fade", exit = "fade", children }) => {
  const overlap = OVERLAP[exit];
  const len = to - from + overlap;
  return (
    <Sequence from={from} durationInFrames={len}>
      <SceneStart.Provider value={from}>
        <SceneMotion len={len} overlap={overlap} enter={enter} exit={exit}>{children}</SceneMotion>
      </SceneStart.Provider>
    </Sequence>
  );
};

const easeIn = Easing.bezier(0.7, 0, 0.84, 0);
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

const SceneMotion = ({ len, overlap, enter, exit, children }) => {
  const frame = useCurrentFrame();
  let opacity = 1, x = 0, y = 0, scale = 1, filter;
  const n = OVERLAP[enter] || 1;
  const i = Math.min(1, frame / n);
  const o = overlap ? Math.max(0, (frame - (len - overlap)) / overlap) : 0;

  if (enter === "fade") { opacity *= ramp(frame, 0, 14); y += (1 - ramp(frame, 0, 14)) * 36; }
  if (enter === "whip") x += (1 - easeOut(i)) * 2200;
  if (enter === "zoom") { scale *= 0.55 + 0.45 * easeOut(i); opacity *= Math.min(1, i * 1.6); }
  if (enter === "cover") scale *= 1.06 - 0.06 * ramp(frame, 0, 20);
  if (enter === "glitch" && frame < 8) {
    x += (random(`gx-${frame}`) - 0.5) * 80;
    filter = `hue-rotate(${Math.round(random(`gh-${frame}`) * 180)}deg) saturate(2)`;
  }

  if (exit === "fade") { opacity *= 1 - o; scale *= 1 - o * 0.03; }
  if (exit === "whip") x -= easeIn(o) * 2200;
  if (exit === "zoom") { scale *= 1 + easeIn(o) * 1.6; opacity *= 1 - easeIn(o); }

  return (
    <AbsoluteFill style={{ opacity, filter, transform: `translate(${x}px, ${y}px) scale(${scale})` }}>
      {children}
    </AbsoluteFill>
  );
};

// Captions, one phrase at a time, the spoken word lit in amber.
export const Captions = ({ hidden = [] }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS - INTRO;
  if (hidden.some(([a, b]) => t >= a && t < b)) return null;
  const i = phrases.findIndex((p, k) => {
    const next = phrases[k + 1];
    return t >= p.start - 0.12 && t < Math.min(next ? next.start - 0.12 : Infinity, p.end + 0.7);
  });
  if (i < 0) return null;
  const p = phrases[i];
  const inT = ramp(frame, Math.round((INTRO + p.start - 0.12) * FPS), 6);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 58 }}>
      <div style={{
        maxWidth: 1500, padding: "16px 34px", borderRadius: 22,
        background: "rgba(6,16,32,0.72)", border: "1px solid rgba(255,255,255,0.12)",
        fontFamily: FONT, fontSize: 46, fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.01em",
        textAlign: "center", opacity: inT, transform: `translateY(${(1 - inT) * 14}px)`,
      }}>
        {p.words.map((w, k) => {
          const said = t >= w.start - 0.03;
          const now = said && t < w.end + 0.05;
          return (
            <span key={k} style={{
              color: now ? C.amber : said ? "white" : "rgba(255,255,255,0.5)",
              display: "inline-block", marginRight: k < p.words.length - 1 ? "0.28em" : 0,
              transform: `scale(${now ? 1.06 : 1})`,
            }}>{w.text}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
