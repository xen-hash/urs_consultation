import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ArrowLeft, X } from "lucide-react";

/**
 * The first-run walkthrough.
 *
 * Nobody reads a manual for a consultation booking app, and nobody should have
 * to hunt for what the buttons do. This is the tour a newly installed app gives
 * you: it points at the real control on the real screen, names it, says what it
 * is for, and moves on when you tap Next.
 *
 * It points at live elements rather than showing pictures of them, so it cannot
 * drift out of date the way a screenshot-based guide does — a step whose target
 * has gone is skipped rather than pointing at nothing.
 *
 * A step can also carry a `before`, which the tour runs as the step opens. That
 * is what turns the student tour into a live demo: it opens a real department,
 * a real professor and the real request form, on this person's actual account,
 * so the walkthrough is the task rather than a description of it. Nothing is
 * ever submitted on their behalf — the last step explains the button and leaves
 * it for them to press.
 *
 * Shown once per person per tour, remembered in localStorage. A guide that
 * reappears every visit stops being help and becomes an obstacle, so it is also
 * dismissible at any point and re-openable from the header.
 */

const seenKey = (id) => `urs.tour.${id}`;

export function hasSeenTour(id) {
  try { return localStorage.getItem(seenKey(id)) === "done"; }
  catch { return true; }   // storage blocked — never nag
}

export function markTourSeen(id) {
  try { localStorage.setItem(seenKey(id), "done"); } catch { /* not fatal */ }
}

export function resetTour(id) {
  try { localStorage.removeItem(seenKey(id)); } catch { /* not fatal */ }
}

const PAD = 8;

/**
 * The element a step points at, or null.
 *
 * `target` may be a list, because the same control lives in two places at
 * different breakpoints — the admin sections are a bottom bar on a phone and a
 * sidebar rail on a desktop. Whichever one is actually laid out wins.
 *
 * A zero-size box means the element is in the DOM but hidden at this width.
 * querySelector still finds it, and pointing at it drew a 16px ring in the
 * corner of the screen with everything else dimmed — the guide appeared to be
 * highlighting nothing. Treated as absent instead.
 */
function findTarget(target) {
  if (!target) return null;
  for (const selector of [].concat(target)) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export default function Walkthrough({ id, steps, open, onClose, onExit }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);
  const [cardH, setCardH] = useState(0);
  const cardRef = useRef(null);

  // Deliberately no scroll lock. Locking sets `position: fixed` on the body,
  // which freezes the page — and a frozen page cannot be scrolled, so the
  // scrollIntoView below did nothing and any target under the fold was ringed
  // where it sat, half of it off-screen. The student tour's professor card is
  // 384px tall on an 844px phone: the highlight came out as an empty box with
  // the card's contents below the edge. The ring follows the page instead.

  // Steps marked `requireTarget` are dropped when their control is not on this
  // screen; the rest stay and simply lose their highlight. A dashboard shows
  // different controls depending on the tab you are on, and silently cutting
  // half the guide is worse than a step that explains without pointing.
  const live = steps.filter(s => !s.requireTarget || findTarget(s.target));
  const step = live[index];
  const last = index === live.length - 1;

  useLayoutEffect(() => {
    if (!open || !step) return undefined;

    const measureOnly = () => {
      const el = findTarget(step.target);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top:    Math.max(0, r.top - PAD),
        left:   Math.max(0, r.left - PAD),
        width:  Math.max(0, Math.min(window.innerWidth, r.right + PAD) - Math.max(0, r.left - PAD)),
        height: Math.max(0, Math.min(window.innerHeight, r.bottom + PAD) - Math.max(0, r.top - PAD)),
      };
    };

    const measure = () => {
      const el = findTarget(step.target);
      if (!el) { setRect(null); setReady(true); return; }
      // Instant, not smooth: the measurement happens right after, and a scroll
      // still animating reports where the element was rather than where it is.
      // On a short screen that put the highlight half off the bottom.
      el.scrollIntoView({ block: "center", behavior: "auto" });

      // Clamped to the viewport. A fixed bottom bar sits flush against the
      // bottom edge, so the padded ring around it ran off the screen and the
      // highlight was cut in half.
      const r = el.getBoundingClientRect();
      const top    = Math.max(0, r.top - PAD);
      const left   = Math.max(0, r.left - PAD);
      const bottom = Math.min(window.innerHeight, r.bottom + PAD);
      const right  = Math.min(window.innerWidth, r.right + PAD);
      setRect({ top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
      setReady(true);
    };

    setReady(false);
    // A step that drives the app needs its screen to exist before anything is
    // measured, so the render it causes is given a beat to land. Without the
    // wait the cut-out is drawn around where the element used to be.
    step.before?.();
    const settle = setTimeout(measure, step.before ? 420 : 260);
    // Re-measured as the page moves, so the ring stays on its target rather
    // than being left behind by momentum scrolling after scrollIntoView.
    const follow = () => setRect(r => (r ? measureOnly() : r));
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", follow, { passive: true, capture: true });
    return () => {
      clearTimeout(settle);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", follow, { capture: true });
    };
  }, [open, step, index]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") setIndex(i => Math.max(0, i - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  useEffect(() => { if (open) { setIndex(0); cardRef.current?.focus(); } }, [open]);

  // The card is placed against its real height. It used to be positioned with
  // a guessed 220px, so a step with three lines of text hung off the bottom of
  // the screen with its buttons out of reach.
  useLayoutEffect(() => {
    if (!open) return;
    const h = cardRef.current?.offsetHeight;
    if (h && h !== cardH) setCardH(h);
  });

  if (!open || !step) return null;

  const finish = () => {
    markTourSeen(id);
    // Put the app back where it was found. A demo that opens a department and
    // a half-filled form should not leave the person standing in it.
    onExit?.();
    onClose();
  };
  const next = () => (last ? finish() : setIndex(i => i + 1));

  // Placed against the space actually available, not a guess: below the
  // highlight if it fits there, above it if it fits there, and centred only
  // when neither has room — at which point covering part of the target is the
  // least bad option, and the card is still whole and reachable.
  //
  // `side` is which way the arrow points: the card sits below the target and
  // points up at it, or sits above and points down.
  const { cardStyle, side } = (() => {
    const vh = window.innerHeight;
    const h = cardH || 240;
    const GAP = 16, EDGE = 12;
    const centred = { cardStyle: { top: Math.max(EDGE, Math.round((vh - h) / 2)) }, side: null };

    if (!rect) return centred;

    const roomBelow = vh - (rect.top + rect.height) - GAP - EDGE;
    const roomAbove = rect.top - GAP - EDGE;

    if (roomBelow >= h) return { cardStyle: { top: rect.top + rect.height + GAP }, side: "up" };
    if (roomAbove >= h) return { cardStyle: { top: Math.max(EDGE, rect.top - GAP - h) }, side: "down" };

    // Neither side fits — a tall target on a short screen. Centring puts the
    // card across the middle of the thing it is describing, which on the
    // professor card meant sitting squarely over the name. Take the roomier
    // side and sit flush against that edge instead, so the overlap eats the
    // target's edge rather than its subject.
    return roomBelow >= roomAbove
      ? { cardStyle: { bottom: EDGE }, side: null }
      : { cardStyle: { top: EDGE }, side: null };
  })();

  // The arrow sits over the middle of the target, so the line from the words to
  // the thing they describe is drawn rather than left to be worked out. Clamped
  // to the card so it cannot detach from its own corner.
  const cardLeft = Math.max(12, (window.innerWidth - Math.min(352, window.innerWidth - 32)) / 2);
  const cardWidth = Math.min(352, window.innerWidth - 32);
  const arrowX = rect
    ? Math.min(cardWidth - 26, Math.max(14, rect.left + rect.width / 2 - cardLeft - 7))
    : 0;

  return createPortal(
    <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true"
      aria-label={`${step.title} — step ${index + 1} of ${live.length}`}>
      {/* The dim is four panels around the target rather than one sheet with a
          hole in it: no clip-path, no SVG mask, and the highlighted control
          stays visible at full contrast. */}
      {rect && ready ? (
        <>
          <Dim style={{ top: 0, left: 0, right: 0, height: rect.top }} />
          <Dim style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }} />
          <Dim style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }} />
          <Dim style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }} />
          <span
            aria-hidden="true"
            className="tour-ring absolute rounded-xl border-2 border-accent pointer-events-none animate-fade"
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          />
        </>
      ) : (
        <Dim style={{ inset: 0 }} />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        className="absolute left-0 right-0 mx-auto w-[min(22rem,calc(100vw-2rem))]
                   max-h-[calc(100dvh-1.5rem)] overflow-y-auto
                   bg-surface rounded-xl shadow-lg p-5 animate-rise focus:outline-none"
        style={cardStyle}
      >
        {side && (
          <span
            aria-hidden="true"
            className="absolute w-3.5 h-3.5 bg-surface rotate-45"
            style={side === "up"
              ? { top: -6, left: arrowX }
              : { bottom: -6, left: arrowX }}
          />
        )}

        <div className="relative flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-subtle-fg">
              Step {index + 1} of {live.length}
            </p>
            <h2 className="font-semibold text-fg mt-1.5">{step.title}</h2>
            <p className="text-sm text-muted-fg mt-1.5 leading-relaxed">{step.body}</p>
          </div>
          <button onClick={finish} aria-label="Skip the guide"
            className="w-9 h-9 -mr-2 -mt-2 grid place-items-center rounded-lg text-muted-fg
                       hover:text-fg hover:bg-surface-2 shrink-0">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-5">
          <div className="flex gap-1.5 mr-auto" aria-hidden="true">
            {live.map((_, i) => (
              <span key={i}
                className={`h-1.5 rounded-full transition-all duration-200
                  ${i === index ? "w-5 bg-brand" : "w-1.5 bg-border-strong"}`} />
            ))}
          </div>
          {index > 0 && (
            <button onClick={() => setIndex(i => i - 1)} className="btn btn-ghost btn-sm">
              <ArrowLeft size={14} aria-hidden="true" /> Back
            </button>
          )}
          <button onClick={next} className="btn btn-primary btn-sm">
            {last ? "Got it" : "Next"}
            {!last && <ArrowRight size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Dim({ style }) {
  return (
    <div aria-hidden="true" className="absolute bg-brand-900/80 animate-fade" style={style} />
  );
}
