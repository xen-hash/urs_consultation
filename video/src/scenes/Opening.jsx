import { AbsoluteFill } from "remotion";
import { Check, Clock, X } from "lucide-react";
import { C, FONT } from "../theme";
import { cue, FPS } from "../timing";
import { keys, pop, ramp, useScene } from "../anim";
import { Kicker, Logo, Navi } from "../ui";

// 0–3s, before the narration: the seal draws itself in.
export const ColdOpen = () => {
  const { frame } = useScene();
  const s = pop(frame, 4, { damping: 12 });
  const ring = ramp(frame, 2, 40);
  const out = keys(frame, [[70, 0], [92, 1]]);
  const r = 250;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      <div style={{ position: "relative", transform: `scale(${1 + out * 1.6})`, opacity: 1 - out }}>
        <svg width={r * 2 + 40} height={r * 2 + 40}
             style={{ position: "absolute", left: -(r + 20) + 170, top: -(r + 20) + 214 }}>
          <circle cx={r + 20} cy={r + 20} r={r} fill="none" stroke={C.amber} strokeWidth={6}
                  strokeDasharray={2 * Math.PI * r} strokeDashoffset={2 * Math.PI * r * (1 - ring)}
                  strokeLinecap="round" transform={`rotate(-90 ${r + 20} ${r + 20})`} />
          <circle cx={r + 20} cy={r + 20} r={r + 16} fill="none" stroke="rgba(255,255,255,0.18)"
                  strokeWidth={2} strokeDasharray="4 14" opacity={ring} />
        </svg>
        <Logo size={428} style={{ transform: `scale(${s})`, display: "block" }} />
      </div>
      <div style={{
        position: "absolute", bottom: 150, color: "white", fontWeight: 700, fontSize: 30,
        letterSpacing: "0.32em", opacity: ramp(frame, 22, 14) * (1 - out),
      }}>UNIVERSITY OF RIZAL SYSTEM</div>
    </AbsoluteFill>
  );
};

// "Waiting outside the faculty room... again?"
export const Hook = () => {
  const { frame, at } = useScene();
  const tWait = at(cue("waiting"));
  const tAgain = at(cue("again"));
  const tChecked = at(cue("you checked"));
  const tWalked = at(cue("walked"));
  const tNotIn = at(cue("isn't even in"));
  const tMinute = at(cue("between classes"));

  // The door plaque swings, then flips to OUT when the professor isn't in.
  const swing = Math.sin(frame / 9) * 5 * (1 - ramp(frame, tNotIn, 20));
  const outFlip = ramp(frame, tNotIn, 10);
  const shake = frame > tNotIn && frame < tNotIn + 16 ? Math.sin(frame * 2.2) * 10 * (1 - (frame - tNotIn) / 16) : 0;

  // Right-hand column: "Waiting..." → checklist → countdown.
  const headOut = ramp(frame, tChecked - 4, 10);
  const listOut = ramp(frame, tMinute - 4, 10);
  const rows = [
    { t: at(cue("checked")), text: "Checked the schedule", ok: true },
    { t: tWalked, text: "Walked across campus", ok: true },
    { t: at(cue("your professor", 5)), text: "Professor is in", ok: false, mark: tNotIn },
  ];

  const clockAngle = frame * 14;
  const remaining = Math.max(0, 600 - Math.max(0, frame - tMinute) * 4.2);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(Math.floor(remaining % 60)).padStart(2, "0");
  const countIn = pop(frame, tMinute);

  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: "white" }}>
      {/* Door */}
      <div style={{
        position: "absolute", left: 250, top: 120, width: 400, height: 700, borderRadius: "22px 22px 0 0",
        background: "linear-gradient(180deg, #2b4a6f, #1b3352)", border: "10px solid #3d638f",
        borderBottom: "none", boxShadow: "inset 0 0 60px rgba(0,0,0,0.35)",
        opacity: ramp(frame, 0, 12), transform: `translateX(${shake}px)`,
      }}>
        {[0, 1].map((k) => (
          <div key={k} style={{
            position: "absolute", left: 40, right: 40, top: 60 + k * 300, height: 250, borderRadius: 12,
            border: "4px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.08)",
          }} />
        ))}
        <div style={{ position: "absolute", right: 34, top: 360, width: 22, height: 64, borderRadius: 11, background: C.amber }} />
        <div style={{
          position: "absolute", left: 70, right: 70, top: -2, height: 54, background: C.amber, color: C.navy900,
          fontWeight: 800, fontSize: 24, letterSpacing: "0.12em", display: "grid", placeItems: "center",
          borderRadius: "0 0 12px 12px",
        }}>FACULTY ROOM</div>
        {/* Hanging sign */}
        <div style={{
          position: "absolute", left: 95, top: 150, width: 210, transformOrigin: "50% -40px",
          transform: `rotate(${swing}deg) rotateY(${outFlip * 180}deg)`,
        }}>
          <svg width="210" height="40" style={{ position: "absolute", top: -40 }}>
            <path d="M40 40 L105 4 L170 40" stroke="#cbd5e1" strokeWidth="3" fill="none" />
          </svg>
          <div style={{
            height: 96, borderRadius: 14, display: "grid", placeItems: "center",
            background: outFlip > 0.5 ? C.danger : "white", color: outFlip > 0.5 ? "white" : C.navy,
            fontWeight: 800, fontSize: outFlip > 0.5 ? 46 : 58, boxShadow: "0 10px 20px rgba(0,0,0,0.3)",
            transform: `rotateY(${outFlip > 0.5 ? 180 : 0}deg)`,
          }}>{outFlip > 0.5 ? "OUT" : "?"}</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 180, top: 820, width: 560, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.18)" }} />

      {/* Navi waiting beside the door */}
      <Navi pose="bust" size={330} style={{
        position: "absolute", left: 590, top: 285, opacity: ramp(frame, 4, 12),
        transform: `translateY(${(1 - pop(frame, 4)) * 60}px)`,
        filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.4))",
      }} />

      {/* Waiting... again? */}
      <div style={{ position: "absolute", left: 1010, top: 250, opacity: 1 - headOut, transform: `translateY(${-headOut * 40}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30, opacity: ramp(frame, tWait, 10) }}>
          <div style={{ position: "relative", width: 110, height: 110, borderRadius: 99, border: "8px solid white" }}>
            {[clockAngle, clockAngle / 12].map((a, k) => (
              <div key={k} style={{
                position: "absolute", left: 47, top: k ? 26 : 12, width: 8, height: k ? 30 : 44, borderRadius: 4,
                background: k ? "white" : C.amber, transformOrigin: `4px ${k ? 30 : 44}px`, transform: `rotate(${a}deg)`,
              }} />
            ))}
          </div>
          <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: "-0.03em" }}>
            Waiting{".".repeat(1 + (Math.floor(frame / 8) % 3))}
          </div>
        </div>
        <div style={{
          fontSize: 150, fontWeight: 800, color: C.amber, marginTop: 10, marginLeft: 140,
          letterSpacing: "-0.03em", opacity: ramp(frame, tAgain, 4),
          transform: `scale(${0.6 + 0.4 * pop(frame, tAgain, { damping: 9 })}) rotate(-4deg)`, transformOrigin: "0 50%",
        }}>again?</div>
      </div>

      {/* Checklist */}
      <div style={{
        position: "absolute", left: 1000, top: 230, width: 800, display: "flex", flexDirection: "column", gap: 26,
        opacity: (1 - listOut) * ramp(frame, tChecked - 4, 8), transform: `translateY(${-listOut * 40}px)`,
      }}>
        <Kicker>Sound familiar?</Kicker>
        {rows.map((r, k) => {
          const inT = pop(frame, r.t - 2);
          const bad = r.mark !== undefined && frame >= r.mark;
          const markT = pop(frame, r.ok ? r.t + 6 : r.mark ?? 1e9, { damping: 10 });
          return (
            <div key={k} style={{
              display: "flex", alignItems: "center", gap: 26, padding: "26px 32px", borderRadius: 24,
              background: bad ? "rgba(220,38,38,0.18)" : "rgba(255,255,255,0.08)",
              border: `2px solid ${bad ? "rgba(239,68,68,0.7)" : "rgba(255,255,255,0.14)"}`,
              opacity: Math.min(1, inT * 1.4), transform: `translateX(${(1 - inT) * 80}px) translateX(${bad ? shake : 0}px)`,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 99, display: "grid", placeItems: "center", flexShrink: 0,
                background: r.ok ? C.success : C.danger, transform: `scale(${markT})`,
              }}>
                {r.ok ? <Check size={40} strokeWidth={3.5} color="white" /> : <X size={40} strokeWidth={3.5} color="white" />}
              </div>
              <div style={{
                fontSize: 50, fontWeight: 800, letterSpacing: "-0.02em",
                textDecoration: bad ? "line-through" : "none", textDecorationColor: C.danger, textDecorationThickness: 6,
                opacity: bad ? 0.8 : 1,
              }}>{r.text}</div>
            </div>
          );
        })}
      </div>

      {/* Every minute counts */}
      <div style={{
        position: "absolute", left: 1010, top: 210, width: 760, display: "flex", flexDirection: "column", alignItems: "center",
        opacity: ramp(frame, tMinute, 8), transform: `scale(${0.85 + 0.15 * countIn})`,
      }}>
        <Kicker>Next class in</Kicker>
        <div style={{ position: "relative", width: 380, height: 380, marginTop: 24 }}>
          <svg width="380" height="380" style={{ position: "absolute", transform: "rotate(-90deg)" }}>
            <circle cx="190" cy="190" r="170" stroke="rgba(255,255,255,0.12)" strokeWidth="22" fill="none" />
            <circle cx="190" cy="190" r="170" stroke={C.amber} strokeWidth="22" fill="none" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 170} strokeDashoffset={2 * Math.PI * 170 * (1 - remaining / 600)} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <Clock size={52} color={C.amber} strokeWidth={3} />
              <div style={{ fontSize: 96, fontWeight: 800, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{mm}:{ss}</div>
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 30, fontSize: 60, fontWeight: 800, letterSpacing: "-0.02em",
          opacity: ramp(frame, at(cue("every minute")), 8),
        }}>Every minute <span style={{ color: C.amber }}>counts.</span></div>
      </div>
    </AbsoluteFill>
  );
};

// "Meet the URS Faculty Consultation System. Faculty consultation, without the guesswork."
export const Title = () => {
  const { frame, at } = useScene();
  const tMeet = at(cue("meet"));
  const words = [
    ["URS", at(cue("u r s")), C.amber],
    ["Faculty", at(cue("faculty", 11)), "white"],
    ["Consultation", at(cue("consultation", 11)), "white"],
    ["System", at(cue("system", 11)), "white"],
  ];
  const tTag = at(cue("faculty consultation without"));
  const tWithout = at(cue("without the guesswork"));
  const sweep = ramp(frame, tWithout, Math.round(0.9 * FPS));
  const logoIn = pop(frame, tMeet - 6, { damping: 11 });
  const lift = ramp(frame, tTag - 4, 14);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT, color: "white" }}>
      {[0, 1, 2].map((k) => {
        const g = ((frame + k * 30) % 90) / 90;
        return (
          <div key={k} style={{
            position: "absolute", left: 960 - 200 - g * 500, top: 250 - 200 - g * 500,
            width: 400 + g * 1000, height: 400 + g * 1000, borderRadius: 9999,
            border: "2px solid rgba(255,160,0,0.35)", opacity: (1 - g) * 0.6,
          }} />
        );
      })}
      <div style={{ transform: `translateY(${-lift * 50}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Logo size={230} style={{
          transform: `scale(${logoIn})`, marginBottom: 34,
          filter: "drop-shadow(0 0 40px rgba(255,160,0,0.45))",
        }} />
        <div style={{ fontSize: 44, fontWeight: 700, color: C.brand200, opacity: ramp(frame, tMeet, 8), marginBottom: 6 }}>
          Meet the
        </div>
        <div style={{ display: "flex", gap: 30, fontSize: 118, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.1 }}>
          {words.map(([w, t, color]) => (
            <div key={w} style={{ overflow: "hidden", paddingBottom: 12 }}>
              <div style={{ color, transform: `translateY(${(1 - ramp(frame, t - 3, 12)) * 130}%)` }}>{w}</div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 30, fontSize: 56, fontWeight: 700, opacity: ramp(frame, tTag, 10),
          transform: `translateY(${(1 - ramp(frame, tTag, 14)) * 30}px)`,
        }}>
          Faculty consultation,{" "}
          <span style={{ position: "relative", color: C.amber, fontWeight: 800 }}>
            without the guesswork.
            <span style={{
              position: "absolute", left: 0, bottom: -10, height: 8, borderRadius: 4, background: C.amber,
              width: `${sweep * 100}%`,
            }} />
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

