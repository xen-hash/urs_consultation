import { AbsoluteFill } from "remotion";
import { C, FONT } from "../theme";
import { cue } from "../timing";
import { keys, pop, ramp, useScene } from "../anim";
import { Kicker, Pointer, Window } from "../ui";
import { box, centre, PhoneFrame, phoneScreenWidth, Ring, States } from "../screens";

const CHROME = 56;

// "Open the live availability board, and see in real time who's available,
//  who's not, and who's on leave. No more guessing. No more wasted trips."
export const Board = () => {
  const { frame, at } = useScene();
  const tLive = at(cue("real time"));
  const groups = [
    [at(cue("who's available")), ["Engr. Ana Villareal", "Prof. Marco Dizon", "Prof. Rina Torres", "Engr. Kaye Bautista", "Engr. Liza Manalo"], C.success],
    [at(cue("who's not")), ["Engr. Tomas Rivera", "Engr. Rey Padilla"], "#64748b"],
    [at(cue("who's on leave")), ["Engr. Nico Valdez"], C.amber],
  ];
  const tDone = at(cue("no more guessing"));

  const W = 1560, VIEW = 730;
  const scroll = keys(frame, [[tDone, 0], [tDone + 60, 160]]);
  const enter = ramp(frame, 0, 22);
  return (
    <AbsoluteFill style={{ fontFamily: FONT, perspective: 1800 }}>
      <Window path="/availability" width={W} height={CHROME + VIEW * (W / 1440)} style={{
        position: "absolute", left: 180, top: 34,
        transform: `rotateX(${(1 - enter) * 12}deg) scale(${0.95 + enter * 0.05})`, transformOrigin: "50% 100%",
      }}>
        <States frame={frame} width={W} height={VIEW} scrollY={scroll} fade={8}
          states={[["board", 0], ["board-live", tLive]]}
          overlay={(k) => (
            <>
              <Ring frame={frame} at={tLive + 2} until={groups[0][0] - 8} b={box("Prof. Marco Dizon", "board-live")} k={k} color={C.success} pad={2} radius={12} />
              <Ring frame={frame} at={tLive + 4} until={groups[0][0] - 8} b={box("available", "board-live")} k={k} color={C.success} />
              {groups.map(([t, names, color], g) => {
                const until = g + 1 < groups.length ? groups[g + 1][0] - 2 : tDone;
                return names.map((n) => (
                  <Ring key={n} frame={frame} at={t} until={until} b={box(n, "board-live")} k={k} color={color} pad={2} radius={12} />
                ));
              })}
            </>
          )} />
      </Window>
    </AbsoluteFill>
  );
};

// "For faculty, it's just as easy. Your status updates itself from your
//  schedule. Stepping out? Change it with one tap, and every student sees it instantly."
export const Faculty = () => {
  const { frame, at } = useScene();
  const tAuto = at(cue("your status updates"));
  const tSched = at(cue("from your schedule"));
  const tStep = at(cue("stepping out"));
  const tChange = at(cue("change it"));
  const tTap = at(cue("one tap"));
  const tSees = tTap + 10;

  const W = 1120, k0 = W / 1440;
  const winIn = ramp(frame, 0, 18);
  const phoneIn = pop(frame, 10);
  // Push in on the two cards that matter, then hold.
  const zoom = keys(frame, [[tAuto - 4, 1], [tAuto + 22, 1.42]]);
  const [cx, cy] = [720 * k0, 330 * k0];
  const sel = box("select", "t-status"), upd = box("update", "t-status");
  const [sx, sy] = centre(sel, k0), [ux, uy] = centre(upd, k0);

  const pw = 380, ps = phoneScreenWidth(pw);
  const ana = box("ana", "m-civil");

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Kicker style={{ position: "absolute", left: 120, top: 42, opacity: winIn }}>Teacher dashboard</Kicker>
      <Window path="/teacher/dashboard" width={W} height={CHROME + 900 * k0} style={{
        position: "absolute", left: 110, top: 88, opacity: winIn, transform: `translateX(${(1 - winIn) * -60}px)`,
      }}>
        <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: `${cx}px ${cy}px` }}>
          <States frame={frame} width={W} fade={5}
            states={[["t-status", 0], ["t-status-picked", tChange], ["t-status-set", tTap + 4]]}
            overlay={(k) => (
              <>
                <Ring frame={frame} at={tAuto + 16} until={tSched - 2} b={sel} k={k} />
                <Ring frame={frame} at={tSched} until={tStep - 4} b={box("thu", "t-status")} k={k} />
                <Ring frame={frame} at={tSched + 8} until={tStep - 4} b={box("badge", "t-status")} k={k} color={C.success} pad={5} radius={99} />
                <Pointer frame={frame} appear={tStep} hide={tTap + 30}
                  path={[[tStep, sx + 160, sy + 150], [tChange - 3, sx + 40, sy + 8], [tChange + 8, sx + 40, sy + 8],
                         [tTap - 2, ux + 30, uy + 6], [tTap + 20, ux + 36, uy + 12]]}
                  taps={[tChange - 2, tTap]} />
              </>
            )} />
        </div>
      </Window>

      {/* The change reaching a student's phone */}
      {[tTap + 4].map((t0) => {
        const p = ramp(frame, t0, 8);
        return p > 0 && p < 1 ? (
          <div key={t0} style={{
            position: "absolute", left: 1235 + p * 110, top: 470, width: 36, height: 36, borderRadius: 99,
            background: C.amber, boxShadow: `0 0 30px ${C.amber}`, opacity: 1 - p * 0.5,
          }} />
        ) : null;
      })}

      <Kicker style={{ position: "absolute", left: 1400, top: 42, opacity: phoneIn }}>Student's phone</Kicker>
      <PhoneFrame width={pw} style={{
        position: "absolute", left: 1390, top: 88, transform: `translateY(${(1 - phoneIn) * 140}px)`,
      }}>
        <States frame={frame} width={ps} fade={6}
          states={[["m-civil", 0], ["m-civil-live", tSees]]}
          overlay={(k) => <Ring frame={frame} at={tSees + 2} b={ana} k={k} color="#94a3b8" pad={4} />} />
      </PhoneFrame>
    </AbsoluteFill>
  );
};
