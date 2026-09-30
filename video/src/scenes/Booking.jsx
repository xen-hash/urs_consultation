import { AbsoluteFill } from "remotion";
import { FileText, Mic } from "lucide-react";
import { C, FONT } from "../theme";
import { cue, cueEnd } from "../timing";
import { keys, pop, ramp, useScene } from "../anim";
import { Kicker, Navi, Pointer, Window } from "../ui";
import { box, centre, PhoneFrame, phoneScreenWidth, Ring, States } from "../screens";

const CHROME = 56;

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
  const tArrive = tSend + 14;
  const tAccept = at(cue("accepts"));
  const tNotify = at(cue("notification"));

  const pw = 390, ps = phoneScreenWidth(pw), pk = ps / 390;
  const ana = box("ana", "m-pick"), slots = box("slots", "m-pick");
  const thesis = box("thesis", "m-modal"), purpose = box("purpose", "m-modal"), submit = box("submit", "m-modal");
  // The professor card, then down to today's consultation hours.
  const pan = keys(frame, [[tTime - 8, 0], [tTime + 10, 230], [tTell - 16, 230]]);
  const tCard = tTell - 12;
  const tModal = tCard + 5;
  const typing = [0, 1, 2, 3, 4].map((i) => tTell + 8 + Math.round(((tPrepared - 6 - tTell - 8) * i) / 4));
  const phoneStates = [
    ["m-pick", 0], ["m-modal", tModal], ["m-type-0", tTell + 6],
    ...typing.slice(1).map((t, i) => [`m-type-${i + 1}`, t]),
    ["m-sent", tSend + 6], ["m-accepted-live", tAccept + 8], ["m-notifications", tNotify - 2],
  ];

  const W = 1100, k = W / 1440;
  const req = box("card", "t-request"), acc = box("accept", "t-request");
  const [ax, ay] = centre(acc, k);
  const phoneIn = ramp(frame, 0, 16);
  const winIn = pop(frame, 12);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Kicker style={{ position: "absolute", left: 150, top: 16, opacity: phoneIn }}>Student's phone</Kicker>
      <PhoneFrame width={pw} style={{
        position: "absolute", left: 140, top: 54, opacity: phoneIn, transform: `translateY(${(1 - phoneIn) * 60}px)`,
      }}>
        <States frame={frame} width={ps} height={844} fade={0} states={phoneStates}
          scrollY={(name) => (name === "m-pick" ? pan : 0)}
          overlay={(kk, name) => name === "m-pick" ? (
            <>
              <Ring frame={frame} at={tPick} until={tTime - 4} b={ana} k={kk} color={C.success} pad={4} />
              <Ring frame={frame} at={tTime + 10} until={tCard} b={[slots[0], slots[1] - 6, slots[2], slots[3] + 24]} k={kk} pad={6} radius={10} />
            </>
          ) : name.startsWith("m-type") || name === "m-modal" ? (
            <>
              <Ring frame={frame} at={tTell + 12} until={tPrepared - 4} b={purpose} k={kk} pad={4} radius={14} />
            </>
          ) : null} />
        {/* Taps, in phone-screen coordinates (below the status bar) */}
        <div style={{ position: "absolute", left: pw * 0.035, top: pw * 0.035 + ps * 0.1, width: ps, height: ps * 844 / 390 }}>
          <Pointer frame={frame} kind="touch" appear={tPick} hide={tSend + 14}
            path={[[tPick, 300 * pk, 700 * pk], [tPick + 12, 195 * pk, 600 * pk], [tTime + 10, 200 * pk, 560 * pk],
                   [tCard - 1, 200 * pk, (650 - 230) * pk], [tModal + 2, 200 * pk, 470 * pk],
                   [tTell + 4, ...centre(thesis, pk)], [tTell + 16, 300 * pk, 520 * pk],
                   [tSend - 1, ...centre(submit, pk)], [tSend + 20, 310 * pk, 830 * pk]]}
            taps={[tCard, tTell + 4, tSend]} />
          <Pointer frame={frame} kind="touch" appear={tNotify - 16} hide={tNotify + 8}
            path={[[tNotify - 16, 250 * pk, 160 * pk], [tNotify - 3, 212 * pk, 32 * pk], [tNotify + 8, 220 * pk, 60 * pk]]}
            taps={[tNotify - 3]} />
        </div>
      </PhoneFrame>

      <Kicker style={{ position: "absolute", left: 700, top: 150, opacity: winIn }}>Teacher's dashboard</Kicker>
      <Window path="/teacher/dashboard" width={W} height={CHROME + 900 * k} style={{
        position: "absolute", left: 690, top: 196, opacity: Math.min(1, winIn * 1.4),
        transform: `translateX(${(1 - winIn) * 200}px)`,
      }}>
        <div style={{
          position: "absolute", inset: 0, transformOrigin: `${centre(req, k)[0]}px ${centre(req, k)[1]}px`,
          transform: `scale(${keys(frame, [[tArrive, 1], [tArrive + 24, 1.45]])})`,
        }}>
        <States frame={frame} width={W} fade={8}
          states={[["t-empty", 0], ["t-request", tArrive], ["t-accepted", tAccept + 3]]}
          overlay={(kk) => (
            <>
              <Ring frame={frame} at={tArrive + 4} until={tAccept + 20} b={req} k={kk} pad={6} />
              <Pointer frame={frame} appear={tAccept - 16} hide={tAccept + 24}
                path={[[tAccept - 16, ax + 200, ay + 180], [tAccept - 1, ax + 6, ay + 4], [tAccept + 20, ax + 16, ay + 14]]}
                taps={[tAccept]} />
            </>
          )} />
        </div>
      </Window>
    </AbsoluteFill>
  );
};

// A bar-graph waveform that moves while someone speaks.
const Wave = ({ frame, level, bars = 22, height = 60, color = C.amber }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 5, height }}>
    {Array.from({ length: bars }, (_, i) => {
      const v = (Math.sin(frame * 0.55 + i * 0.9) * 0.5 + 0.5) * (Math.sin(frame * 0.23 + i * 0.37) * 0.5 + 0.5);
      return <span key={i} style={{ width: 6, borderRadius: 3, background: color, height: 6 + v * (height - 6) * level }} />;
    })}
  </div>
);

// How wide the typed question runs in the captured input box, in CSS px.
const QUESTION_W = 150;

// "Rather just ask? Say hi to Navi, your voice assistant. 'Is my professor free
//  today?' Navi answers from live data, and takes you straight to the right screen."
export const NaviScene = () => {
  const { frame, at } = useScene();
  const tHi = at(cue("say hi"));
  const tNavi = at(cue("navi", 46));
  const tQ = at(cue("is my professor"));
  const tQEnd = at(cueEnd("free today"));
  const tAnswer = at(cue("navi answers"));
  const tTakes = at(cue("takes you"));
  const tScreen = at(cue("right screen"));

  const pw = 400, ps = phoneScreenWidth(pw), pk = ps / 390;
  const input = box("input", "m-navi-typed"), mic = box("mic", "m-navi"), link = box("link", "m-navi-answer");
  const listening = frame >= tQ - 4 && frame < tQEnd + 6;
  // The question fills the box as it is said.
  const said = keys(frame, [[tQ, 0.05], [tQEnd, 1]]);
  const bust = pop(frame, tNavi - 10, { damping: 12 });
  const hi = pop(frame, tHi);
  const phoneIn = ramp(frame, 0, 16);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div style={{
        position: "absolute", left: 170, top: 250, transform: `translateX(${(1 - bust) * -500}px)`,
        filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.45))",
      }}>
        <Navi pose="bust" size={420} style={{
          maskImage: "linear-gradient(to bottom, black 78%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 78%, transparent 100%)",
        }} />
      </div>
      <div style={{
        position: "absolute", left: 470, top: 170, padding: "18px 28px", borderRadius: "26px 26px 26px 6px",
        background: C.amber, color: C.navy900, fontWeight: 800, fontSize: 38,
        transform: `scale(${hi})`, transformOrigin: "0 100%", opacity: 1 - ramp(frame, tQ - 10, 8),
      }}>Hi, I'm Navi!</div>

      <PhoneFrame width={pw} style={{
        position: "absolute", left: 900, top: 40, opacity: phoneIn, transform: `translateY(${(1 - phoneIn) * 60}px)`,
      }}>
        <States frame={frame} width={ps} fade={5}
          states={[["m-app", 0], ["m-navi", tHi + 8], ["m-navi-typed", tQ - 2], ["m-navi-answer", tAnswer], ["m-navi-board", tTakes + 12]]}
          overlay={(k, name) => (
            <>
              {name === "m-navi-typed" && (
                // Cover the part of the question not yet spoken.
                <div style={{
                  position: "absolute", left: (input[0] + 10 + QUESTION_W * said) * k, top: (input[1] + 6) * k,
                  width: (input[2] - 16 - QUESTION_W * said) * k, height: (input[3] - 12) * k, background: "white",
                }} />
              )}
              {name === "m-navi-typed" && listening && (
                <div style={{
                  position: "absolute", left: 20 * k, top: (input[1] - 78) * k, width: 350 * k, height: 64 * k,
                  borderRadius: 16 * k, background: C.navy, display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 12 * k, boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                }}>
                  <Mic size={22 * k} color={C.amber} />
                  <Wave frame={frame} level={1} bars={18} height={40 * k} />
                  <span style={{ color: "white", fontWeight: 700, fontSize: 14 * k }}>Listening…</span>
                </div>
              )}
              <Ring frame={frame} at={tQ - 2} until={tQEnd + 4} b={mic} k={k} pad={3} radius={99} />
              <Ring frame={frame} at={tAnswer + 4} until={tTakes + 10} b={[link[0] - 12, link[1] - 44, link[2] + 60, link[3] + 56]} k={k} pad={4} />
              {name === "m-navi-board" && (
                <Ring frame={frame} at={tScreen} b={box("ana", "m-navi-board")} k={k} color={C.success} pad={3} radius={12} />
              )}
            </>
          )} />
        <div style={{ position: "absolute", left: pw * 0.035, top: pw * 0.035 + ps * 0.1, width: ps, height: ps * 844 / 390 }}>
          <Pointer frame={frame} kind="touch" appear={tHi - 8} hide={tHi + 16}
            path={[[tHi - 8, 300 * pk, 640 * pk], [tHi + 4, 352 * pk, 732 * pk], [tHi + 20, 340 * pk, 700 * pk]]} taps={[tHi + 4]} />
          <Pointer frame={frame} kind="touch" appear={tTakes - 10} hide={tTakes + 14}
            path={[[tTakes - 10, 250 * pk, 640 * pk], [tTakes + 2, ...centre(link, pk)], [tTakes + 20, 160 * pk, 700 * pk]]} taps={[tTakes + 2]} />
        </div>
      </PhoneFrame>

      <div style={{
        position: "absolute", left: 1400, top: 360, width: 420, color: "white", opacity: ramp(frame, tAnswer + 6, 10),
        transform: `translateX(${(1 - ramp(frame, tAnswer + 6, 14)) * 30}px)`,
      }}>
        <Kicker>Answers from live data</Kicker>
        <div style={{ marginTop: 14, fontSize: 40, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
          Checks the live board for you
        </div>
        <div style={{
          marginTop: 22, display: "inline-flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 700,
          color: C.brand200, opacity: ramp(frame, tTakes, 8),
        }}><FileText size={24} color={C.amber} />Then takes you there</div>
      </div>
    </AbsoluteFill>
  );
};
