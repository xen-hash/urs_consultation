import { Img, staticFile, Easing, interpolate } from "remotion";
import { Lock, RotateCw, Wifi, BatteryFull, Signal } from "lucide-react";
import { C, FONT, STATUS, avatarTint, initials } from "./theme";
import { keys, ramp } from "./anim";

export const shadowLg = "0 40px 80px -24px rgba(0,16,40,0.55), 0 12px 28px -8px rgba(0,16,40,0.35)";

export const Logo = ({ size = 48, style }) => (
  <Img src={staticFile("urs-logo.png")}
       style={{ height: size, width: size * 2048 / 2575, ...style }} />
);

export const Navi = ({ pose = "happy", size = 256, style }) => (
  <Img src={staticFile(`navi-${pose}.png`)} style={{ width: size, ...style }} />
);

export const StatusBadge = ({ status, scale = 1, style }) => {
  const s = STATUS[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 8 * scale,
      padding: `${6 * scale}px ${14 * scale}px`, borderRadius: 999,
      background: s.bg, color: s.fg, fontWeight: 700, fontSize: 17 * scale,
      whiteSpace: "nowrap", ...style,
    }}>
      <span style={{ width: 10 * scale, height: 10 * scale, borderRadius: 99, background: s.dot,
                     boxShadow: `0 0 0 ${4 * scale}px ${s.dot}33` }} />
      {status}
    </span>
  );
};

export const Avatar = ({ name, size = 56 }) => (
  <div style={{
    width: size, height: size, borderRadius: 999, flexShrink: 0,
    background: avatarTint(name), color: "white", fontWeight: 800,
    fontSize: size * 0.38, display: "grid", placeItems: "center", letterSpacing: "0.02em",
  }}>{initials(name)}</div>
);

// A faculty card as the availability board draws it. `status` may change
// over time; `flash` (0–1) rings the card when it just did.
export const FacultyCard = ({ f, status = f.status, scale = 1, flash = 0, dim = 0, glow = 0, style }) => (
  <div style={{
    background: C.surface, borderRadius: 20 * scale, padding: 22 * scale,
    border: `${2 * scale}px solid ${glow ? STATUS[status].dot : C.border}`,
    boxShadow: [
      "0 2px 6px rgba(15,23,42,0.06)",
      glow ? `0 0 0 ${6 * scale * glow}px ${STATUS[status].dot}40, 0 18px 40px -12px ${STATUS[status].dot}80` : null,
      flash ? `0 0 0 ${10 * scale * flash}px ${STATUS[status].dot}55` : null,
    ].filter(Boolean).join(", "),
    opacity: 1 - dim * 0.6, filter: dim ? `saturate(${1 - dim * 0.7})` : undefined,
    display: "flex", flexDirection: "column", gap: 14 * scale, ...style,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14 * scale }}>
      <Avatar name={f.name} size={54 * scale} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 20 * scale, color: C.fg, whiteSpace: "nowrap" }}>{f.name}</div>
        <div style={{ fontSize: 15 * scale, color: C.subtle, fontWeight: 600, whiteSpace: "nowrap" }}>{f.dept}</div>
      </div>
    </div>
    <StatusBadge status={status} scale={scale} style={{ alignSelf: "flex-start" }} />
  </div>
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

// The navy bar across the top of every portal.
export const AppHeader = ({ title = "URS Consultation", role, right, scale = 1 }) => (
  <div style={{
    height: 76 * scale, flexShrink: 0, background: `linear-gradient(90deg, ${C.navy}, ${C.brand500})`,
    color: "white", display: "flex", alignItems: "center", gap: 14 * scale, padding: `0 ${26 * scale}px`,
  }}>
    <Logo size={46 * scale} />
    <div style={{ fontWeight: 800, fontSize: 22 * scale, letterSpacing: "-0.01em" }}>{title}</div>
    {role && (
      <span style={{
        marginLeft: 6 * scale, padding: `${4 * scale}px ${12 * scale}px`, borderRadius: 999,
        background: "rgba(255,160,0,0.18)", color: C.amber, fontWeight: 700, fontSize: 15 * scale,
        border: "1px solid rgba(255,160,0,0.45)",
      }}>{role}</span>
    )}
    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 * scale }}>{right}</div>
  </div>
);

// A phone with a status bar; children fill the screen.
export const Phone = ({ width = 390, children, style, time = "9:41", offline = 0 }) => {
  const h = width * 2.05;
  return (
    <div style={{
      width, height: h, borderRadius: width * 0.14, background: "#0b1220", padding: width * 0.035,
      boxShadow: shadowLg, border: "2px solid #26324a", ...style,
    }}>
      <div style={{
        width: "100%", height: "100%", borderRadius: width * 0.11, overflow: "hidden",
        background: C.canvas, position: "relative", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          height: width * 0.12, flexShrink: 0, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: `0 ${width * 0.07}px`,
          fontSize: width * 0.042, fontWeight: 700, color: C.fg, position: "relative", zIndex: 5,
        }}>
          <span>{time}</span>
          <div style={{
            position: "absolute", left: "50%", top: width * 0.03, transform: "translateX(-50%)",
            width: width * 0.3, height: width * 0.075, borderRadius: 99, background: "#0b1220",
          }} />
          <span style={{ display: "flex", gap: width * 0.015, alignItems: "center" }}>
            <Signal size={width * 0.045} strokeWidth={2.6} />
            <span style={{ position: "relative", display: "inline-flex" }}>
              <Wifi size={width * 0.045} strokeWidth={2.6} style={{ opacity: 1 - offline * 0.65 }} />
              {offline > 0 && (
                <span style={{
                  position: "absolute", left: "-15%", top: "45%", width: `${130 * offline}%`, height: 3,
                  background: C.danger, transform: "rotate(-45deg)", borderRadius: 2,
                }} />
              )}
            </span>
            <BatteryFull size={width * 0.055} strokeWidth={2.2} />
          </span>
        </div>
        <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </div>
    </div>
  );
};

// A pointer that glides through [frame, x, y] waypoints and ripples on taps.
// Coordinates are relative to the nearest positioned ancestor.
export const Pointer = ({ frame, path, taps = [], appear = path[0][0], hide = Infinity, kind = "cursor" }) => {
  const x = keys(frame, path.map(([f, px]) => [f, px]));
  const y = keys(frame, path.map(([f, , py]) => [f, py]));
  const shown = ramp(frame, appear, 8) * (1 - ramp(frame, hide, 8));
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
