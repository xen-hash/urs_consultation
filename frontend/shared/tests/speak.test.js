import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reading an answer aloud.
 *
 * None of this can be verified by listening in CI — a headless browser has no
 * voices and synthesis fails outright. So what is pinned here is the mechanics
 * that decide whether a real device gets a chance to speak at all, each of
 * which failed silently in the version that shipped:
 *
 *   - The engine must be unlocked by a gesture, or a live answer arriving from
 *     a fetch is refused with no sound and no error.
 *   - A stored voice from another device must not leave it speaking nothing.
 *   - Cancelling when nothing is speaking drops the utterance on Chrome.
 */

class FakeUtterance {
  constructor(text) { this.text = text; FakeUtterance.made.push(this); }
}
FakeUtterance.made = [];

class FakeSynth {
  constructor(voices = []) {
    this.voices = voices;
    this.spoken = [];
    this.cancels = 0;
    this.resumes = 0;
    this.speaking = false;
    this.pending = false;
  }
  getVoices() { return this.voices; }
  speak(u) { this.spoken.push(u); }
  cancel() { this.cancels++; }
  resume() { this.resumes++; }
  addEventListener() {}
  removeEventListener() {}
}

const voice = (name, lang) => ({ name, lang, voiceURI: name });

let speech, synth;

beforeEach(async () => {
  FakeUtterance.made = [];
  synth = new FakeSynth([
    voice("Angelo", "en-PH"), voice("Daniel", "en-GB"), voice("Kyoko", "ja-JP"),
  ]);
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.resetModules();
  speech = await import("../ui/speech.js");
});

afterEach(() => vi.unstubAllGlobals());

describe("primeSpeech", () => {
  it("speaks a silent utterance so a later answer is allowed to", () => {
    speech.primeSpeech();
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0].volume).toBe(0);
  });

  it("only does it once", () => {
    speech.primeSpeech();
    speech.primeSpeech();
    speech.primeSpeech();
    expect(synth.spoken).toHaveLength(1);
  });

  it("resumes an engine left paused, which swallows utterances", () => {
    speech.primeSpeech();
    expect(synth.resumes).toBeGreaterThan(0);
  });
});

describe("speak", () => {
  it("uses the chosen voice", () => {
    speech.speak("hello", { voiceURI: "Daniel" });
    expect(synth.spoken[0].voice.name).toBe("Daniel");
  });

  it("falls back to a real voice when the stored one is gone", () => {
    // A voice chosen on another device, or since uninstalled. Setting a bare
    // language tag instead is how this went silent on engines with no en-PH.
    speech.speak("hello", { voiceURI: "NoSuchVoice" });
    expect(synth.spoken[0].voice).toBeTruthy();
    expect(synth.spoken[0].voice.name).toBe("Angelo");
    expect(synth.spoken[0].lang).toBeUndefined();
  });

  it("never picks a voice that cannot read English", () => {
    speech.speak("hello", {});
    expect(synth.spoken[0].voice.lang).toMatch(/^en/i);
  });

  it("does not cancel when nothing is speaking", () => {
    // cancel() followed immediately by speak() is a Chrome race that loses
    // the new utterance.
    speech.speak("hello", {});
    expect(synth.cancels).toBe(0);
  });

  it("does cancel when it is replacing something", () => {
    synth.speaking = true;
    speech.speak("hello", {});
    expect(synth.cancels).toBe(1);
  });

  it("reports a real failure instead of going quiet", () => {
    const onError = vi.fn();
    speech.speak("hello", { onError });
    synth.spoken[0].onerror({ error: "synthesis-failed" });
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("could not play"));
  });

  it("says nothing about being interrupted by the next answer", () => {
    const onError = vi.fn();
    const onEnd = vi.fn();
    speech.speak("hello", { onError, onEnd });
    synth.spoken[0].onerror({ error: "interrupted" });
    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalled();
  });

  it("names the permission when the device refuses outright", () => {
    const onError = vi.fn();
    speech.speak("hello", { onError });
    synth.spoken[0].onerror({ error: "not-allowed" });
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("would not let"));
  });
});
