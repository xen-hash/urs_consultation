import { AbsoluteFill } from "remotion";
import { Bell, Check, Send, Clock, Mic } from "lucide-react";
import { C, FACULTY, FONT } from "../theme";
import { cue, cueEnd } from "../timing";
import { keys, pop, ramp, useScene } from "../anim";
import { AppHeader, Avatar, FacultyCard, Kicker, Navi, Phone, Pointer, StatusBadge, Typed, Window } from "../ui";

const Step = ({ n, title, active, done, children }) => (
  <div style={{ opacity: active || done ? 1 : 0.4, display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontWeight: 800, fontSize: 21, color: C.fg }}>
      <span style={{
        width: 32, height: 32, borderRadius: 99, display: "grid", placeItems: "center", fontSize: 17,
        background: done ? C.success : active ? C.navy : C.borderStrong, color: "white",
      }}>{done ? <Check size={19} strokeWidth={3.5} /> : n}</span>
      {title}
    </div>
    {children}
  </div>
);

const PURPOSE = "Feedback on my thesis, chapter 2";

// "Need a consultation? Pick your professor, choose a time, and tell them what
//  it's about, so they come prepared. The moment your teacher accepts, you'll
//  get a notification."
export const Booking = () => {
  const { frame, at } = useScene();
  const tPick = at(cue("pick your professor"));
  const tTime = at(cue("choose a time"));
  const tTell = at(cue("tell them"));
  const tPrepared = at(cueEnd("come prepared"));
  const tSend = tPrepared + 2;
  const tIncoming = tSend + 8;
  const tAccept = at(cue("accepts"));
  const tNotify = at(cue("notification"));

  const picked = frame >= tPick + 16;
  const timed = frame >= tTime + 12;
  const sent = frame >= tSend + 3;
  const accepted = frame >= tAccept + 3;
  const profs = [FACULTY[0], FACULTY[6], FACULTY[2]];
  const slots = [["9:00 AM", false], ["10:30 AM", true], ["1:00 PM", false], ["2:30 PM", false], ["3:30 PM", true]];

  const winIn = ramp(frame, 0, 18);
  const phoneIn = pop(frame, tIncoming - 30);
  const card = pop(frame, tIncoming);
  const toast = pop(frame, tNotify - 2, { damping: 13 });
  const ring = frame >= tNotify ? Math.sin((frame - tNotify) * 1.4) * 18 * Math.max(0, 1 - (frame - tNotify) / 24) : 0;

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Kicker style={{ position: "absolute", left: 110, top: 40, opacity: winIn }}>Student portal</Kicker>
      <Window path="/student" width={1120} height={810} style={{
        position: "absolute", left: 100, top: 86, opacity: winIn, transform: `translateX(${(1 - winIn) * -60}px)`,
      }}>
        <AppHeader title="Request a consultation" role="Student" scale={0.85} />
        <div style={{ padding: "22px 34px", display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
          <Step n={1} title="Choose a professor" active={!picked} done={picked}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {profs.map((f, k) => {
                const on = picked && k === 0;
                return (
                  <div key={f.name} style={{
                    display: "flex", alignItems: "center", gap: 16, padding: "10px 18px", borderRadius: 16, height: 64,
                    background: on ? C.brand50 : "white", border: `2px solid ${on ? C.navy : C.border}`,
                    opacity: picked && !on ? 0.55 : 1,
                  }}>
                    <Avatar name={f.name} size={42} />
                    <span style={{ fontWeight: 800, fontSize: 20, color: C.fg }}>{f.name}</span>
                    <span style={{ fontWeight: 600, fontSize: 16, color: C.subtle }}>{f.dept}</span>
                    <StatusBadge status={f.status} scale={0.8} style={{ marginLeft: "auto" }} />
                  </div>
                );
              })}
            </div>
          </Step>
          <Step n={2} title="Pick a time" active={picked && !timed} done={timed}>
            <div style={{ display: "flex", gap: 12 }}>
              {slots.map(([s, taken]) => {
                const on = timed && s === "1:00 PM";
                return (
                  <span key={s} style={{
                    display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 12,
                    fontWeight: 800, fontSize: 18, textDecoration: taken ? "line-through" : "none",
                    background: on ? C.navy : taken ? C.canvas : "white", color: on ? "white" : taken ? "#94a3b8" : C.fg,
                    border: `2px solid ${on ? C.navy : C.border}`, transform: `scale(${on ? 1 + 0.08 * (1 - ramp(frame, tTime + 12, 10)) : 1})`,
                  }}><Clock size={17} />{s}</span>
                );
              })}
            </div>
          </Step>
          <Step n={3} title="What's it about?" active={timed && !sent} done={sent}>
            <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
              <span style={{
                padding: "0 20px", borderRadius: 12, background: C.amber50, color: C.amberText, fontWeight: 800,
                fontSize: 18, display: "grid", placeItems: "center", border: "2px solid #fcd9a0",
              }}>Academic</span>
              <div style={{
                flex: 1, height: 60, borderRadius: 12, background: "white", padding: "0 18px",
                border: `2px solid ${frame >= tTell && !sent ? C.brand400 : C.border}`,
                display: "flex", alignItems: "center", fontSize: 20, fontWeight: 600, color: C.fg,
              }}>
                <Typed frame={frame} text={PURPOSE} from={tTell} to={tPrepared - 6} />
              </div>
            </div>
          </Step>
          <div style={{
            alignSelf: "flex-end", display: "inline-flex", alignItems: "center", gap: 12, padding: "16px 30px",
            borderRadius: 14, fontWeight: 800, fontSize: 21, color: "white",
            background: sent ? C.success : C.navy, boxShadow: "0 10px 20px -8px rgba(0,51,102,0.6)",
          }}>
            {sent ? <><Check size={24} strokeWidth={3} />Request sent</> : <><Send size={22} />Send request</>}
          </div>
          <Pointer frame={frame} appear={tPick - 6}
            path={[[tPick - 6, 700, 420], [tPick + 12, 320, 102], [tTime, 330, 110], [tTime + 10, 470, 332],
                   [tTell - 4, 480, 338], [tTell + 4, 620, 440], [tPrepared - 6, 640, 450], [tSend - 1, 960, 540], [tSend + 30, 980, 560]]}
            taps={[tPick + 14, tTime + 10, tTell + 4, tSend]} hide={tSend + 16} />
        </div>
      </Window>

      {/* The teacher's phone receives it */}
      <Kicker style={{ position: "absolute", left: 1380, top: 40, opacity: phoneIn }}>Teacher's phone</Kicker>
      <Phone width={400} style={{
        position: "absolute", left: 1370, top: 86, transform: `translateY(${(1 - phoneIn) * 160}px) scale(0.93)`,
        transformOrigin: "50% 0", opacity: Math.min(1, phoneIn * 1.5),
      }}>
        <div style={{ background: C.navy, color: "white", padding: "14px 20px", fontWeight: 800, fontSize: 19 }}>Requests</div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
          <div style={{
            background: "white", borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 12,
            border: `2px solid ${accepted ? C.success : C.brand300}`,
            boxShadow: accepted ? `0 0 0 6px ${C.success}33` : "0 10px 24px -10px rgba(0,51,102,0.4)",
            transform: `translateX(${(1 - card) * 360}px)`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name="Mika Soriano" size={46} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: C.fg }}>Mika Soriano</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.subtle }}>BS CpE · 3rd year</div>
              </div>
              <span style={{
                marginLeft: "auto", fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 99,
                background: accepted ? C.success50 : C.amber50, color: accepted ? C.success : C.amberText,
              }}>{accepted ? "ACCEPTED" : "NEW"}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.muted, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={16} />Today · 1:00 PM
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.fg, background: C.canvas, padding: "10px 12px", borderRadius: 10 }}>
              <b style={{ color: C.amberText }}>Academic</b> · {PURPOSE}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{
                flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, fontWeight: 800, fontSize: 17,
                border: `2px solid ${C.border}`, color: C.muted, opacity: accepted ? 0.4 : 1,
              }}>Decline</span>
              <span style={{
                flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, fontWeight: 800, fontSize: 17,
                background: C.success, color: "white", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 6,
              }}>{accepted && <Check size={18} strokeWidth={3} />}{accepted ? "Accepted" : "Accept"}</span>
            </div>
          </div>
          {[["Josh Navarro", "Tomorrow · 9:00 AM", "Pending", C.amberText, C.amber50],
            ["Aira Mendoza", "Yesterday · 2:30 PM", "Completed", C.navy, C.brand50]].map(([n, when, st, fg, bg]) => (
            <div key={n} style={{
              background: "white", borderRadius: 16, padding: 14, display: "flex", alignItems: "center", gap: 12,
              border: `2px solid ${C.border}`, opacity: phoneIn,
            }}>
              <Avatar name={n} size={42} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.fg }}>{n}</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.subtle }}>{when}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 99, background: bg, color: fg }}>{st.toUpperCase()}</span>
            </div>
          ))}
          <Pointer frame={frame} kind="touch" appear={tAccept - 14} hide={tAccept + 14}
            path={[[tAccept - 14, 330, 420], [tAccept - 1, 270, 318], [tAccept + 20, 280, 330]]} taps={[tAccept]} />
        </div>
      </Phone>

      {/* The student's notification */}
      <div style={{
        position: "absolute", left: 300, top: 150, width: 720, padding: "22px 26px", borderRadius: 22,
        background: "white", display: "flex", alignItems: "center", gap: 20,
        boxShadow: "0 30px 60px -12px rgba(0,16,40,0.6)", border: `2px solid ${C.success}`,
        opacity: Math.min(1, toast * 1.4), transform: `translateY(${(1 - toast) * -120}px) scale(${0.9 + 0.1 * toast})`,
      }}>
        <div style={{
          width: 66, height: 66, borderRadius: 18, background: C.success, display: "grid", placeItems: "center",
          transform: `rotate(${ring}deg)`, flexShrink: 0,
        }}><Bell size={36} color="white" strokeWidth={2.6} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 26, color: C.fg }}>Request accepted</div>
          <div style={{ fontWeight: 600, fontSize: 19, color: C.muted }}>Engr. Ana Villareal · Today, 1:00 PM</div>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.subtle }}>now</span>
      </div>
    </AbsoluteFill>
  );
};

// A bar-graph waveform that moves while someone speaks.
const Wave = ({ frame, level, color = C.amber, bars = 26, height = 70 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, height }}>
    {Array.from({ length: bars }, (_, i) => {
      const v = (Math.sin(frame * 0.55 + i * 0.9) * 0.5 + 0.5) * (Math.sin(frame * 0.23 + i * 0.37) * 0.5 + 0.5);
      return <span key={i} style={{ width: 7, borderRadius: 4, background: color, height: 8 + v * (height - 8) * level }} />;
    })}
  </div>
);

// "Rather just ask? Say hi to Navi, your voice assistant. 'Is my professor free
//  today?' Navi answers from live data, and takes you straight to the right screen."
export const NaviScene = () => {
  const { frame, at } = useScene();
  const tAsk = at(cue("rather just ask"));
  const tHi = at(cue("say hi"));
  const tNavi = at(cue("navi", 46));
  const tQ = at(cue("is my professor"));
  const tQEnd = at(cueEnd("free today"));
  const tAnswer = at(cue("navi answers"));
  const tTakes = at(cue("takes you"));
  const tScreen = at(cue("right screen"));
  const words = ["Is", "my", "professor", "free", "today?"];
  const wordTimes = [cue("is my professor"), cue("my professor", 49), cue("professor", 49.6), cue("free today"), cue("today", 50)].map(at);

  const listening = frame >= tQ - 6 && frame < tQEnd + 6;
  const thinking = frame >= tQEnd + 6 && frame < tAnswer;
  const pose = listening ? "listening" : thinking ? "thinking" : frame >= tAnswer ? "happy" : "helpful";
  const bust = pop(frame, tNavi - 8, { damping: 12 });
  const hi = pop(frame, tHi - 2);
  const panelIn = ramp(frame, tAsk - 4, 16);
  const qIn = pop(frame, tQ - 4);
  const aIn = pop(frame, tAnswer);
  const swap = ramp(frame, tTakes + 10, 16);
  const answer = "Yes! Engr. Ana Villareal is available until 12:00 NN, at the CE Faculty Room.";
  const shownWords = Math.floor(keys(frame, [[tAnswer, 0], [tTakes - 2, answer.split(" ").length]]));

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      {/* Navi */}
      <div style={{
        position: "absolute", left: 150, top: 230, transform: `translateX(${(1 - bust) * -500}px)`,
        filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.45))",
      }}>
        <Navi pose="bust" size={420} style={{
          maskImage: "linear-gradient(to bottom, black 78%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 78%, transparent 100%)",
        }} />
      </div>
      <div style={{
        position: "absolute", left: 470, top: 150, padding: "18px 28px", borderRadius: "26px 26px 26px 6px",
        background: C.amber, color: C.navy900, fontWeight: 800, fontSize: 38,
        transform: `scale(${hi})`, transformOrigin: "0 100%", opacity: 1 - ramp(frame, tQ - 10, 8),
      }}>Hi, I'm Navi!</div>

      {/* Assistant panel */}
      <div style={{
        position: "absolute", left: 800, top: 60, width: 1000, height: 800, borderRadius: 30, overflow: "hidden",
        background: C.canvas, boxShadow: "0 40px 80px -24px rgba(0,16,40,0.6)", display: "flex", flexDirection: "column",
        opacity: panelIn, transform: `translateY(${(1 - panelIn) * 40}px)`,
      }}>
        <AppHeader title="Navi" role="Voice assistant" right={
          <span style={{ fontSize: 17, fontWeight: 700, opacity: 0.85 }}>
            {listening ? "Listening…" : thinking ? "Checking live data…" : "Ask me anything"}
          </span>
        } />
        <div style={{ flex: 1, position: "relative" }}>
          {/* Conversation */}
          <div style={{
            position: "absolute", inset: 0, padding: 34, display: "flex", flexDirection: "column", gap: 26,
            opacity: 1 - swap, transform: `translateX(${-swap * 200}px)`,
          }}>
            <div style={{
              alignSelf: "flex-end", maxWidth: 640, padding: "22px 28px", borderRadius: "26px 26px 6px 26px",
              background: C.navy, color: "white", fontSize: 34, fontWeight: 800,
              opacity: Math.min(1, qIn * 1.5), transform: `scale(${0.9 + 0.1 * qIn})`, transformOrigin: "100% 100%",
            }}>
              {words.map((w, k) => (
                <span key={k} style={{ opacity: frame >= wordTimes[k] - 2 ? 1 : 0.15 }}>{w} </span>
              ))}
            </div>
            <div style={{
              display: "flex", gap: 20, alignItems: "flex-start",
              opacity: Math.min(1, aIn * 1.5), transform: `translateY(${(1 - aIn) * 30}px)`,
            }}>
              <Navi pose={pose} size={84} style={{ borderRadius: 99, background: C.brand100, flexShrink: 0 }} />
              <div style={{
                maxWidth: 720, padding: "22px 26px", borderRadius: "6px 26px 26px 26px", background: "white",
                border: `2px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 16,
              }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.fg, lineHeight: 1.35, minHeight: 76 }}>
                  {answer.split(" ").slice(0, shownWords).join(" ")}
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, background: C.canvas,
                  opacity: ramp(frame, tAnswer + 20, 10),
                }}>
                  <Avatar name={FACULTY[0].name} size={46} />
                  <span style={{ fontWeight: 800, fontSize: 19, color: C.fg }}>{FACULTY[0].name}</span>
                  <StatusBadge status="Available" scale={0.9} style={{ marginLeft: "auto" }} />
                </div>
              </div>
            </div>
            <div style={{
              alignSelf: "center", display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 20px", borderRadius: 99,
              background: C.brand50, color: C.navy, fontWeight: 800, fontSize: 19, opacity: ramp(frame, tTakes, 8),
            }}>Opening Faculty Availability →</div>
          </div>

          {/* Where Navi takes you */}
          <div style={{
            position: "absolute", inset: 0, padding: 30, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
            alignContent: "start", opacity: swap, transform: `translateX(${(1 - swap) * 300}px)`,
          }}>
            {FACULTY.slice(0, 6).map((f, k) => (
              <FacultyCard key={f.name} f={f} scale={1.15} glow={k === 0 ? ramp(frame, tScreen, 10) : 0}
                dim={k === 0 ? 0 : 0.35 * ramp(frame, tScreen, 10)} />
            ))}
          </div>

          {/* Mic dock */}
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0, height: 150, background: "white",
            borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 36,
            opacity: 1 - swap,
          }}>
            <Wave frame={frame} level={listening ? 1 : 0.12} color={listening ? C.amber : C.borderStrong} />
            <div style={{
              width: 96, height: 96, borderRadius: 99, background: listening ? C.amber : C.navy,
              display: "grid", placeItems: "center", flexShrink: 0,
              boxShadow: `0 0 0 ${listening ? 10 + 8 * Math.abs(Math.sin(frame / 6)) : 0}px rgba(255,160,0,0.28)`,
            }}><Mic size={46} color={listening ? C.navy900 : "white"} strokeWidth={2.6} /></div>
            <Wave frame={frame + 40} level={listening ? 1 : 0.12} color={listening ? C.amber : C.borderStrong} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};


