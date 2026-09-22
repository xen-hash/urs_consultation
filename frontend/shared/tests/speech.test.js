import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultVoice } from "../ui/speech.js";

/**
 * The dictation session, driven the way the browser drives it.
 *
 * Two behaviours are worth pinning because both produced the same complaint —
 * "it didn't hear me" — from different causes:
 *
 *   - The engine hands a continuous session back in pieces. Keeping only the
 *     last piece loses the front of the sentence; keeping only the settled
 *     pieces loses the end.
 *   - The engine is not obliged to mark anything final. The question must
 *     still be asked when it simply stops.
 */

class FakeRecognition {
  constructor() {
    FakeRecognition.last = this;
    this.started = false;
    this.aborted = false;
  }
  start() { this.started = true; }
  stop() { this.onend?.(); }
  abort() { this.aborted = true; this.onend?.(); }

  /**
   * Feed results the way the API really does: the COMPLETE results array
   * every time, with resultIndex pointing at the first entry that changed.
   * Passing only the new entries is a plausible-looking fake that tests
   * nothing, because the implementation indexes from resultIndex into the
   * whole array.
   */
  emit(index, items) {
    this.onresult?.({
      resultIndex: index,
      results: items.map(([transcript, isFinal]) =>
        Object.assign([{ transcript }], { isFinal })),
    });
  }
}

let listen;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
  vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
  // The module reads the constructor at import time.
  vi.resetModules();
  ({ listen } = await import("../ui/speech.js"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("listen", () => {
  it("keeps the whole sentence across settled pieces and a live tail", () => {
    const results = [];
    listen({ onResult: (t, f) => results.push([t, f]) });
    const r = FakeRecognition.last;

    r.emit(0, [["who is available", true]]);
    r.emit(1, [["who is available", true], ["in computer", false]]);
    r.emit(1, [["who is available", true], ["in computer engineering", false]]);

    // The latest reading is the settled part plus the current tail.
    expect(results.at(-1)[0]).toBe("who is available in computer engineering");
  });

  it("asks the question after the silence, without a final result", () => {
    const sent = [];
    listen({ onResult: (t, f) => { if (f) sent.push(t); }, silenceMs: 2000 });
    const r = FakeRecognition.last;

    r.emit(0, [["who is free right now", false]]);
    expect(sent).toEqual([]);          // still talking

    vi.advanceTimersByTime(2000);
    // Nothing was ever marked final, and it still got asked.
    expect(sent).toEqual(["who is free right now"]);
  });

  it("does not cut in while somebody is still speaking", () => {
    const sent = [];
    listen({ onResult: (t, f) => { if (f) sent.push(t); }, silenceMs: 2000 });
    const r = FakeRecognition.last;

    r.emit(0, [["who is", false]]);
    vi.advanceTimersByTime(1500);
    r.emit(0, [["who is available in", false]]);   // kept talking
    vi.advanceTimersByTime(1500);
    expect(sent).toEqual([]);                      // timer restarted, correctly

    r.emit(0, [["who is available in civil", false]]);
    vi.advanceTimersByTime(2000);
    expect(sent).toEqual(["who is available in civil"]);
  });

  it("allows longer to start speaking than to pause mid-sentence", () => {
    const ended = vi.fn();
    listen({ onResult: () => {}, onEnd: ended, silenceMs: 2000 });

    // Two seconds is a pause in a sentence, not time to collect a thought.
    vi.advanceTimersByTime(2500);
    expect(ended).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5000);
    expect(ended).toHaveBeenCalled();
  });

  it("sends what was heard when stopped by hand", () => {
    const sent = [];
    const session = listen({ onResult: (t, f) => { if (f) sent.push(t); } });
    FakeRecognition.last.emit(0, [["is santos free", false]]);

    session.stop();
    expect(sent).toEqual(["is santos free"]);
  });

  it("throws the words away when aborted", () => {
    const sent = [];
    const session = listen({ onResult: (t, f) => { if (f) sent.push(t); } });
    FakeRecognition.last.emit(0, [["is santos free", false]]);

    // Closing the panel must not fire off a half-finished question.
    session.abort();
    expect(sent).toEqual([]);
  });

  it("asks nothing when nothing was said", () => {
    const sent = [];
    const session = listen({ onResult: (t, f) => { if (f) sent.push(t); } });
    session.stop();
    expect(sent).toEqual([]);
  });
});

describe("defaultVoice", () => {
  const v = (lang, name = lang) => ({ voiceURI: name, name, lang });

  it("prefers the closest accent to the people reading this", () => {
    expect(defaultVoice([v("en-US"), v("en-PH"), v("en-GB")]).lang).toBe("en-PH");
    expect(defaultVoice([v("en-US"), v("en-AU")]).lang).toBe("en-AU");
    expect(defaultVoice([v("en-US"), v("en-GB")]).lang).toBe("en-GB");
  });

  it("takes whatever there is rather than nothing", () => {
    expect(defaultVoice([v("en-ZA")]).lang).toBe("en-ZA");
    expect(defaultVoice([])).toBeNull();
  });
});
