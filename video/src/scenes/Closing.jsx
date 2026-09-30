import { AbsoluteFill, Img, staticFile } from "remotion";
import {
  Check, Download, WifiOff, Calendar, Camera, Mail, Map, Music, Settings, MessageCircle, Cloud, BookOpen,
  Calculator, Radio, FileSpreadsheet, Lock, ScanFace,
} from "lucide-react";
import { C, FONT } from "../theme";
import { cue, cueEnd } from "../timing";
import { keys, pop, ramp, useScene } from "../anim";
import { Kicker, Logo, Navi, Pill, Pointer, Typed, Window } from "../ui";
import { box, centre, PhoneFrame, phoneScreenWidth, Ring, ScreenView, States } from "../screens";

const CHROME = 56;

const HOME_ICONS = [
  [Calendar, "#ef4444"], [Camera, "#6366f1"], [Mail, "#0ea5e9"], [Map, "#22c55e"],
  [Music, "#ec4899"], [Settings, "#64748b"], [MessageCircle, "#10b981"], [Cloud, "#38bdf8"],
  [BookOpen, "#f97316"], [Calculator, "#475569"], [null, null], [Radio, "#8b5cf6"],
];

// "Sign in fast, with a QR code, a PIN, or your face. Then install it on your
//  phone like any app. It even opens when the campus Wi-Fi drops."
export const Login = () => {
  const { frame, at } = useScene();
  const tQR = at(cue("qr code"));
  const tPIN = at(cue("a pin"));
  const tFace = at(cue("your face"));
  const tThen = at(cue("then install"));
  const tInstall = at(cue("install it"));
  const tPhone = at(cue("phone like"));
  const tOpens = at(cue("opens when"));
  const tWifi = at(cue("wi fi"));
  const tDrops = at(cue("drops"));

  const pw = 360, ps = phoneScreenWidth(pw);
  const out = ramp(frame, tThen - 6, 16);
  const pair = [
    ["m-student-login", "Students", "qr", "id", 290],
    ["m-teacher-login", "Faculty", "qr", "pin", 1270],
  ];
  const face = pop(frame, tFace - 2);

  const bw = 400, bs = phoneScreenWidth(bw);
  const phoneIn = pop(frame, tThen - 2, { damping: 16 });
  const sheet = keys(frame, [[tInstall - 2, 0], [tInstall + 8, 1], [tPhone - 2, 1], [tPhone + 6, 0]]);
  const iconDrop = pop(frame, tPhone + 2, { damping: 9 });
  const open = ramp(frame, tOpens + 2, 12);
  const offline = ramp(frame, tWifi, 8);
  const slot = { x: 28 + 2 * 88, y: 70 + 2 * 116 };

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      {pair.map(([name, label, a, b, left], i) => {
        const inT = pop(frame, 2 + i * 5);
        return (
          <div key={name} style={{
            position: "absolute", left, top: 70, opacity: Math.min(1, inT) * (1 - out),
            transform: `translateY(${(1 - inT) * 80}px) translateX(${out * (i ? 900 : -900)}px)`,
          }}>
            <Kicker style={{ textAlign: "center", marginBottom: 12 }}>{label}</Kicker>
            <PhoneFrame width={pw}>
              <States frame={frame} width={ps} states={[[name, 0]]} overlay={(k) => (
                <>
                  <Ring frame={frame} at={tQR} until={tPIN - 2} b={box(a, name)} k={k} pad={4} />
                  <Ring frame={frame} at={tPIN} until={tThen} b={box(b, name)} k={k} pad={4} />
                </>
              )} />
            </PhoneFrame>
          </div>
        );
      })}
      <Pill style={{
        position: "absolute", left: 960, top: 440, whiteSpace: "nowrap",
        opacity: Math.min(1, face) * (1 - out),
        transform: `translateX(-50%) scale(${0.8 + 0.2 * face})`, fontSize: 30,
      }}><ScanFace size={36} color={C.amber} />Face, at the campus kiosk</Pill>

      {/* Install */}
      <Pill style={{
        position: "absolute", left: 270, top: 330, opacity: ramp(frame, tInstall + 4, 10),
        transform: `translateX(${(1 - ramp(frame, tInstall + 4, 14)) * -40}px)`,
      }}><Download size={34} color={C.amber} />Installs like an app</Pill>
      <Pill style={{
        position: "absolute", left: 1220, top: 560, opacity: ramp(frame, tWifi, 10),
        transform: `translateX(${(1 - ramp(frame, tWifi, 14)) * 40}px)`,
      }}><WifiOff size={34} color={C.amber} />Still opens offline</Pill>

      <div style={{
        position: "absolute", left: 760, top: 30, transform: `translateY(${(1 - phoneIn) * 1200}px)`,
        opacity: frame >= tThen - 2 ? 1 : 0,
      }}>
        <PhoneFrame width={bw} offline={offline}>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(170deg, ${C.brand500}, ${C.navy900})` }}>
            <div style={{ position: "absolute", left: 0, top: 0, display: "grid", gridTemplateColumns: "repeat(4, 72px)", gap: "44px 16px", padding: "70px 28px" }}>
              {HOME_ICONS.map(([Icon, color], k) => (
                <div key={k} style={{ width: 72, height: 72, borderRadius: 18, background: Icon ? color : "transparent", display: "grid", placeItems: "center", opacity: Icon ? 0.9 : 1 }}>
                  {Icon && <Icon size={36} color="white" />}
                </div>
              ))}
            </div>
            <div style={{
              position: "absolute", left: slot.x, top: slot.y - (1 - iconDrop) * 300, width: 72,
              opacity: frame >= tPhone ? 1 : 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}>
              <Img src={staticFile("app-icon.png")} style={{
                width: 72, height: 72, borderRadius: 18,
                boxShadow: `0 0 0 ${4 * ramp(frame, tPhone + 16, 10)}px ${C.amber}, 0 10px 20px rgba(0,0,0,0.4)`,
              }} />
              <span style={{ color: "white", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>URS Consult</span>
            </div>
            <div style={{
              position: "absolute", left: 0, right: 0, bottom: 0, background: "white", borderRadius: "28px 28px 0 0",
              padding: "26px 26px 40px", transform: `translateY(${(1 - sheet) * 110}%)`,
              display: "flex", flexDirection: "column", gap: 18, boxShadow: "0 -20px 40px rgba(0,0,0,0.3)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Img src={staticFile("app-icon.png")} style={{ width: 64, height: 64, borderRadius: 16 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 22, color: C.fg }}>Install URS Consultation?</div>
                  <div style={{ fontWeight: 600, fontSize: 16, color: C.subtle }}>urs-consultation.vercel.app</div>
                </div>
              </div>
              <div style={{
                textAlign: "center", padding: "16px 0", borderRadius: 14, background: C.navy, color: "white", fontWeight: 800, fontSize: 21,
                transform: `scale(${frame > tInstall + 12 && frame < tInstall + 18 ? 0.94 : 1})`,
              }}>Install</div>
            </div>
          </div>
          {/* The real app, opened from its icon */}
          <div style={{
            position: "absolute", inset: 0, clipPath: `circle(${open * 150}% at ${slot.x + 36}px ${slot.y + 36}px)`,
          }}>
            <States frame={frame} width={bs} fade={6} states={[["m-app", 0], ["m-offline", tDrops - 4]]}
              overlay={(k) => <Ring frame={frame} at={tDrops} b={box("bar", "m-offline")} k={k} pad={4} />} />
          </div>
          <Pointer frame={frame} kind="touch" appear={tInstall + 2} hide={tInstall + 22}
            path={[[tInstall + 2, 300, 600], [tInstall + 12, 215, 800], [tInstall + 30, 230, 760]]} taps={[tInstall + 12]} />
          <Pointer frame={frame} kind="touch" appear={tOpens - 12} hide={tOpens + 12}
            path={[[tOpens - 12, slot.x + 120, slot.y + 200], [tOpens, slot.x + 36, slot.y + 36], [tOpens + 20, slot.x + 50, slot.y + 60]]} taps={[tOpens]} />
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

// "On campus, a kiosk display shows who's in, right now. And for the Dean's
//  Office, a live dashboard tracks every request, ready to export to Excel in one click."
export const Campus = () => {
  const { frame, at } = useScene();
  const tKiosk = at(cue("kiosk"));
  const tDean = at(cue("and for the dean's"));
  const tTracks = at(cue("tracks every request"));
  const tReady = at(cue("ready to export"));
  const tClick = at(cue("one click"));

  const monIn = pop(frame, tKiosk - 14, { damping: 16 });
  const monOut = ramp(frame, tDean - 10, 16);
  const deanIn = ramp(frame, tDean - 4, 18);
  const file = pop(frame, tClick + 8, { damping: 12 });
  const W = 1400, k = W / 1440, VIEW = 790;
  const today = box("today", "dean");
  const [tx, ty] = centre(today, k);
  const dl = "URS_Consultation_today_2026-10-01.xlsx";

  return (
    <AbsoluteFill style={{ fontFamily: FONT, perspective: 2000 }}>
      <div style={{
        position: "absolute", left: 240, top: 30, opacity: 1 - monOut,
        transform: `translateX(${-monOut * 500}px) scale(${(0.86 + 0.14 * monIn) * (1 - monOut * 0.2)}) rotateY(${(1 - monIn) * -12}deg)`,
      }}>
        <Kicker style={{ textAlign: "center", marginBottom: 14 }}>Kiosk display · on campus</Kicker>
        <div style={{ width: 1440, height: 810, borderRadius: 28, background: "#070d18", padding: 20, boxShadow: "0 50px 90px -30px rgba(0,0,0,0.8)" }}>
          <div style={{ position: "relative", width: 1400, height: 770, borderRadius: 12, overflow: "hidden" }}>
            <ScreenView name="kiosk" width={1400} height={880} />
          </div>
        </div>
        <div style={{ width: 200, height: 60, margin: "0 auto", background: "linear-gradient(#1f2b40, #0b1220)" }} />
      </div>

      <Window path="/dean/dashboard" width={W} height={CHROME + VIEW * k} style={{
        position: "absolute", left: 260, top: 36, opacity: deanIn, transform: `translateX(${(1 - deanIn) * 400}px)`,
      }}>
        <States frame={frame} width={W} height={VIEW} fade={10}
          states={[["dean", 0], ["dean-charts", tTracks + 6], ["dean-exported", tClick + 4]]}
          overlay={(kk, name) => (
            <>
              {name === "dean" && <Ring frame={frame} at={tDean + 14} until={tTracks + 6} b={box("stats", "dean")} k={kk} pad={6} />}
              {name === "dean-charts" && <Ring frame={frame} at={tTracks + 16} until={tReady + 10} b={box("chart", "dean-charts")} k={kk} pad={6} />}
              <Ring frame={frame} at={tReady + 8} until={tClick + 40} b={[today[0] - 26, today[1] - 8, 200, today[3] + 16]} k={kk} pad={2} radius={12} />
              <Pointer frame={frame} appear={tReady} hide={tClick + 30}
                path={[[tReady, 600, 500], [tClick - 2, tx + 10, ty + 2], [tClick + 30, tx + 20, ty + 12]]} taps={[tClick]} />
            </>
          )} />
      </Window>
      {/* The downloaded workbook, with the name the app gave it */}
      <div style={{
        position: "absolute", left: 1150, top: 36 + CHROME + 690 * k + (1 - file) * 40, display: "flex", alignItems: "center", gap: 14,
        padding: "16px 22px", borderRadius: 16, background: "white", border: "2px solid #107c41",
        boxShadow: "0 24px 40px -12px rgba(0,16,40,0.45)", opacity: Math.min(1, file * 1.5),
      }}>
        <div style={{ width: 50, height: 50, borderRadius: 12, background: "#107c41", display: "grid", placeItems: "center" }}>
          <FileSpreadsheet size={28} color="white" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 19, color: C.fg }}>{dl}</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.success, display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={16} strokeWidth={3} />Downloaded · opens in Excel
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const EndCard = ({ len }) => {
  const { frame, at } = useScene();
  const title = [
    ["URS", at(cue("u r s", 70)), C.amber],
    ["Faculty", at(cue("faculty", 75)), "white"],
    ["Consultation", at(cue("consultation", 75)), "white"],
    ["System", at(cue("system", 75)), "white"],
  ];
  const tWait = at(cue("no more waiting"));
  const tGuess = at(cue("no more guessing", 78));
  const tVisit = at(cue("visit"));
  const tUrl = at(cue("urs consultation dot"));
  const tUrlEnd = at(cueEnd("dot app"));
  const logo = pop(frame, 0, { damping: 12 });
  const navi = pop(frame, tWait - 4, { damping: 13 });
  const url = pop(frame, tVisit - 2);
  const fadeOut = keys(frame, [[len - 24, 0], [len, 1]]);
  const bob = Math.sin(frame / 14) * 8;

  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: "white" }}>
      <div style={{
        position: "absolute", left: 120, top: 0, bottom: 0, width: 1300,
        display: "flex", flexDirection: "column", justifyContent: "center", gap: 34,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
          <Logo size={190} style={{ transform: `scale(${logo})`, filter: "drop-shadow(0 0 30px rgba(255,160,0,0.4))" }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0 26px", width: 900, fontSize: 96, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.05 }}>
            {title.map(([w, t, col]) => (
              <div key={w} style={{ overflow: "hidden", paddingBottom: 8 }}>
                <div style={{ color: col, transform: `translateY(${(1 - ramp(frame, t - 3, 12)) * 130}%)` }}>{w}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 22 }}>
          {[["No more waiting.", tWait, "white"], ["No more guessing.", tGuess, C.amber]].map(([text, t, col]) => {
            const p = pop(frame, t - 2);
            return (
              <Pill key={text} style={{
                color: col, fontSize: 42, padding: "18px 34px", opacity: Math.min(1, p * 1.5),
                transform: `translateY(${(1 - p) * 30}px)`,
              }}><Check size={36} strokeWidth={3.2} color={col} />{text}</Pill>
            );
          })}
        </div>
        <div style={{
          alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 18, padding: "24px 38px", borderRadius: 24,
          background: "white", color: C.navy, fontSize: 54, fontWeight: 800, letterSpacing: "-0.02em",
          boxShadow: `0 0 0 ${8 * ramp(frame, tUrlEnd, 12)}px rgba(255,160,0,0.4), 0 30px 60px -20px rgba(0,0,0,0.6)`,
          opacity: Math.min(1, url * 1.4), transform: `scale(${0.9 + 0.1 * url})`, transformOrigin: "0 50%",
          minWidth: 900,
        }}>
          <Lock size={42} color={C.success} strokeWidth={2.8} />
          <Typed frame={frame} text="urs-consultation.vercel.app" from={tUrl} to={tUrlEnd - 4} />
        </div>
      </div>
      <Navi pose="hero" size={330} style={{
        position: "absolute", right: 170, top: 40, height: 1000, width: "auto",
        transform: `translateX(${(1 - navi) * 600}px) translateY(${bob}px)`,
        filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.5))",
      }} />
      <AbsoluteFill style={{ background: C.navy900, opacity: fadeOut }} />
    </AbsoluteFill>
  );
};

