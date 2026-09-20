/**
 * Dictation and read-aloud for Navi's help panel.
 *
 * Both sit behind the Web Speech API, which is uneven enough to be worth
 * wrapping in one place:
 *
 *   - Recognition is `SpeechRecognition` in the spec and `webkitSpeechRecognition`
 *     everywhere it actually ships. Firefox has neither, so the panel has to be
 *     usable by typing alone — which it is; the microphone is an alternative to
 *     the text box, never the only way in.
 *   - Recognition on Chrome sends audio to Google's servers. That is worth a
 *     sentence in front of the reader before the browser's own permission
 *     prompt appears, which is why asking is a separate step from listening.
 *   - Synthesis is `speechSynthesis` and is everywhere, but on Chrome it needs
 *     a moment after load before `getVoices()` returns anything.
 *
 * Nothing here throws on an unsupported browser. Call `speechSupport()` and
 * hide the control instead — a microphone button that reports an error when
 * pressed is worse than no microphone button.
 */

const Recognition = typeof window !== "undefined"
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

export function speechSupport() {
  return {
    listening: Boolean(Recognition),
    speaking: typeof window !== "undefined" && Boolean(window.speechSynthesis),
  };
}

/**
 * Whether the microphone has already been granted, where the browser will say.
 *
 * Returns "granted", "denied" or "prompt". The Permissions API does not cover
 * the microphone in every browser — Safari being the one that matters here —
 * so an unknown answer is reported as "prompt" and the reader is asked. Being
 * asked twice is a small cost; silently skipping the explainer is not.
 */
export async function microphoneState() {
  try {
    const status = await navigator.permissions?.query({ name: "microphone" });
    return status?.state || "prompt";
  } catch {
    return "prompt";
  }
}

/**
 * One dictation attempt.
 *
 * Returns a handle with `stop()`. The callbacks fire at most once between
 * them, so a caller can leave its "listening" state on until one arrives.
 *
 *   onResult(text, isFinal)  partial text as it is heard, then the final text
 *   onError(message)         already written for a reader, not an error code
 *   onEnd()                  always last, whatever happened
 */
export const SILENCE_MS = 2000;

export function listen({
  onResult, onError, onEnd, onSilenceTick,
  lang = "en-PH", silenceMs = SILENCE_MS,
} = {}) {
  if (!Recognition) {
    onError?.("This browser cannot listen. Type your question instead.");
    onEnd?.();
    return { stop() {}, abort() {} };
  }

  const recognition = new Recognition();
  recognition.lang = lang;
  // Interim results are what make the panel feel like it is listening rather
  // than frozen.
  recognition.interimResults = true;
  // Continuous, and this is the whole difference between a question that gets
  // heard and one that does not. Left off, the engine treats the first pause
  // as the end of the sentence — draw breath halfway through "who is
  // available in computer engineering" and it stops at "who is available in",
  // which reads as the microphone mishearing when in fact it stopped
  // listening. Continuous keeps it open, and the silence timer below decides
  // when the question is actually finished.
  recognition.continuous = true;
  recognition.maxAlternatives = 1;

  let finished = false;
  // In continuous mode the engine hands back the sentence in pieces: settled
  // ones it will not revise, and a live tail it still might. The question is
  // the two joined, which is why neither alone is kept.
  let settled = "";
  let tail = "";
  let silenceTimer = null;

  const full = () => `${settled} ${tail}`.replace(/\s+/g, " ").trim();

  const armSilence = (ms = silenceMs) => {
    clearTimeout(silenceTimer);
    if (!silenceMs) return;
    onSilenceTick?.(true);
    silenceTimer = setTimeout(() => {
      // A gap this long means they have finished asking. Close the
      // microphone; finish() is what actually sends it.
      try { recognition.stop(); } catch { /* already stopping */ }
    }, ms);
  };

  // Longer before the first word than between words. Two seconds is a pause in
  // a sentence; it is not long enough to tap the button, collect a thought and
  // start talking, and cutting somebody off before they have said anything is
  // the rudest version of this feature.
  const START_GRACE_MS = 7000;

  /**
   * Ends the session, making sure the question actually gets asked.
   *
   * A final result is not guaranteed. iOS Safari routinely ends a session on a
   * pause without ever setting isFinal, and pressing stop does the same on
   * every engine. The caller only submits on a final result, so without this
   * the words appear in the box, the microphone closes, and nothing happens —
   * which is exactly what it looks like when you speak a question and it is
   * never sent.
   *
   * So whatever was heard is promoted to final on the way out.
   */
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(silenceTimer);
    onSilenceTick?.(false);
    // The single place a question is submitted. Whether the engine marked
    // anything final, whether they tapped send, whether two seconds of quiet
    // ran out — it all arrives here, and the whole sentence goes at once.
    if (!discarded && full()) onResult?.(full(), true);
    onEnd?.();
  };

  // Set by abort(): the difference between finishing a question and walking
  // away from one. Closing the panel must not fire off whatever was half heard
  // on the way out.
  let discarded = false;

  recognition.onresult = (event) => {
    // Only the results from this event onwards are new; earlier ones are
    // already in `settled`.
    tail = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      if (result.isFinal) settled = `${settled} ${transcript}`.trim();
      else tail = `${tail} ${transcript}`.trim();
    }
    onResult?.(full(), false);
    armSilence();
  };

  recognition.onerror = (event) => {
    // "aborted" is the reader pressing stop, and "no-speech" is them thinking
    // about it. Neither is a failure worth a red message.
    if (event.error === "aborted") return;
    const message =
      event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone permission was refused. You can still type your question."
        : event.error === "no-speech"
        ? "I didn't catch anything. Try again, or type it instead."
        : event.error === "audio-capture"
        ? "No microphone found. Type your question instead."
        : event.error === "network"
        ? "Speech needs a connection, and there isn't one. Type your question instead."
        : "The microphone stopped working. Type your question instead.";
    onError?.(message);
  };

  recognition.onend = finish;

  try {
    recognition.start();
    armSilence(START_GRACE_MS);
  } catch {
    // start() throws if called twice before end. Nothing useful to report.
    finish();
  }

  return {
    /** Done speaking: close the microphone and ask what was heard. */
    stop() {
      clearTimeout(silenceTimer);
      try { recognition.stop(); } catch { /* already stopped */ }
    },
    /** Changed their mind: close the microphone and throw the words away. */
    abort() {
      discarded = true;
      clearTimeout(silenceTimer);
      try { recognition.abort(); } catch { /* already stopped */ }
    },
    /** What has been heard so far, for a send button pressed mid-sentence. */
    transcript: () => full(),
  };
}

/**
 * Read an answer aloud, replacing whatever was being read.
 *
 * The rate is a little under default: Navi's answers are unfamiliar names and
 * numbers — "4-digit PIN", "Status & Schedule" — and the default pace runs
 * them together.
 */
/**
 * The voices this device can speak with.
 *
 * Voices come from the operating system, not from us, so the list is different
 * on every phone and there is no voice we can promise anybody. Chrome also
 * loads them asynchronously and returns an empty list on first call, which is
 * why callers need `onVoicesReady` rather than a single read at startup.
 *
 * English only, because every answer Navi speaks is written in English and a
 * Filipino or Japanese voice reading English aloud is worse than no voice.
 */
export function listVoices() {
  try {
    return (window.speechSynthesis?.getVoices() || [])
      .filter(v => /^en(-|$)/i.test(v.lang))
      .map(v => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang }));
  } catch {
    return [];
  }
}

/** Calls back when the voice list is populated, and on any later change. */
export function onVoicesReady(callback) {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!synth) return () => {};
  const fire = () => callback(listVoices());
  fire();
  synth.addEventListener?.("voiceschanged", fire);
  return () => synth.removeEventListener?.("voiceschanged", fire);
}

/**
 * The voice to use when nobody has chosen one.
 *
 * Ranked by how close the accent is to the people reading this: a Philippine
 * English voice first, then the other Asian-Pacific Englishes, then anything
 * English at all. Deliberately not ranked by the voice's apparent gender —
 * guessing that from a name like "Microsoft Zira" is unreliable, and Navi
 * being drawn as a woman is not a reason for the software to make assumptions
 * about a list of strings.
 */
export function defaultVoice(voices = listVoices()) {
  const byLang = pattern => voices.find(v => pattern.test(v.lang));
  return byLang(/^en-PH/i) || byLang(/^en-(AU|SG|IN|NZ)/i)
      || byLang(/^en-GB/i) || byLang(/^en-US/i) || voices[0] || null;
}

export function speak(text, { lang = "en-PH", voiceURI, onEnd } = {}) {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!synth || !text) { onEnd?.(); return; }

  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);

  // A chosen voice carries its own language; setting both and having them
  // disagree makes some engines fall back to a default nobody picked.
  const chosen = voiceURI
    ? (synth.getVoices() || []).find(v => v.voiceURI === voiceURI)
    : null;
  if (chosen) utterance.voice = chosen;
  else utterance.lang = lang;

  utterance.rate = 0.95;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  synth.speak(utterance);
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* not supported */ }
}
