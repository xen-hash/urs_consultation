/**
 * Navi — the help bubble, on every page.
 *
 * Tap the mascot and it opens a panel with one job: answer the question
 * somebody would otherwise have asked at the Dean's Office window. Two ways
 * in, and they are equals rather than a main one and a fallback:
 *
 *   Typing      always available, always works, needs no permission.
 *   Speaking    for a phone held one-handed in a corridor, or for anyone who
 *               finds a keyboard slower than a sentence.
 *
 * The microphone is asked for in two steps on purpose. The first press opens
 * an explainer saying what the microphone is for and that speech is handled by
 * the browser; only the button inside that explainer starts listening, which is
 * what raises the browser's own permission prompt. A permission prompt that
 * appears with no warning gets dismissed out of reflex, and once dismissed it
 * is a trip into browser settings to undo — so it is worth a sentence first.
 *
 * Answers come from navi-faq.js, matched in the browser. See that file for why
 * there is no model behind this.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight, Mic, MicOff, RotateCcw, Send, Settings2, Volume2, VolumeX, X,
} from "lucide-react";

import Mascot from "./Mascot.jsx";
import { useScrollLock } from "./index.jsx";
import { STARTERS, askNavi } from "./navi-faq.js";
import { askLive, classify } from "./navi-live.js";
import { shouldReset, trimTurns } from "./navi-session.js";
import { PROJECT_CONTACT } from "../constants.js";
import {
  SILENCE_MS, defaultVoice, listen, microphoneState, onVoicesReady, speak,
  speechSupport, stopSpeaking,
} from "./speech.js";

const SPEAK_KEY = "urs.navi.speak";
const VOICE_KEY = "urs.navi.voice";

/** Read-aloud is off unless asked for: a phone that talks unprompted in a
 *  quiet corridor is a reason to close the app. */
function readSpeakPreference() {
  try { return localStorage.getItem(SPEAK_KEY) === "on"; } catch { return false; }
}

function writeSpeakPreference(on) {
  try { localStorage.setItem(SPEAK_KEY, on ? "on" : "off"); } catch { /* not fatal */ }
}

/** Which voice Navi speaks with, per device: the voices differ on every phone. */
function readVoicePreference() {
  try { return localStorage.getItem(VOICE_KEY) || ""; } catch { return ""; }
}

function writeVoicePreference(uri) {
  try { localStorage.setItem(VOICE_KEY, uri || ""); } catch { /* not fatal */ }
}

/**
 * What Navi says when nothing matched.
 *
 * Not an error, and not a dead end: it names what Navi does know, so the next
 * question has a better chance, and it names somewhere real to go when the
 * answer is not in the app at all.
 */
const NO_MATCH =
  "I don't know that one. I can help with signing in, booking a consultation, " +
  "checking who is free right now, and what happened to a request you sent. " +
  "For anything else, the Dean's Office is the place to ask" +
  (PROJECT_CONTACT ? `, or email ${PROJECT_CONTACT}.` : ".");

let nextId = 0;

/**
 * The part of the screen not covered by the on-screen keyboard.
 *
 * A panel anchored to the bottom of the window is anchored to the bottom of
 * the *layout* viewport, and on iOS the keyboard does not shrink that — it
 * slides over the top of it. So the question box, the one thing somebody just
 * tapped to type into, ends up underneath the keyboard they opened.
 *
 * visualViewport is the part still visible. Sizing the panel to that instead
 * keeps the input row just above the keyboard on iOS, and changes nothing on
 * Android, where the window already resizes. Browsers without it (none that
 * matter here, but still) fall back to the full window.
 */
function useVisibleViewport(active) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) { setRect(null); return undefined; }

    const apply = () => setRect({ height: vv.height, top: vv.offsetTop });
    apply();
    vv.addEventListener("resize", apply);
    // The page scrolls under the keyboard on iOS; offsetTop moves with it.
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, [active]);

  return rect;
}

export default function NaviAssistant() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState([]);       // { id, question, answers }
  const [draft, setDraft] = useState("");
  const [speakBack, setSpeakBack] = useState(readSpeakPreference);
  const [nowSpeaking, setNowSpeaking] = useState(false);

  // Microphone: "idle" | "explaining" | "listening" | "blocked"
  const [mic, setMic] = useState("idle");
  const [heard, setHeard] = useState("");       // interim dictation
  const [micError, setMicError] = useState(null);
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState(readVoicePreference);
  const [showVoices, setShowVoices] = useState(false);

  const { pathname } = useLocation();
  const support = useRef(speechSupport()).current;
  const viewport = useVisibleViewport(open);
  // The page behind must not scroll with the panel over it — on iOS it
  // rubber-bands, which reads as the panel itself coming loose.
  useScrollLock(open);
  const sessionRef = useRef(null);
  const inputRef = useRef(null);
  const logRef = useRef(null);
  const launcherRef = useRef(null);
  const returnFocus = useRef(false);
  // When the reader last asked something or closed the panel. Drives whether
  // reopening continues the conversation or starts a new one.
  const lastActivity = useRef(0);

  /** Done speaking: close the microphone and ask what was heard. */
  const stopListening = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
  }, []);

  /** Leaving: close the microphone and throw away whatever was half-said. */
  const cancelListening = useCallback(() => {
    sessionRef.current?.abort();
    sessionRef.current = null;
  }, []);

  const say = useCallback((text) => {
    if (!speakBack) return;
    setNowSpeaking(true);
    speak(text, { voiceURI, onEnd: () => setNowSpeaking(false) });
  }, [speakBack, voiceURI]);

  // Chrome returns an empty voice list on the first read and fills it in
  // later, so this listens rather than asking once.
  useEffect(() => onVoicesReady((list) => {
    setVoices(list);
    // Nothing chosen yet: take the closest accent rather than whatever the
    // engine would have defaulted to.
    setVoiceURI(current => current || defaultVoice(list)?.voiceURI || "");
  }), []);

  const answer = useCallback((question) => {
    const text = question.trim();
    if (!text) return;

    const id = nextId++;
    // The page settles which audience a question belongs to far better than
    // its wording does — see audienceForPath in navi-faq.js.
    const answers = askNavi(text, { pathname });
    // "Who is free right now" wants the roster, not a paragraph about where
    // the roster lives. That needs the network, so the turn goes up straight
    // away and fills in when the answer lands.
    const live = Boolean(classify(text));

    lastActivity.current = Date.now();
    setTurns(prev => trimTurns([...prev, {
      id, question: text, answers, live: live ? "pending" : null,
    }]));
    setDraft("");
    setHeard("");

    if (!live) {
      say(answers.length ? answers[0].answer : NO_MATCH);
      return;
    }

    askLive(text).then((result) => {
      setTurns(prev => prev.map(t => (t.id === id ? { ...t, live: result || null } : t)));
      // A live question Navi could not resolve falls back to whatever the FAQ
      // made of it, which is what is already on screen.
      say(result ? result.text : (answers.length ? answers[0].answer : NO_MATCH));
    });
  }, [pathname, say]);

  // ── Microphone ────────────────────────────────────────────────────────────

  const startListening = useCallback(() => {
    setMicError(null);
    setHeard("");
    setMic("listening");
    // Reading aloud and listening at the same time means Navi dictates its own
    // answer back into the question box.
    stopSpeaking();
    setNowSpeaking(false);

    sessionRef.current = listen({
      onResult: (text, isFinal) => {
        setHeard(text);
        if (isFinal) answer(text);
      },
      onError: (message) => {
        setMicError(message);
        setMic(message.includes("refused") ? "blocked" : "idle");
      },
      onEnd: () => {
        sessionRef.current = null;
        setMic(current => (current === "listening" ? "idle" : current));
      },
    });
  }, [answer]);

  const pressMic = useCallback(async () => {
    // Finished speaking. stopListening submits what was heard, which is the
    // whole point: the engine often ends without ever marking a result final.
    if (mic === "listening") { stopListening(); setMic("idle"); return; }
    if (mic === "explaining") { setMic("idle"); return; }

    // Already granted once — the browser will not prompt again, so neither
    // should we. Explaining a permission somebody already gave is nagging.
    const state = await microphoneState();
    if (state === "granted") startListening();
    else if (state === "denied") {
      setMic("blocked");
      setMicError(
        "The microphone is blocked for this site. Allow it in your browser " +
        "settings, or type your question instead.");
    } else setMic("explaining");
  }, [mic, startListening, stopListening]);

  // ── Panel lifecycle ───────────────────────────────────────────────────────

  const close = useCallback(() => {
    lastActivity.current = Date.now();
    cancelListening();
    stopSpeaking();
    setOpen(false);
    setMic("idle");
    setHeard("");
    setNowSpeaking(false);
    // Focus goes back to the button that opened this, but not from here: the
    // launcher is unmounted while the panel is up, so there is nothing to focus
    // until React has re-rendered it. The effect below does it afterwards.
    returnFocus.current = true;
  }, [cancelListening]);

  useEffect(() => {
    if (open || !returnFocus.current) return;
    returnFocus.current = false;
    launcherRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Everything stops when the panel goes away, including on unmount: a
  // half-spoken answer outliving the page it belongs to is a bug people
  // report as "the website is talking to me".
  useEffect(() => () => { cancelListening(); stopSpeaking(); }, [cancelListening]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Newest answer into view. The panel is short and two questions fill it.
  useEffect(() => {
    if (turns.length) logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const toggleSpeak = () => {
    const next = !speakBack;
    setSpeakBack(next);
    writeSpeakPreference(next);
    if (!next) { stopSpeaking(); setNowSpeaking(false); }
  };

  // ── Launcher ──────────────────────────────────────────────────────────────

  if (!open) {
    return (
      <button
        ref={launcherRef}
        onClick={() => {
          // A few minutes away means this is a new question, not a
          // continuation — see navi-session.js for why not on every close.
          if (shouldReset(lastActivity.current)) setTurns([]);
          setOpen(true);
        }}
        aria-label="Ask Navi for help"
        title="Ask Navi"
        // Clear of the bottom tab bar on phones, which is 72px plus the home
        // indicator; the bar is gone from lg up, so the offset goes with it.
        className="fixed right-4 z-40 rounded-full bg-surface border border-border shadow-lg
                   hover:shadow-xl hover:border-brand-300 active:scale-95
                   transition-all duration-200 p-1.5 animate-rise
                   bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))]
                   lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
      >
        <Mascot pose="idle" size="xs" className="rounded-full" />
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent border-2 border-surface"
        />
      </button>
    );
  }

  // ── Panel ─────────────────────────────────────────────────────────────────

  const pose = mic === "listening" ? "listening"
    : nowSpeaking ? "helpful"
    : turns.length ? "happy"
    : "helpful";

  return createPortal(
    <div
      className="fixed inset-x-0 z-[90] flex items-end sm:justify-end"
      // Pinned to the visible viewport rather than the window, so the keyboard
      // pushes the panel up instead of covering it. Falls back to the window.
      style={viewport
        ? { top: viewport.top, height: viewport.height }
        : { top: 0, bottom: 0 }}
    >
      {/* Full-screen on a phone, a panel in the corner from sm up. The scrim
          is there on both: it is what makes a tap outside close this. */}
      <button
        aria-label="Close Navi"
        onClick={close}
        className="absolute inset-0 bg-brand-900/40 animate-fade cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ask Navi"
        // Heights are a share of the container above, which is the visible
        // viewport, not 85vh — with the keyboard open, 85vh is taller than
        // what is left of the screen.
        className="relative w-full sm:w-[26rem] sm:m-5 bg-surface rounded-t-2xl sm:rounded-2xl
                   border border-border shadow-lg animate-rise flex flex-col
                   max-h-[85%] sm:max-h-[min(36rem,calc(100%-2.5rem))]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Mascot pose={pose} size="xs" className="rounded-full" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-fg leading-tight">Navi</p>
            <p className="text-xs text-muted-fg leading-tight">
              {mic === "listening"
                ? `Listening — I'll send after ${SILENCE_MS / 1000}s of quiet`
                : "Ask me about consultations"}
            </p>
          </div>
          {turns.length > 0 && (
            <button
              onClick={() => {
                stopSpeaking();
                setNowSpeaking(false);
                setTurns([]);
                lastActivity.current = Date.now();
                inputRef.current?.focus();
              }}
              aria-label="Start over"
              title="Start over"
              className="w-10 h-10 grid place-items-center rounded-lg text-muted-fg
                         hover:text-fg hover:bg-surface-2 transition-colors duration-200"
            >
              <RotateCcw size={17} aria-hidden="true" />
            </button>
          )}
          {support.speaking && voices.length > 1 && speakBack && (
            <button
              onClick={() => setShowVoices(v => !v)}
              aria-expanded={showVoices}
              aria-label="Choose Navi's voice"
              title="Choose Navi's voice"
              className={`w-10 h-10 grid place-items-center rounded-lg transition-colors duration-200
                ${showVoices ? "bg-brand-50 text-brand" : "text-muted-fg hover:text-fg hover:bg-surface-2"}`}
            >
              <Settings2 size={18} aria-hidden="true" />
            </button>
          )}
          {support.speaking && (
            <button
              onClick={toggleSpeak}
              aria-pressed={speakBack}
              aria-label={speakBack ? "Turn off reading answers aloud" : "Read answers aloud"}
              title={speakBack ? "Answers are read aloud" : "Read answers aloud"}
              className={`w-10 h-10 grid place-items-center rounded-lg transition-colors duration-200
                ${speakBack ? "bg-brand-50 text-brand" : "text-muted-fg hover:text-fg hover:bg-surface-2"}`}
            >
              {speakBack ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
            </button>
          )}
          <button
            onClick={close}
            aria-label="Close"
            className="w-10 h-10 grid place-items-center rounded-lg text-muted-fg
                       hover:text-fg hover:bg-surface-2 transition-colors duration-200"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Voice picker. The list comes from the device, so it is different on
            every phone and there is nothing to promise in advance — which is
            why this is a list to choose from rather than a setting we guess. */}
        {showVoices && (
          <div className="px-4 py-3 border-b border-border bg-surface-2/50">
            <label htmlFor="navi-voice" className="label mb-1.5">Navi&rsquo;s voice</label>
            <div className="flex gap-2">
              <select
                id="navi-voice"
                value={voiceURI}
                onChange={(e) => {
                  setVoiceURI(e.target.value);
                  writeVoicePreference(e.target.value);
                  // Say something in it immediately: a voice name means
                  // nothing until you have heard it.
                  stopSpeaking();
                  setNowSpeaking(true);
                  speak("Hi, I'm Navi. Ask me about consultations.", {
                    voiceURI: e.target.value,
                    onEnd: () => setNowSpeaking(false),
                  });
                }}
                className="input flex-1 min-w-0"
              >
                {voices.map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-fg mt-2">
              These come from your phone or computer, so the list differs between devices.
            </p>
          </div>
        )}

        {/* Conversation */}
        <div ref={logRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {turns.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-fg leading-relaxed">
                Hi! I can answer questions about this system — signing in, booking a
                consultation, checking who is free, and what happened to a request you
                sent. Type it, or press the microphone and say it.
              </p>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map(starter => (
                  <button
                    key={starter}
                    onClick={() => answer(starter)}
                    className="text-left text-xs font-medium rounded-full border border-border
                               px-3 py-1.5 text-muted-fg hover:text-brand hover:border-brand-300
                               hover:bg-brand-50 transition-colors duration-200"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* One region, so a screen reader reads new answers without the
              questions being announced twice as they are typed. */}
          <div aria-live="polite" aria-atomic="false" className="space-y-4">
            {turns.map(turn => (
              <Turn key={turn.id} turn={turn} onAsk={answer} onClose={close} />
            ))}
          </div>
        </div>

        {/* Microphone explainer — the step before the browser's own prompt. */}
        {mic === "explaining" && (
          <div className="mx-4 mb-3 rounded-lg bg-info-50 text-info p-3.5 text-sm">
            <p className="font-semibold">Use your microphone?</p>
            <p className="mt-1 leading-relaxed text-info/90">
              Your browser will ask for permission, then you can say your question
              instead of typing it. Your browser handles the speech; nothing is
              recorded or stored here.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={startListening}
                className="btn btn-primary btn-sm"
              >
                <Mic size={14} aria-hidden="true" /> Allow and ask
              </button>
              <button
                onClick={() => { setMic("idle"); inputRef.current?.focus(); }}
                className="btn btn-secondary btn-sm"
              >
                I'll type instead
              </button>
            </div>
          </div>
        )}

        {micError && mic !== "explaining" && (
          <p role="status" className="mx-4 mb-3 rounded-lg bg-warning-50 text-warning-fg px-3.5 py-2.5 text-sm">
            {micError}
          </p>
        )}

        {/* Ask */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Mid-sentence, the send button means "that is my question" —
            // stopping submits what has been heard rather than discarding it,
            // so the two seconds of silence never have to elapse.
            if (mic === "listening") { stopListening(); setMic("idle"); return; }
            answer(draft);
          }}
          className="flex items-end gap-2 p-3 border-t border-border pb-safe-4 sm:pb-3"
        >
          <label className="sr-only" htmlFor="navi-question">Your question</label>
          <input
            id="navi-question"
            ref={inputRef}
            value={mic === "listening" && heard ? heard : draft}
            onChange={e => setDraft(e.target.value)}
            readOnly={mic === "listening"}
            placeholder={mic === "listening" ? "Listening…" : "Ask a question"}
            autoComplete="off"
            className="input flex-1"
          />
          {support.listening && (
            <button
              type="button"
              onClick={pressMic}
              aria-label={mic === "listening" ? "Stop listening" : "Ask by voice"}
              aria-pressed={mic === "listening"}
              title={mic === "listening" ? "Stop listening" : "Ask by voice"}
              className={`w-11 h-11 shrink-0 grid place-items-center rounded-lg border transition-colors duration-200
                ${mic === "listening"
                  ? "bg-danger border-danger animate-shimmer"
                  : mic === "blocked"
                  ? "bg-surface-2 text-subtle-fg border-border"
                  : "bg-surface text-muted-fg border-border hover:text-brand hover:border-brand-300"}`}
              style={mic === "listening" ? { color: "rgb(var(--on-danger))" } : undefined}
            >
              {mic === "blocked"
                ? <MicOff size={18} aria-hidden="true" />
                : <Mic size={18} aria-hidden="true" />}
            </button>
          )}
          <button
            type="submit"
            disabled={mic === "listening" ? !heard.trim() : !draft.trim()}
            aria-label={mic === "listening" ? "Send what you have said" : "Send question"}
            className="w-11 h-11 shrink-0 grid place-items-center rounded-lg bg-brand
                       hover:bg-brand-700 transition-colors duration-200
                       disabled:opacity-40 disabled:pointer-events-none"
            style={{ color: "rgb(var(--on-brand))" }}
          >
            <Send size={18} aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}

/** One question and what Navi made of it. */
function Turn({ turn, onAsk, onClose }) {
  const [best, ...others] = turn.answers;

  return (
    <div className="space-y-2.5">
      {/* break-words, because max-width alone does not wrap a word with no
          spaces in it — a pasted student number or email ran straight out of
          the bubble and was clipped at the panel edge. */}
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-brand-50 text-brand
                    px-3.5 py-2 text-sm font-medium break-words">
        {turn.question}
      </p>

      {/* A live answer supersedes the written one: asked who is free, Navi
          says who is free. The FAQ entry stays behind it only as the fallback
          for when the data could not be reached. */}
      {turn.live === "pending" ? (
        <div className="w-fit rounded-2xl rounded-bl-sm bg-surface-2 px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-sm text-muted-fg">
            <span className="h-2 w-2 rounded-full bg-brand animate-shimmer" aria-hidden="true" />
            Checking…
          </span>
        </div>
      ) : turn.live ? (
        <div className="w-fit max-w-[92%] rounded-2xl rounded-bl-sm bg-brand-50 px-3.5 py-2.5 break-words">
          <p className="text-sm text-fg leading-relaxed">{turn.live.text}</p>
          {turn.live.go && (
            <Link
              to={turn.live.go.to}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 mt-2.5 text-sm font-semibold text-brand"
            >
              {turn.live.go.label}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
      ) : (
      <div className="w-fit max-w-[92%] rounded-2xl rounded-bl-sm bg-surface-2 px-3.5 py-2.5 break-words">
        {best ? (
          <>
            <p className="text-sm text-fg leading-relaxed">{best.answer}</p>
            {best.go && (
              <Link
                to={best.go.to}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 mt-2.5 text-sm font-semibold text-brand"
              >
                {best.go.label}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
          </>
        ) : (
          <p className="text-sm text-fg leading-relaxed">{NO_MATCH}</p>
        )}
      </div>
      )}

      {/* The runners-up, as questions rather than answers. Stacking three full
          answers makes the right one harder to find, not easier. A live answer
          came from the data and has no alternatives to offer. */}
      {!turn.live && others.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-subtle-fg w-full">Did you mean:</span>
          {others.map(other => (
            <button
              key={other.id}
              onClick={() => onAsk(other.question)}
              className="text-left text-xs font-medium rounded-full border border-border
                         px-3 py-1.5 text-muted-fg hover:text-brand hover:border-brand-300
                         hover:bg-brand-50 transition-colors duration-200"
            >
              {other.question}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
