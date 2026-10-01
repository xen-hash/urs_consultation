// After Effects-style effects, built from plain React and CSS: a 3D camera
// with depth layers, kinetic and glitch type, light leaks, a lens flare,
// scene-transition wipes, film grain and a vignette.
import { AbsoluteFill, Easing, interpolate, random, staticFile } from "remotion";
import { C } from "./theme";
import { keys, pop, ramp } from "./anim";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

// ── 3D camera ─────────────────────────────────────────────────────────────

// A camera looking at a scene whose layers sit at different depths. `rx`/`ry`
// orbit it (degrees), `z` dollies it in.
export const Camera3D = ({ rx = 0, ry = 0, z = 0, perspective = 2200, children }) => (
  <AbsoluteFill style={{ perspective, perspectiveOrigin: "50% 45%" }}>
    <AbsoluteFill style={{
      transformStyle: "preserve-3d",
      transform: `translateZ(${z}px) rotateX(${rx}deg) rotateY(${ry}deg)`,
    }}>{children}</AbsoluteFill>
  </AbsoluteFill>
);

// One layer of the scene, `z` px towards the camera, out of focus by `blur` px.
export const Depth = ({ z = 0, blur = 0, children }) => (
  <AbsoluteFill style={{
    transformStyle: "preserve-3d", transform: `translateZ(${z}px)`,
    filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
  }}>{children}</AbsoluteFill>
);

// A slow orbit and push-in across a scene: swings in from the side, drifts,
// and settles, the way a camera would on a 3D layer comp.
export const drift = (frame, len, { swing = 14, dolly = 70, tilt = 4 } = {}) => {
  const enter = interpolate(frame, [0, 26], [1, 0], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const t = frame / Math.max(1, len);
  return {
    ry: -swing * enter + interpolate(t, [0, 1], [-3, 3]),
    rx: tilt * enter + interpolate(t, [0, 1], [1.5, -1.5]),
    z: -260 * enter + dolly * t,
  };
};

// ── Type ──────────────────────────────────────────────────────────────────

// Letters that fly in one after another: up from below, rotating in from
// flat, out of a blur.
export const KineticText = ({ text, frame, at, stagger = 1.1, style, colorOf }) => {
  let n = 0;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", columnGap: "0.28em", perspective: 800, ...style }}>
      {text.split(" ").map((word, w) => (
        <span key={w} style={{ display: "inline-flex", whiteSpace: "nowrap" }}>
          {[...word].map((ch, i) => {
            const k = n++;
            const p = pop(frame, at + k * stagger, { damping: 13, stiffness: 140 });
            const o = ramp(frame, at + k * stagger, 6);
            return (
              <span key={i} style={{
                display: "inline-block", opacity: o, color: colorOf?.(w, word),
                transform: `translateY(${(1 - p) * 0.7}em) rotateX(${(1 - p) * -80}deg) scale(${0.6 + 0.4 * p})`,
                filter: p < 0.97 ? `blur(${(1 - Math.min(1, p)) * 10}px)` : undefined,
                transformOrigin: "50% 100%",
              }}>{ch}</span>
            );
          })}
        </span>
      ))}
    </span>
  );
};

const glitchAmount = (frame, at, dur) => {
  if (frame < at || frame > at + dur) return 0;
  return 1 - (frame - at) / dur;
};

// Text that tears into RGB-split slices for `dur` frames from `at`.
export const GlitchText = ({ children, frame, at, dur = 9, style }) => {
  const g = glitchAmount(frame, at, dur);
  if (!g) return <span style={{ position: "relative", display: "inline-block", ...style }}>{children}</span>;
  const r = (s) => random(`${s}-${frame}`) - 0.5;
  const slices = [0, 1, 2, 3, 4];
  return (
    <span style={{ position: "relative", display: "inline-block", ...style }}>
      <span style={{ visibility: "hidden" }}>{children}</span>
      {["#ff2a6d", "#05d9e8"].map((col, i) => (
        <span key={col} aria-hidden style={{
          position: "absolute", inset: 0, color: col, mixBlendMode: "screen", opacity: 0.9,
          transform: `translate(${(i ? 1 : -1) * (6 + 14 * g) + r(`c${i}`) * 10}px, ${r(`v${i}`) * 4}px)`,
        }}>{children}</span>
      ))}
      {slices.map((s) => (
        <span key={s} aria-hidden style={{
          position: "absolute", inset: 0,
          clipPath: `inset(${s * 20}% 0 ${100 - (s + 1) * 20}% 0)`,
          transform: `translateX(${r(`s${s}`) * 50 * g}px)`,
        }}>{children}</span>
      ))}
    </span>
  );
};

// ── Light ─────────────────────────────────────────────────────────────────

// Warm light washing across the frame, the way film light leaks do.
export const LightLeak = ({ frame, at, dur = 40, from = "left", strength = 1 }) => {
  const t = (frame - at) / dur;
  if (t < 0 || t > 1) return null;
  const bell = Math.sin(Math.PI * t);
  const sweep = from === "left" ? -400 + t * 2600 : 2300 - t * 2600;
  return (
    <AbsoluteFill style={{
      mixBlendMode: "screen", opacity: bell * 0.85 * strength, pointerEvents: "none",
      background: [
        `radial-gradient(ellipse 620px 900px at ${sweep}px 300px, rgba(255,170,40,0.95), transparent 70%)`,
        `radial-gradient(ellipse 500px 700px at ${sweep + 260}px 760px, rgba(255,80,60,0.55), transparent 70%)`,
        `radial-gradient(ellipse 400px 400px at ${sweep - 200}px 900px, rgba(255,230,160,0.6), transparent 70%)`,
      ].join(", "),
    }} />
  );
};

// A lens flare whose source travels from (x0, y0) to (x1, y1) over `dur`.
export const LensFlare = ({ frame, at, dur = 36, x0, y0, x1, y1, strength = 1 }) => {
  const t = (frame - at) / dur;
  if (t < 0 || t > 1) return null;
  const e = Easing.inOut(Easing.cubic)(t);
  const x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e;
  const a = Math.sin(Math.PI * t) * strength;
  // Ghosts sit on the line from the source through the frame's centre.
  const cx = 960, cy = 540;
  const ghosts = [[-0.4, 70, "rgba(120,180,255,0.35)"], [-0.8, 130, "rgba(255,170,60,0.22)"], [-1.3, 46, "rgba(140,255,200,0.3)"], [-1.7, 190, "rgba(255,120,200,0.14)"]];
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", opacity: a, pointerEvents: "none" }}>
      <div style={{
        position: "absolute", left: x - 260, top: y - 260, width: 520, height: 520, borderRadius: 999,
        background: "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,214,140,0.85) 8%, rgba(255,160,0,0.35) 26%, transparent 62%)",
      }} />
      <div style={{
        position: "absolute", left: x - 900, top: y - 4, width: 1800, height: 8, borderRadius: 8,
        background: "linear-gradient(90deg, transparent, rgba(255,200,120,0.7) 35%, white 50%, rgba(255,200,120,0.7) 65%, transparent)",
        filter: "blur(2px)",
      }} />
      <div style={{
        position: "absolute", left: x - 2, top: y - 240, width: 4, height: 480,
        background: "linear-gradient(transparent, rgba(255,230,200,0.5), transparent)",
      }} />
      {ghosts.map(([d, r, col], i) => {
        const gx = cx + (x - cx) * d, gy = cy + (y - cy) * d;
        return <div key={i} style={{
          position: "absolute", left: gx - r, top: gy - r, width: r * 2, height: r * 2, borderRadius: 999,
          background: `radial-gradient(circle, ${col}, transparent 70%)`, border: `1px solid ${col}`,
        }} />;
      })}
    </AbsoluteFill>
  );
};

// ── Transitions ───────────────────────────────────────────────────────────

// Navy, amber and white bars sweeping across, covering the cut at `at`.
export const ShapeWipe = ({ frame, at, dir = 1 }) => {
  const span = 26;
  if (frame < at - span / 2 - 4 || frame > at + span / 2 + 4) return null;
  const bars = [[C.amber, 0], [C.navy, 3], ["#f8fafc", 6]];
  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      {bars.map(([col, d], i) => {
        const x = keys(frame, [[at - span / 2 + d, -1.2], [at - 2 + d * 0.3, 0], [at + 2 + d * 0.3, 0], [at + span / 2 + d, 1.2]],
          Easing.inOut(Easing.cubic));
        return (
          <div key={i} style={{
            position: "absolute", top: -300, bottom: -300, left: -400, width: 2720,
            background: col, transform: `translateX(${x * 2900 * dir}px) skewX(-14deg)`,
            opacity: i === 2 ? 0.95 : 1, boxShadow: i === 0 ? `0 0 80px ${C.amber}` : undefined,
            clipPath: i === 2 ? "inset(0 0 0 86%)" : undefined,
          }} />
        );
      })}
    </AbsoluteFill>
  );
};

// An amber disc bursting out from (x, y), then a navy one, opening on the cut.
export const CircleWipe = ({ frame, at, x = 960, y = 540 }) => {
  if (frame < at - 14 || frame > at + 14) return null;
  const R = 2300;
  const amber = keys(frame, [[at - 14, 0], [at - 3, R]], Easing.in(Easing.cubic));
  const navy = keys(frame, [[at - 10, 0], [at, R]], Easing.in(Easing.cubic));
  const hole = keys(frame, [[at, 0], [at + 14, R]], Easing.out(Easing.cubic));
  const mask = `radial-gradient(circle at ${x}px ${y}px, transparent ${hole}px, black ${hole + 1}px)`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", maskImage: mask, WebkitMaskImage: mask }}>
      <div style={{ position: "absolute", inset: 0, background: C.amber, clipPath: `circle(${amber}px at ${x}px ${y}px)` }} />
      <div style={{ position: "absolute", inset: 0, background: C.navy900, clipPath: `circle(${navy}px at ${x}px ${y}px)` }} />
    </AbsoluteFill>
  );
};

// A flash of light on a cut.
export const Flash = ({ frame, at, color = "white", peak = 0.85 }) => {
  const a = keys(frame, [[at - 3, 0], [at, peak], [at + 8, 0]]);
  return a > 0 ? <AbsoluteFill style={{ background: color, opacity: a, pointerEvents: "none" }} /> : null;
};

// Digital tearing across the whole frame around a cut.
export const GlitchBars = ({ frame, at, dur = 12 }) => {
  if (frame < at - dur / 2 || frame > at + dur / 2) return null;
  const g = 1 - Math.abs(frame - at) / (dur / 2);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      {Array.from({ length: 9 }, (_, i) => {
        const r = (s) => random(`gb-${i}-${s}-${frame}`);
        const h = 6 + r("h") * 60;
        return (
          <div key={i} style={{
            position: "absolute", left: 0, right: 0, top: r("y") * 1080, height: h,
            background: ["#ff2a6d", "#05d9e8", "#ffffff", C.amber][i % 4],
            opacity: g * (0.25 + r("o") * 0.5), transform: `translateX(${(r("x") - 0.5) * 300}px)`,
          }} />
        );
      })}
    </AbsoluteFill>
  );
};

// ── Finish ────────────────────────────────────────────────────────────────

export const Grain = ({ frame, opacity = 0.09 }) => {
  const tile = Math.floor(frame / 2) % 4;
  const ox = Math.floor(random(`gx-${frame}`) * 256), oy = Math.floor(random(`gy-${frame}`) * 256);
  return (
    <AbsoluteFill style={{
      backgroundImage: `url(${staticFile(`fx/grain-${tile}.png`)})`, backgroundSize: "256px 256px",
      backgroundPosition: `${ox}px ${oy}px`, mixBlendMode: "overlay", opacity, pointerEvents: "none",
    }} />
  );
};

export const Vignette = () => (
  <AbsoluteFill style={{
    background: "radial-gradient(ellipse 75% 70% at 50% 48%, transparent 55%, rgba(0,6,18,0.55) 100%)",
    pointerEvents: "none",
  }} />
);

export const glow = (color = C.amber, r = 28) => `0 0 ${r}px ${color}88, 0 0 ${r * 2.5}px ${color}44`;

