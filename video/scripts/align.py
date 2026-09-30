"""Time every word of the voiceover script against the recorded narration.

Reads the script from ../voiceover-script.md and the audio from
../public/voiceover.mp3, force-aligns one against the other with pocketsphinx
(its English model ships inside the wheel, so nothing is downloaded), and
writes ../src/data/captions.json: every displayed word with its start and end
in seconds, grouped into caption phrases.

Re-run it whenever the narration is regenerated:

    pip install pocketsphinx imageio-ffmpeg
    python scripts/align.py
"""
import json
import re
import subprocess
from pathlib import Path

import imageio_ffmpeg
from pocketsphinx import Decoder

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "voiceover-script.md"
AUDIO = ROOT / "public" / "voiceover.mp3"
OUT = ROOT / "src" / "data" / "captions.json"

# Words the bundled dictionary doesn't know.
EXTRA_WORDS = {
    "wi": "W AY",
    "qr": "K Y UW AA R",
    "vercel": "V ER S AH L",
    "urs": "Y UW AA R EH S",
    "navi": "N AA V IY",
}

# The spoken URL is read out word by word but shown as one link.
URL_SPOKEN = "urs consultation dot vercel dot app"
URL_SHOWN = "urs-consultation.vercel.app"

MAX_PHRASE_WORDS = 7
PHRASE_GAP = 0.35  # seconds of silence that always starts a new caption


def script_text():
    md = SCRIPT.read_text()
    block = re.search(r"```\n(.*?)```", md, re.S).group(1)
    return block.replace(URL_SPOKEN, "URL_TOKEN")


def spoken(token):
    """The dictionary words a displayed token is pronounced as."""
    if token.startswith("URL_TOKEN"):
        return URL_SPOKEN.split()
    t = token.lower().replace("u-r-s", "u r s").replace("-", " ")
    t = re.sub(r"[^a-z' ]", " ", t)
    return t.split()


def shown(token):
    if token.startswith("URL_TOKEN"):
        return URL_SHOWN
    return token.replace("U-R-S", "URS")


def split_after(words, pattern):
    """Split a word list after every word whose text matches pattern."""
    groups, current = [], []
    for w in words:
        current.append(w)
        if re.search(pattern, w["text"]):
            groups.append(current)
            current = []
    return groups + [current] if current else groups


def chunk(sentence):
    """Break a sentence into captions: at long pauses, then at commas, then
    into even pieces, so no caption is left holding one stray word."""
    parts, current = [], []
    for w in sentence:
        if current and w["start"] - current[-1]["end"] > PHRASE_GAP:
            parts.append(current)
            current = []
        current.append(w)
    parts.append(current)

    out = []
    for part in parts:
        if len(part) <= MAX_PHRASE_WORDS:
            out.append(part)
            continue
        clauses = split_after(part, r",$")
        merged = [clauses[0]]
        for c in clauses[1:]:
            if len(merged[-1]) + len(c) <= MAX_PHRASE_WORDS:
                merged[-1] = merged[-1] + c
            else:
                merged.append(c)
        for m in merged:
            n = -(-len(m) // MAX_PHRASE_WORDS)
            size = -(-len(m) // n)
            out.extend(m[i:i + size] for i in range(0, len(m), size))
    return out


def align(words):
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    raw = subprocess.run(
        [ffmpeg, "-loglevel", "error", "-i", str(AUDIO),
         "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
        check=True, capture_output=True).stdout
    d = Decoder(samprate=16000, bestpath=False, loglevel="FATAL")
    for w, phones in EXTRA_WORDS.items():
        d.add_word(w, phones, True)
    d.set_align_text(" ".join(words))
    d.start_utt()
    d.process_raw(raw, full_utt=True)
    d.end_utt()
    segs = [s for s in d.seg() if s.word not in ("<s>", "</s>", "<sil>", "(NULL)")]
    if len(segs) != len(words):
        raise SystemExit(f"aligned {len(segs)} of {len(words)} words")
    return [(s.start_frame / 100, (s.end_frame + 1) / 100) for s in segs]


def main():
    tokens = script_text().split()
    spoken_words = [w for t in tokens for w in spoken(t)]
    times = align(spoken_words)

    words, i = [], 0
    for t in tokens:
        n = len(spoken(t))
        start, end = times[i][0], times[i + n - 1][1]
        i += n
        words.append({"text": shown(t), "key": " ".join(spoken(t)),
                      "start": round(start, 2), "end": round(end, 2)})

    phrases = [p for sentence in split_after(words, r"[.?!]\"?$")
               for p in chunk(sentence)]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "duration": round(times[-1][1], 2),
        "words": words,
        "phrases": [{"start": p[0]["start"], "end": p[-1]["end"],
                     "words": [{k: w[k] for k in ("text", "start", "end")} for w in p]}
                    for p in phrases],
    }, indent=1))
    print(f"{len(words)} words, {len(phrases)} phrases, "
          f"speech ends at {times[-1][1]:.2f}s -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
