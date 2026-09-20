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
export function listen({ onResult, onError, onEnd, lang = "en-PH" } = {}) {
  if (!Recognition) {
    onError?.("This browser cannot listen. Type your question instead.");
    onEnd?.();
    return { stop() {} };
  }

  const recognition = new Recognition();
  recognition.lang = lang;
  // Interim results are what make the panel feel like it is listening rather
  // than frozen. One question at a time, so no continuous mode.
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  let finished = false;
  let heard = "";        // the best transcript so far, final or not
  let sawFinal = false;

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
    if (!discarded && !sawFinal && heard.trim()) onResult?.(heard, true);
    onEnd?.();
  };

  // Set by abort(): the difference between finishing a question and walking
  // away from one. Closing the panel must not fire off whatever was half heard
  // on the way out.
  let discarded = false;

  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    const transcript = result[0].transcript;
    // Interim transcripts can come back shorter as the engine reconsiders, and
    // the last one is not always the longest. Keep the fullest thing heard, so
    // a promoted final is not a truncated question.
    if (transcript.trim().length >= heard.trim().length) heard = transcript;
    if (result.isFinal) sawFinal = true;
    onResult?.(transcript, result.isFinal);
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
  } catch {
    // start() throws if called twice before end. Nothing useful to report.
    finish();
  }

  return {
    /** Done speaking: close the microphone and ask what was heard. */
    stop() {
      try { recognition.stop(); } catch { /* already stopped */ }
    },
    /** Changed their mind: close the microphone and throw the words away. */
    abort() {
      discarded = true;
      try { recognition.abort(); } catch { /* already stopped */ }
    },
  };
}

/**
 * Read an answer aloud, replacing whatever was being read.
 *
 * The rate is a little under default: Navi's answers are unfamiliar names and
 * numbers — "4-digit PIN", "Status & Schedule" — and the default pace runs
 * them together.
 */
export function speak(text, { lang = "en-PH", onEnd } = {}) {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!synth || !text) { onEnd?.(); return; }

  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  synth.speak(utterance);
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* not supported */ }
}
