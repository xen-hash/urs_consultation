import { Img, staticFile, Easing, interpolate } from "remotion";
import { Lock, RotateCw } from "lucide-react";
import { C, FONT } from "./theme";
import { keys, ramp } from "./anim";

export const shadowLg = "0 40px 80px -24px rgba(0,16,40,0.55), 0 12px 28px -8px rgba(0,16,40,0.35)";

export const Logo = ({ size = 48, style }) => (
  <Img src={staticFile("urs-logo.png")}
       style={{ height: size, width: size * 2048 / 2575, ...style }} />
);

export const Navi = ({ pose = "happy", size = 256, style }) => (
  <Img src={staticFile(`navi-${pose}.png`)} style={{ width: size, ...style }} />
);

// Desktop browser frame around an app screen.
export const Window = ({ path = "", width, height, children, style, dark = false }) => (
  <div style={{
    width, height, borderRadius: 26, overflow: "hidden", background: C.canvas,
    boxShadow: shadowLg, border: "1px solid rgba(255,255,255,0.35)",
    display: "flex", flexDirection: "column", ...style,
  }}>
    <div style={{
      height: 56, flexShrink: 0, background: dark ? "#0f1b2d" : "#eef2f7",
      display: "flex", alignItems: "center", gap: 18, padding: "0 22px",
      borderBottom: `1px solid ${dark ? "#1e2c44" : C.border}`,
    }}>
      <div style={{ display: "flex", gap: 9 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 14, height: 14, borderRadius: 99, background: c }} />
        ))}
      </div>
      <div style={{
        flex: 1, maxWidth: 620, margin: "0 auto", height: 34, borderRadius: 10,
        background: dark ? "#1b2a42" : "white", color: dark ? "#9fb3cc" : C.subtle,
        display: "flex", alignItems: "center", gap: 10, padding: "0 14px", fontSize: 16, fontWeight: 600,
      }}>
        <Lock size={15} strokeWidth={2.5} />
        <span>urs-consultation.vercel.app<span style={{ color: dark ? "#6f86a3" : "#94a3b8" }}>{path}</span></span>
        <RotateCw size={15} style={{ marginLeft: "auto" }} />
      </div>
      <div style={{ width: 60 }} />
    </div>
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>{children}</div>
  </div>
);

// A pointer that glides through [frame, x, y] waypoints and ripples on taps.
// Coordinates are relative to the nearest positioned ancestor.
export const Pointer = ({ frame, path, taps = [], appear = path[0][0], hide = Infinity, kind = "cursor" }) => {
  const x = keys(frame, path.map(([f, px]) => [f, px]));
  const y = keys(frame, path.map(([f, , py]) => [f, py]));
  const shown = ramp(frame, appear, 8) * (Number.isFinite(hide) ? 1 - ramp(frame, hide, 8) : 1);
  const lastTap = [...taps].reverse().find((t) => frame >= t);
  const since = lastTap === undefined ? 99 : frame - lastTap;
  const press = since < 6 ? interpolate(since, [0, 3, 6], [1, 0.82, 1]) : 1;
  const ripple = since < 18 ? since / 18 : null;
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 50, opacity: shown, pointerEvents: "none" }}>
      {ripple !== null && (
        <div style={{
          position: "absolute", left: -40 * ripple - 8, top: -40 * ripple - 8,
          width: 80 * ripple + 16, height: 80 * ripple + 16, borderRadius: 999,
          border: `4px solid ${C.amber}`, opacity: 1 - ripple,
        }} />
      )}
      {kind === "cursor" ? (
        <svg width="40" height="48" viewBox="0 0 20 24"
             style={{ transform: `scale(${press})`, transformOrigin: "0 0",
                      filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.35))" }}>
          <path d="M2 1.5 L2 19 L6.6 14.8 L9.6 21.6 L12.6 20.3 L9.7 13.6 L16 13.6 Z"
                fill="white" stroke="#0f172a" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      ) : (
        <div style={{
          width: 54, height: 54, marginLeft: -27, marginTop: -27, borderRadius: 999,
          background: "rgba(255,255,255,0.55)", border: "3px solid white",
          boxShadow: "0 6px 18px rgba(0,0,0,0.35)", transform: `scale(${press})`,
        }} />
      )}
    </div>
  );
};

// Types `text` out between two frames, with a caret while typing.
export const Typed = ({ frame, text, from, to, caret = true, style }) => {
  const n = Math.round(interpolate(frame, [from, to], [0, text.length],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.linear }));
  const typing = frame >= from - 8 && frame <= to + 20;
  return (
    <span style={style}>
      {text.slice(0, n)}
      {caret && typing && (
        <span style={{ display: "inline-block", width: 3, height: "1.05em", marginLeft: 2,
                       verticalAlign: "text-bottom", background: "currentColor",
                       opacity: Math.floor(frame / 8) % 2 ? 0.2 : 1 }} />
      )}
    </span>
  );
};

export const Pill = ({ children, style }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 14, padding: "16px 28px", borderRadius: 999,
    background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.22)",
    color: "white", fontWeight: 800, fontSize: 34, fontFamily: FONT, backdropFilter: "blur(8px)", ...style,
  }}>{children}</div>
);

// Small caps heading used to label each scene.
export const Kicker = ({ children, style }) => (
  <div style={{
    color: C.amber, fontWeight: 800, fontSize: 22, letterSpacing: "0.22em",
    textTransform: "uppercase", ...style,
  }}>{children}</div>
);
