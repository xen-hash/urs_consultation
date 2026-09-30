import { AbsoluteFill } from "remotion";
import {
  Check, ScanFace, QrCode, KeyRound, Download, WifiOff, Calendar, Camera, Mail, Map, Music, Settings,
  MessageCircle, Cloud, BookOpen, Calculator, LayoutDashboard, ClipboardList, Users, GraduationCap,
  Activity, FileSpreadsheet, Lock, Monitor, Radio,
} from "lucide-react";
import { C, FACULTY, FONT } from "../theme";
import { cue, cueEnd } from "../timing";
import { keys, pop, ramp, useScene } from "../anim";
import { AppHeader, Avatar, FacultyCard, Kicker, Logo, Navi, Phone, Pill, Pointer, StatusBadge, Typed, Window } from "../ui";

// A deterministic QR-looking grid with the three finder squares.
const QR = ({ size, reveal }) => {
  const n = 21;
  const cells = [];
  const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let on;
    if (finder(x, y)) {
      const fx = x >= n - 7 ? x - (n - 7) : x, fy = y >= n - 7 ? y - (n - 7) : y;
      on = fx === 0 || fy === 0 || fx === 6 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
    } else on = ((x * 7 + y * 13 + x * y * 3) % 5) < 2;
    if (on && (x + y) / (2 * n) <= reveal) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} />);
  }
  return <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} fill={C.navy}>{cells}</svg>;
};

const Tile = ({ frame, enter, t, icon: Icon, label, children }) => {
  const inT = pop(frame, enter);
  const ok = pop(frame, t + 18, { damping: 11 });
  return (
    <div style={{
      width: 440, height: 480, borderRadius: 34, background: "white", position: "relative",
      boxShadow: "0 40px 70px -24px rgba(0,16,40,0.6)", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 26,
      opacity: Math.min(1, inT * 1.4), transform: `translateY(${(1 - inT) * 90}px) scale(${0.85 + 0.15 * inT})`,
    }}>
      <div style={{ width: 250, height: 250, display: "grid", placeItems: "center", position: "relative" }}>{children}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 38, fontWeight: 800, color: C.fg }}>
        <Icon size={38} color={C.navy} strokeWidth={2.6} />{label}
      </div>
      <div style={{
        position: "absolute", top: -20, right: -20, width: 72, height: 72, borderRadius: 99, background: C.success,
        display: "grid", placeItems: "center", transform: `scale(${ok})`, boxShadow: "0 8px 20px rgba(21,128,61,0.5)",
      }}><Check size={42} color="white" strokeWidth={3.5} /></div>
    </div>
  );
};

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

  const tilesOut = ramp(frame, tThen - 6, 16);
  const phoneIn = pop(frame, tThen - 2, { damping: 16 });
  const sheet = keys(frame, [[tInstall - 2, 0], [tInstall + 8, 1], [tPhone - 2, 1], [tPhone + 6, 0]]);
  const iconDrop = pop(frame, tPhone + 2, { damping: 9 });
  const open = ramp(frame, tOpens + 2, 12);
  const offline = ramp(frame, tWifi, 8);
  const bar = pop(frame, tDrops - 4);

  const pinDots = Math.floor(keys(frame, [[tPIN, 0], [tPIN + 16, 4]], (t) => t));
  const scan = ((frame - tFace) % 30) / 30;

  // Icon slot 10 (row 3, col 3) is where the app lands.
  const slot = { x: 30 + 2 * 92, y: 70 + 2 * 116 };
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", opacity: 1 - tilesOut }}>
        <Kicker>Sign in your way</Kicker>
      </div>
      <div style={{
        position: "absolute", left: 0, right: 0, top: 170, display: "flex", justifyContent: "center", gap: 70,
        transform: `translateX(${-tilesOut * 2100}px)`, opacity: 1 - tilesOut,
      }}>
        <Tile frame={frame} enter={4} t={tQR} icon={QrCode} label="QR code">
          <QR size={220} reveal={ramp(frame, tQR - 4, 14)} />
          <div style={{
            position: "absolute", left: 0, right: 0, height: 6, borderRadius: 3, background: C.amber,
            boxShadow: `0 0 20px ${C.amber}`, top: 10 + 230 * (((frame - tQR) % 24) / 24),
            opacity: frame > tQR && frame < tQR + 20 ? 1 : 0,
          }} />
        </Tile>
        <Tile frame={frame} enter={8} t={tPIN} icon={KeyRound} label="PIN">
          <div style={{ display: "flex", gap: 22 }}>
            {[0, 1, 2, 3].map((k) => (
              <span key={k} style={{
                width: 42, height: 42, borderRadius: 99, border: `4px solid ${C.navy}`,
                background: k < pinDots ? C.navy : "transparent", transform: `scale(${k === pinDots - 1 ? 1.15 : 1})`,
              }} />
            ))}
          </div>
          <div style={{ position: "absolute", bottom: 0, display: "grid", gridTemplateColumns: "repeat(3, 44px)", gap: 8, opacity: 0.35 }}>
            {Array.from({ length: 6 }, (_, k) => <span key={k} style={{ height: 30, borderRadius: 8, background: C.brand200 }} />)}
          </div>
        </Tile>
        <Tile frame={frame} enter={12} t={tFace} icon={ScanFace} label="Face">
          <div style={{ position: "relative", width: 220, height: 220 }}>
            {[[0, 0, 0], [1, 0, 90], [1, 1, 180], [0, 1, 270]].map(([x, y, r]) => (
              <span key={r} style={{
                position: "absolute", left: x ? 170 : 0, top: y ? 170 : 0, width: 50, height: 50,
                borderTop: `7px solid ${frame > tFace + 16 ? C.success : C.navy}`,
                borderLeft: `7px solid ${frame > tFace + 16 ? C.success : C.navy}`,
                borderRadius: "14px 0 0 0", transform: `rotate(${r}deg)`, transformOrigin: "25px 25px",
              }} />
            ))}
            <ScanFace size={130} color={C.brand400} strokeWidth={1.6} style={{ position: "absolute", left: 45, top: 45 }} />
            <div style={{
              position: "absolute", left: 16, right: 16, height: 5, borderRadius: 3, background: C.amber,
              boxShadow: `0 0 18px ${C.amber}`, top: 20 + 180 * scan, opacity: frame > tFace - 4 && frame < tFace + 16 ? 1 : 0,
            }} />
          </div>
        </Tile>
      </div>

      {/* Install */}
      <Pill style={{
        position: "absolute", left: 250, top: 330, opacity: ramp(frame, tInstall + 4, 10),
        transform: `translateX(${(1 - ramp(frame, tInstall + 4, 14)) * -40}px)`,
      }}><Download size={34} color={C.amber} />Installs like an app</Pill>
      <Pill style={{
        position: "absolute", left: 1170, top: 520, opacity: ramp(frame, tWifi, 10),
        transform: `translateX(${(1 - ramp(frame, tWifi, 14)) * 40}px)`,
      }}><WifiOff size={34} color={C.amber} />Still opens offline</Pill>

      <div style={{
        position: "absolute", left: 745, top: 50, transform: `translateY(${(1 - phoneIn) * 1200}px)`,
        opacity: frame >= tThen - 2 ? 1 : 0,
      }}>
        <Phone width={430} time="10:24" offline={offline}>
          {/* Home screen */}
          <div style={{
            position: "absolute", inset: 0, background: `linear-gradient(170deg, ${C.brand500}, ${C.navy900})`,
          }}>
            <div style={{ position: "absolute", left: 0, top: 0, display: "grid", gridTemplateColumns: "repeat(4, 72px)", gap: "44px 20px", padding: "70px 30px" }}>
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
              <div style={{
                width: 72, height: 72, borderRadius: 18, background: "white", display: "grid", placeItems: "center",
                boxShadow: `0 0 0 ${4 * ramp(frame, tPhone + 16, 10)}px ${C.amber}, 0 10px 20px rgba(0,0,0,0.4)`,
              }}><Logo size={56} /></div>
              <span style={{ color: "white", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>URS Consult</span>
            </div>
            {/* Install sheet */}
            <div style={{
              position: "absolute", left: 0, right: 0, bottom: 0, background: "white", borderRadius: "28px 28px 0 0",
              padding: "26px 26px 40px", transform: `translateY(${(1 - sheet) * 110}%)`,
              display: "flex", flexDirection: "column", gap: 18, boxShadow: "0 -20px 40px rgba(0,0,0,0.3)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: C.brand50, display: "grid", placeItems: "center" }}><Logo size={50} /></div>
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
          {/* The app opened from its icon */}
          <div style={{
            position: "absolute", inset: 0, background: C.canvas, display: "flex", flexDirection: "column",
            clipPath: `circle(${open * 150}% at ${slot.x + 36}px ${slot.y + 36}px)`,
          }}>
            <div style={{ background: C.navy, color: "white", padding: "16px 22px", display: "flex", alignItems: "center", gap: 12, fontWeight: 800, fontSize: 20 }}>
              <Logo size={34} />URS Consultation
            </div>
            <div style={{
              background: C.amber, color: C.navy900, fontWeight: 800, fontSize: 17, padding: "12px 22px",
              display: "flex", alignItems: "center", gap: 10, marginTop: -60 * (1 - bar), opacity: bar,
            }}><WifiOff size={20} strokeWidth={2.8} />You're offline</div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {FACULTY.slice(0, 4).map((f) => (
                <div key={f.name} style={{ background: "white", borderRadius: 16, padding: 14, display: "flex", alignItems: "center", gap: 12, border: `2px solid ${C.border}` }}>
                  <Avatar name={f.name} size={44} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: C.fg, whiteSpace: "nowrap" }}>{f.name}</div>
                    <StatusBadge status={f.status} scale={0.75} style={{ marginTop: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Pointer frame={frame} kind="touch" appear={tInstall + 2} hide={tInstall + 22}
            path={[[tInstall + 2, 300, 600], [tInstall + 12, 215, 790], [tInstall + 30, 230, 760]]} taps={[tInstall + 12]} />
          <Pointer frame={frame} kind="touch" appear={tOpens - 12} hide={tOpens + 12}
            path={[[tOpens - 12, slot.x + 120, slot.y + 200], [tOpens, slot.x + 36, slot.y + 110], [tOpens + 20, slot.x + 50, slot.y + 130]]} taps={[tOpens]} />
        </Phone>
      </div>
    </AbsoluteFill>
  );
};

const WEEK = [["Mon", 0.62], ["Tue", 0.78], ["Wed", 0.55], ["Thu", 0.9], ["Fri", 0.72]];
const FEED = [
  ["Mika Soriano", "Engr. Ana Villareal", "Accepted", C.success],
  ["Josh Navarro", "Prof. Rina Torres", "Pending", C.amberText],
  ["Aira Mendoza", "Engr. Liza Manalo", "Completed", C.navy],
  ["Leo Castillo", "Prof. Bea Salcedo", "Accepted", C.success],
];

// "On campus, a kiosk display shows who's in, right now. And for the Dean's
//  Office, a live dashboard tracks every request, ready to export to Excel in one click."
export const Campus = () => {
  const { frame, at } = useScene();
  const tKiosk = at(cue("kiosk"));
  const tNow = at(cue("right now"));
  const tDean = at(cue("and for the dean's"));
  const tDash = at(cue("live dashboard"));
  const tTracks = at(cue("tracks every request"));
  const tReady = at(cue("ready to export"));
  const tClick = at(cue("one click"));

  const monIn = pop(frame, tKiosk - 12, { damping: 16 });
  const monOut = ramp(frame, tDean - 10, 16);
  const deanIn = ramp(frame, tDean - 4, 18);
  const count = (to) => Math.round(to * keys(frame, [[tTracks - 4, 0], [tTracks + 36, 1]]));
  const file = pop(frame, tClick + 6, { damping: 12 });

  return (
    <AbsoluteFill style={{ fontFamily: FONT, perspective: 2000 }}>
      {/* Kiosk monitor */}
      <div style={{
        position: "absolute", left: 250, top: 40, opacity: 1 - monOut,
        transform: `translateX(${-monOut * 500}px) scale(${(0.85 + 0.15 * monIn) * (1 - monOut * 0.2)}) rotateY(${(1 - monIn) * -12}deg)`,
      }}>
        <Kicker style={{ textAlign: "center", marginBottom: 16 }}>Kiosk display · on campus</Kicker>
        <div style={{ width: 1420, height: 740, borderRadius: 28, background: "#070d18", padding: 18, boxShadow: "0 50px 90px -30px rgba(0,0,0,0.8)" }}>
          <div style={{ width: "100%", height: "100%", borderRadius: 14, overflow: "hidden", background: C.navy900, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "20px 30px", background: C.navy, color: "white" }}>
              <Logo size={54} />
              <div style={{ fontSize: 30, fontWeight: 800 }}>Who's in right now</div>
              <div style={{ marginLeft: "auto", fontSize: 40, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>10:31 AM</div>
            </div>
            <div style={{ padding: "24px 34px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
              {FACULTY.slice(0, 9).map((f, k) => {
                const flip = k === 3 && frame >= tNow;
                return (
                  <FacultyCard key={f.name} f={f} status={flip ? "Available" : f.status} scale={1.08}
                    flash={flip ? keys(frame, [[tNow, 1], [tNow + 20, 0]]) : 0}
                    style={{ opacity: ramp(frame, tKiosk + k * 2, 10) }} />
                );
              })}
            </div>
            <div style={{ marginTop: "auto", padding: "14px 30px", background: "rgba(255,160,0,0.12)", color: C.amber, fontWeight: 700, fontSize: 21, display: "flex", gap: 14, alignItems: "center" }}>
              <Monitor size={24} />Scan your ID at the kiosk to request a consultation
            </div>
          </div>
        </div>
        <div style={{ width: 200, height: 70, margin: "0 auto", background: "linear-gradient(#1f2b40, #0b1220)" }} />
      </div>

      {/* Dean's dashboard */}
      <Window path="/dean" width={1640} height={820} style={{
        position: "absolute", left: 140, top: 44, opacity: deanIn, transform: `translateX(${(1 - deanIn) * 400}px)`,
      }}>
        <div style={{ display: "flex", height: "100%" }}>
          <div style={{ width: 250, background: C.navy, color: "white", padding: "24px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontWeight: 800, fontSize: 20, marginBottom: 20 }}><Logo size={42} />Dean's Office</div>
            {[[LayoutDashboard, "Dashboard"], [ClipboardList, "Requests"], [Users, "Faculty"], [GraduationCap, "Students"], [Activity, "Activity"]].map(([I, l], k) => (
              <div key={l} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, fontWeight: 700, fontSize: 18,
                background: k === 0 ? "rgba(255,160,0,0.18)" : "transparent", color: k === 0 ? C.amber : "rgba(255,255,255,0.8)",
              }}><I size={21} />{l}</div>
            ))}
          </div>
          <div style={{ flex: 1, padding: "26px 32px", display: "flex", flexDirection: "column", gap: 22, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 30, fontWeight: 800, color: C.fg }}>Today at a glance</div>
                <div style={{ fontSize: 17, fontWeight: 600, color: C.subtle }}>Live · updates as requests come in</div>
              </div>
              <div style={{
                marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 12, padding: "14px 24px", borderRadius: 14,
                background: "#107c41", color: "white", fontWeight: 800, fontSize: 20,
                boxShadow: frame >= tReady ? `0 0 0 ${6 * ramp(frame, tReady, 10)}px rgba(16,124,65,0.25)` : "none",
                transform: `scale(${frame >= tClick && frame < tClick + 6 ? 0.94 : 1})`,
              }}><FileSpreadsheet size={24} />Export to Excel</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
              {[["Requests today", count(128), C.navy], ["Accepted", count(94), C.success], ["Pending", count(21), C.amberText], ["Faculty in", `${Math.round(count(32))}/40`, C.brand500]].map(([l, v, col], k) => (
                <div key={l} style={{
                  background: "white", borderRadius: 18, padding: "20px 22px", border: `2px solid ${C.border}`,
                  opacity: ramp(frame, tDash - 6 + k * 3, 10),
                }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.subtle }}>{l}</div>
                  <div style={{ fontSize: 52, fontWeight: 800, color: col, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 18, flex: 1 }}>
              <div style={{ background: "white", borderRadius: 18, padding: 22, border: `2px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: C.fg }}>Requests this week</div>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 26, padding: "18px 10px 0" }}>
                  {WEEK.map(([d, v], k) => (
                    <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
                      <div style={{
                        width: "100%", borderRadius: "10px 10px 4px 4px", background: k === 3 ? C.amber : C.brand400,
                        height: `${v * 100 * ramp(frame, tDash + k * 3, 18)}%`,
                      }} />
                      <span style={{ fontSize: 16, fontWeight: 700, color: C.subtle }}>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: "white", borderRadius: 18, padding: 22, border: `2px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: C.fg }}>Live activity</div>
                {FEED.map(([s, p, st, col], k) => {
                  const inT = pop(frame, tTracks - 10 + k * 8);
                  return (
                    <div key={s} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}`,
                      opacity: Math.min(1, inT * 1.4), transform: `translateX(${(1 - inT) * 60}px)`,
                    }}>
                      <Avatar name={s} size={38} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: C.fg, whiteSpace: "nowrap" }}>{s}</div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: C.subtle, whiteSpace: "nowrap" }}>with {p}</div>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 14, color: col }}>{st}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <Pointer frame={frame} appear={tReady - 6}
              path={[[tReady - 6, 700, 500], [tClick - 2, 1250, 40], [tClick + 30, 1262, 52]]} taps={[tClick]} hide={tClick + 14} />
            {/* The exported workbook */}
            <div style={{
              position: "absolute", right: 34, top: 100 + (1 - file) * -40, display: "flex", alignItems: "center", gap: 14,
              padding: "16px 22px", borderRadius: 16, background: "white", border: "2px solid #107c41",
              boxShadow: "0 24px 40px -12px rgba(0,16,40,0.45)", opacity: Math.min(1, file * 1.5), zIndex: 60,
            }}>
              <div style={{ width: 50, height: 50, borderRadius: 12, background: "#107c41", display: "grid", placeItems: "center" }}>
                <FileSpreadsheet size={28} color="white" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: C.fg }}>URS_Consultation_Summary.xlsx</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.success, display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={16} strokeWidth={3} />Downloaded
                </div>
              </div>
            </div>
          </div>
        </div>
      </Window>
    </AbsoluteFill>
  );
};

// "URS Faculty Consultation System. No more waiting. No more guessing.
//  Visit urs-consultation.vercel.app" — then held over the music.
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

