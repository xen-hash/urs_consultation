import { AbsoluteFill } from "remotion";
import { CalendarClock, CheckCircle2, RefreshCw, Search, Radio } from "lucide-react";
import { C, FACULTY, FONT, STATUS } from "../theme";
import { cue } from "../timing";
import { keys, pop, ramp, useScene } from "../anim";
import { AppHeader, Avatar, FacultyCard, Kicker, Phone, Pointer, StatusBadge, Window } from "../ui";

const LivePill = ({ frame }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 16px", borderRadius: 999,
    background: "rgba(255,255,255,0.12)", fontWeight: 800, fontSize: 17, letterSpacing: "0.08em",
  }}>
    <span style={{
      width: 12, height: 12, borderRadius: 99, background: "#ef4444",
      boxShadow: `0 0 0 ${4 + 4 * Math.abs(Math.sin(frame / 8))}px rgba(239,68,68,0.3)`,
    }} />LIVE
  </span>
);

// "Open the live availability board, and see in real time who's available,
//  who's not, and who's on leave. No more guessing. No more wasted trips."
export const Board = () => {
  const { frame, at } = useScene();
  const tOpen = at(cue("open the live"));
  const tLive = at(cue("real time"));
  const focus = [
    [at(cue("who's available")), "Available"],
    [at(cue("who's not")), "Not Available"],
    [at(cue("who's on leave")), "On Leave"],
  ];
  const tDone = at(cue("no more guessing"));
  const current = frame >= tDone ? null : [...focus].reverse().find(([t]) => frame >= t)?.[1] ?? null;
  const focusT = current ? ramp(frame, focus.find(([, s]) => s === current)[0], 8) : 0;

  const enter = ramp(frame, 0, 22);
  const push = keys(frame, [[tDone, 0], [tDone + 60, 1]]);

  const statusOf = (f, k) => (k === 1 && frame >= tLive ? "Available" : f.status);
  const chips = ["All", "Available", "Not Available", "On Leave"];

  return (
    <AbsoluteFill style={{ fontFamily: FONT, perspective: 1800 }}>
      <Window path="/availability" width={1600} height={800} style={{
        position: "absolute", left: 160, top: 48,
        transform: `rotateX(${(1 - enter) * 14}deg) scale(${0.94 + enter * 0.06 + push * 0.03})`,
        transformOrigin: "50% 100%",
      }}>
        <AppHeader title="Faculty Availability" right={<>
          <span style={{ fontWeight: 700, fontSize: 18, opacity: 0.8 }}>10:24 AM · Monday</span>
          <LivePill frame={frame} />
        </>} />
        <div style={{ padding: "24px 34px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{
              width: 420, height: 54, borderRadius: 14, background: "white", border: `2px solid ${C.border}`,
              display: "flex", alignItems: "center", gap: 12, padding: "0 18px", color: C.subtle, fontSize: 18, fontWeight: 600,
            }}><Search size={22} />Search faculty or department</div>
            {chips.map((c) => {
              const on = c === (current ?? "All");
              const col = STATUS[c]?.fg ?? C.navy;
              return (
                <span key={c} style={{
                  padding: "12px 22px", borderRadius: 999, fontWeight: 800, fontSize: 18,
                  background: on ? col : "white", color: on ? "white" : C.muted,
                  border: `2px solid ${on ? col : C.border}`, transform: `scale(${on && current ? 1 + 0.06 * focusT : 1})`,
                }}>{c}</span>
              );
            })}
            <span style={{
              marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 700,
              color: C.success, opacity: ramp(frame, tDone, 10),
            }}><CheckCircle2 size={22} />Updated just now</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
            {FACULTY.map((f, k) => {
              const inT = pop(frame, tOpen + 4 + k * 2);
              const status = statusOf(f, k);
              const lit = current === status;
              return (
                <FacultyCard key={f.name} f={f} status={status} scale={1.06}
                  glow={lit ? focusT : 0} dim={current && !lit ? focusT : 0}
                  flash={k === 1 ? keys(frame, [[tLive, 1], [tLive + 18, 0]]) * (frame >= tLive ? 1 : 0) : 0}
                  style={{ opacity: Math.min(1, inT * 1.3), transform: `translateY(${(1 - inT) * 40}px) scale(${lit ? 1 + 0.03 * focusT : 1})` }} />
              );
            })}
          </div>
        </div>
      </Window>
    </AbsoluteFill>
  );
};

const SCHEDULE = [
  { from: "8:00", to: "10:00", what: "CE 211 · Structural Analysis", kind: "Class" },
  { from: "10:00", to: "12:00", what: "Consultation hours", kind: "Consult" },
  { from: "1:00", to: "3:00", what: "CE 305 · Hydraulics", kind: "Class" },
];

// "For faculty, it's just as easy. Your status updates itself from your
//  schedule. Stepping out? Change it with one tap, and every student sees it instantly."
export const Faculty = () => {
  const { frame, at } = useScene();
  const tAuto = at(cue("your status updates"));
  const tFlip = at(cue("from your schedule"));
  const tStep = at(cue("stepping out"));
  const tTap = at(cue("one tap"));
  const me = FACULTY[0];

  const status = frame >= tTap + 3 ? "Not Available" : frame >= tFlip ? "Available" : "Not Available";
  const source = frame >= tTap + 3 ? "Set by you" : "Auto · from your schedule";
  // Students see each change a few frames later, over the network.
  const seen = frame >= tTap + 9 ? "Not Available" : frame >= tFlip + 6 ? "Available" : "Not Available";
  const lastChange = frame >= tTap + 9 ? tTap + 9 : frame >= tFlip + 6 ? tFlip + 6 : -99;
  const flash = keys(frame, [[lastChange, 1], [lastChange + 20, 0]]) * (frame >= lastChange ? 1 : 0);
  const pulse = (t0) => ramp(frame, t0, 10);

  // The "now" marker slides from 9:52 into consultation hours.
  const nowY = keys(frame, [[tAuto, 0], [tFlip, 1]]);
  const clock = frame < tFlip ? `9:5${Math.min(9, 2 + Math.floor(nowY * 8))}` : "10:00";
  const options = ["Auto", "Available", "Not Available", "On Leave"];
  const selected = frame >= tTap + 3 ? "Not Available" : "Auto";

  const winIn = ramp(frame, 0, 18);
  const phoneIn = pop(frame, 10);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Kicker style={{ position: "absolute", left: 120, top: 44, opacity: winIn }}>Teacher portal</Kicker>
      <Window path="/teacher" width={850} height={676} style={{
        position: "absolute", left: 110, top: 92, opacity: winIn,
        transform: `translateX(${(1 - winIn) * -60}px) scale(1.2)`, transformOrigin: "0 0",
      }}>
        <AppHeader title="URS Consultation" role="Teacher" />
        <div style={{ padding: "26px 32px", display: "flex", flexDirection: "column", gap: 22, position: "relative" }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: C.fg }}>Good morning, Engr. Villareal</div>
          <div style={{
            background: "white", borderRadius: 20, padding: 24, border: `2px solid ${C.border}`,
            display: "flex", flexDirection: "column", gap: 18,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span style={{ fontWeight: 800, fontSize: 21, color: C.muted }}>My status</span>
              <StatusBadge status={status} scale={1.25} style={{
                boxShadow: flash ? `0 0 0 ${8 * flash}px ${STATUS[status].dot}44` : undefined,
              }} />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.subtle, fontWeight: 700, fontSize: 17 }}>
                <RefreshCw size={18} style={{ transform: `rotate(${frame >= tAuto && frame < tTap ? frame * 8 : 0}deg)` }} />
                {source}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, background: C.canvas, padding: 6, borderRadius: 14 }}>
              {options.map((o) => (
                <div key={o} style={{
                  flex: 1, textAlign: "center", padding: "14px 0", borderRadius: 10, fontWeight: 800, fontSize: 18,
                  background: selected === o ? (STATUS[o]?.fg ?? C.navy) : "transparent",
                  color: selected === o ? "white" : C.muted,
                }}>{o === "Auto" ? "Auto (schedule)" : o}</div>
              ))}
            </div>
          </div>
          <div style={{ background: "white", borderRadius: 20, padding: "20px 24px", border: `2px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 21, color: C.muted, marginBottom: 12 }}>
              <CalendarClock size={22} />Today's schedule
            </div>
            <div style={{ position: "relative" }}>
              {SCHEDULE.map((s) => (
                <div key={s.from} style={{
                  display: "flex", alignItems: "center", gap: 20, height: 62, borderBottom: `1px solid ${C.border}`,
                }}>
                  <span style={{ width: 150, fontWeight: 800, fontSize: 19, color: C.fg }}>{s.from} – {s.to}</span>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 19, color: C.muted }}>{s.what}</span>
                  <span style={{
                    padding: "5px 14px", borderRadius: 99, fontWeight: 800, fontSize: 15,
                    background: s.kind === "Class" ? C.brand50 : C.success50, color: s.kind === "Class" ? C.navy : C.success,
                  }}>{s.kind === "Class" ? "In class" : "Consultation"}</span>
                </div>
              ))}
              <div style={{
                position: "absolute", left: -12, right: 0, top: 48 + nowY * 14, height: 3, background: C.amber,
                opacity: ramp(frame, tAuto - 6, 8),
              }}>
                <span style={{
                  position: "absolute", left: -2, top: -15, padding: "4px 10px", borderRadius: 8, background: C.amber,
                  color: C.navy900, fontWeight: 800, fontSize: 15,
                }}>Now {clock}</span>
              </div>
            </div>
          </div>
          <Pointer frame={frame} appear={tStep}
            path={[[tStep, 420, 380], [tTap - 4, 500, 205], [tTap + 20, 510, 214]]} taps={[tTap]} hide={tTap + 40} />
        </div>
      </Window>

      {/* Sync wave from the dashboard to the student's phone */}
      {[tFlip, tTap + 3].map((t0) => {
        const p = pulse(t0);
        return p > 0 && p < 1 ? (
          <div key={t0} style={{
            position: "absolute", left: 1150 + p * 180, top: 420, width: 40, height: 40, borderRadius: 99,
            background: C.amber, opacity: 1 - p * 0.6, boxShadow: `0 0 30px ${C.amber}`,
          }} />
        ) : null;
      })}

      <Kicker style={{ position: "absolute", left: 1370, top: 44, opacity: phoneIn }}>Students see</Kicker>
      <Phone width={400} style={{
        position: "absolute", left: 1370, top: 92, transform: `translateY(${(1 - phoneIn) * 120}px) scale(0.92)`,
        transformOrigin: "50% 0",
      }}>
        <div style={{ background: C.navy, color: "white", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 19 }}>
          <Radio size={20} color={C.amber} />Availability
        </div>
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {[me, FACULTY[2], FACULTY[4], FACULTY[6], FACULTY[1], FACULTY[3]].map((f, k) => {
            const st = k === 0 ? seen : f.status;
            return (
              <div key={f.name} style={{
                background: "white", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14,
                border: `2px solid ${k === 0 && flash ? STATUS[st].dot : C.border}`,
                boxShadow: k === 0 && flash ? `0 0 0 ${8 * flash}px ${STATUS[st].dot}44` : "none",
                transform: `scale(${k === 0 ? 1 + flash * 0.04 : 1})`,
              }}>
                <Avatar name={f.name} size={52} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 19, color: C.fg, whiteSpace: "nowrap" }}>{f.name}</div>
                  <StatusBadge status={st} scale={0.9} style={{ marginTop: 6 }} />
                </div>
              </div>
            );
          })}
        </div>
      </Phone>
    </AbsoluteFill>
  );
};
