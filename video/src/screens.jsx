// The app's real screens, captured by capture/capture.mjs, and the pieces that
// sit on top of them: device frames, highlight rings and taps placed on the
// elements the capture located.
import { Img, staticFile } from "remotion";
import { BatteryFull, Signal, Wifi } from "lucide-react";
import screens from "./data/screens.json";
import { C } from "./theme";
import { pop, ramp } from "./anim";
import { shadowLg } from "./ui";

export const screen = (name) => {
  const s = screens[name];
  if (!s) throw new Error(`no captured screen "${name}" — run capture/run.sh`);
  return s;
};

// A box ([x, y, w, h] in CSS px) from the first of `names` that has it.
export const box = (key, ...names) => {
  for (const n of names) {
    const b = screen(n).boxes[key];
    if (b) return b;
  }
  throw new Error(`no box "${key}" in ${names.join(", ")}`);
};

export const centre = ([x, y, w, h], k) => [(x + w / 2) * k, (y + h / 2) * k];

const src = (name) => staticFile(`screens/${name}.webp`);

// One captured state, `width` px wide, panned down by `scrollY` CSS px and cut
// to `height` CSS px. Children render in the screen's own coordinates: pass a
// function and it receives the scale k (display px per CSS px).
export const ScreenView = ({ name, width, height, scrollY = 0, opacity = 1, children }) => {
  const s = screen(name);
  const k = width / s.width;
  const h = height ?? s.height;
  return (
    <div style={{ position: "absolute", inset: 0, width, height: h * k, overflow: "hidden", opacity }}>
      <div style={{ position: "absolute", left: 0, top: -scrollY * k, width, height: s.height * k }}>
        <Img src={src(name)} style={{ width, height: s.height * k, display: "block" }} />
        {typeof children === "function" ? children(k) : children}
      </div>
    </div>
  );
};

// A sequence of captured states that cut or cross-fade into each other.
// `states` is [[name, fromFrame], ...] in order; `overlay(k, name)` draws on top.
export const States = ({ frame, states, width, height, scrollY = 0, fade = 6, overlay }) => {
  let i = 0;
  states.forEach(([, from], j) => { if (frame >= from) i = j; });
  const [name, from] = states[i];
  const prev = i > 0 ? states[i - 1][0] : null;
  const k = width / screen(name).width;
  const h = (height ?? screen(name).height) * k;
  const sy = typeof scrollY === "function" ? scrollY(name) : scrollY;
  return (
    <div style={{ position: "relative", width, height: h, overflow: "hidden" }}>
      {prev && <ScreenView name={prev} width={width} height={height} scrollY={sy} />}
      <ScreenView name={name} width={width} height={height} scrollY={sy}
        opacity={fade ? ramp(frame, from, fade) : 1} />
      {overlay && (
        <div style={{ position: "absolute", left: 0, top: -sy * k, width, height: screen(name).height * k }}>
          {overlay(k, name)}
        </div>
      )}
    </div>
  );
};

// An amber ring drawn around a located element.
export const Ring = ({ frame, at, until = Infinity, b, k, color = C.amber, pad = 8, radius = 16 }) => {
  if (frame < at - 1 || frame > until + 10) return null;
  const p = pop(frame, at, { damping: 12 });
  const out = Number.isFinite(until) ? ramp(frame, until, 10) : 0;
  const [x, y, w, h] = b;
  return (
    <div style={{
      position: "absolute", left: x * k - pad, top: y * k - pad, width: w * k + pad * 2, height: h * k + pad * 2,
      borderRadius: radius, border: `4px solid ${color}`, opacity: Math.min(1, p) * (1 - out),
      boxShadow: `0 0 0 ${6 * p}px ${color}33, 0 0 30px ${color}66`, transform: `scale(${1.08 - 0.08 * p})`,
      pointerEvents: "none", zIndex: 40,
    }} />
  );
};

// A phone showing the real mobile screens (captured at 390×844 CSS px).
export const PhoneFrame = ({ width = 420, children, style, offline = 0, time = "10:24" }) => {
  const bezel = width * 0.035;
  const inner = width - bezel * 2;
  const bar = inner * 0.1;
  const screenH = inner * 844 / 390;
  return (
    <div style={{
      width, height: bar + screenH + bezel * 2, padding: bezel, borderRadius: width * 0.14,
      background: "#0b1220", border: "2px solid #26324a", boxShadow: shadowLg, ...style,
    }}>
      <div style={{ width: inner, height: bar + screenH, borderRadius: width * 0.11, overflow: "hidden", background: "white" }}>
        <div style={{
          height: bar, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: `0 ${inner * 0.08}px`, fontSize: inner * 0.04, fontWeight: 700, color: C.fg,
          position: "relative", background: "white",
        }}>
          <span>{time}</span>
          <div style={{
            position: "absolute", left: "50%", top: bar * 0.22, transform: "translateX(-50%)",
            width: inner * 0.3, height: bar * 0.62, borderRadius: 99, background: "#0b1220",
          }} />
          <span style={{ display: "flex", gap: inner * 0.015, alignItems: "center" }}>
            <Signal size={inner * 0.045} strokeWidth={2.6} />
            <span style={{ position: "relative", display: "inline-flex" }}>
              <Wifi size={inner * 0.045} strokeWidth={2.6} style={{ opacity: 1 - offline * 0.65 }} />
              {offline > 0 && (
                <span style={{
                  position: "absolute", left: "-15%", top: "45%", width: `${130 * offline}%`, height: 3,
                  background: C.danger, transform: "rotate(-45deg)", borderRadius: 2,
                }} />
              )}
            </span>
            <BatteryFull size={inner * 0.055} strokeWidth={2.2} />
          </span>
        </div>
        <div style={{ position: "relative", width: inner, height: screenH, overflow: "hidden" }}>
          {typeof children === "function" ? children(inner) : children}
        </div>
      </div>
    </div>
  );
};

export const phoneScreenWidth = (width = 420) => width - width * 0.035 * 2;
