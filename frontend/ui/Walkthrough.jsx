import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ArrowLeft, X } from "lucide-react";
import { useScrollLock } from "./index.jsx";

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

export default function Walkthrough({ id, steps, open, onClose }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);
  const cardRef = useRef(null);

  useScrollLock(open);

  // Steps marked `requireTarget` are dropped when their control is not on this
  // screen; the rest stay and simply lose their highlight. A dashboard shows
  // different controls depending on the tab you are on, and silently cutting
  // half the guide is worse than a step that explains without pointing.
  const live = steps.filter(s => !s.requireTarget || document.querySelector(s.target));
  const step = live[index];
  const last = index === live.length - 1;

  useLayoutEffect(() => {
    if (!open || !step) return undefined;

    const measure = () => {
      if (!step.target) { setRect(null); setReady(true); return; }
      const el = document.querySelector(step.target);
      if (!el) { setRect(null); setReady(true); return; }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      // Let the scroll settle before measuring, or the cut-out lands where the
      // element used to be.
      setTimeout(() => {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        setReady(true);
      }, 260);
    };

    setReady(false);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
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

  if (!open || !step) return null;

  const finish = () => { markTourSeen(id); onClose(); };
  const next = () => (last ? finish() : setIndex(i => i + 1));

  // The card goes below the highlight, or above it when the highlight is low on
  // the screen — otherwise the thing being explained is behind the explanation.
  const below = !rect || rect.top + rect.height < window.innerHeight * 0.55;
  const cardStyle = rect
    ? below
      ? { top: Math.min(rect.top + rect.height + 14, window.innerHeight - 220) }
      : { bottom: Math.min(window.innerHeight - rect.top + 14, window.innerHeight - 200) }
    : { top: Math.max(24, Math.round((window.innerHeight - 260) / 2)) };

  return createPortal(
    <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true"
      aria-label={`${step.title} — step ${index + 1} of ${live.length}`}>
      {/* The dim is four panels around the target rather than one sheet with a
          hole in it: no clip-path, no SVG mask, and the highlighted control
          stays visible at full contrast. */}
      {rect && ready ? (
        <>
          <Dim style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - PAD) }} />
          <Dim style={{ top: Math.max(0, rect.top - PAD), left: 0, width: Math.max(0, rect.left - PAD), height: rect.height + PAD * 2 }} />
          <Dim style={{ top: Math.max(0, rect.top - PAD), left: rect.left + rect.width + PAD, right: 0, height: rect.height + PAD * 2 }} />
          <Dim style={{ top: rect.top + rect.height + PAD, left: 0, right: 0, bottom: 0 }} />
          <span
            aria-hidden="true"
            className="absolute rounded-xl ring-2 ring-accent pointer-events-none animate-fade"
            style={{
              top: rect.top - PAD, left: rect.left - PAD,
              width: rect.width + PAD * 2, height: rect.height + PAD * 2,
              boxShadow: "0 0 0 3px rgb(var(--accent) / 0.25)",
            }}
          />
        </>
      ) : (
        <Dim style={{ inset: 0 }} />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        className="absolute left-0 right-0 mx-auto w-[min(22rem,calc(100vw-2rem))]
                   bg-surface rounded-xl shadow-lg p-5 animate-rise focus:outline-none"
        style={cardStyle}
      >
        <div className="flex items-start gap-3">
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
    <div aria-hidden="true" className="absolute bg-brand-900/70 animate-fade" style={style} />
  );
}
