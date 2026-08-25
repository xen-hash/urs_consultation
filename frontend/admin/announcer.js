// Spoken announcements for new consultation requests.
//
// Kept from the original dashboard — the office screen calls students up by
// name — but the queue now respects the mute toggle and the browser's
// reduced-motion / autoplay constraints instead of speaking over itself.

const queue = [];
let busy = false;
let muted = false;
const announced = new Set();

function next() {
  if (busy || !queue.length || muted) return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  busy = true;
  const utterance = new SpeechSynthesisUtterance(queue.shift());
  utterance.lang = "en-US";
  utterance.rate = 0.95;
  const done = () => { busy = false; setTimeout(next, 400); };
  utterance.onend = done;
  utterance.onerror = done;
  synth.speak(utterance);
}

export function speak(text) {
  if (muted || !window.speechSynthesis) return;
  queue.push(text);
  next();
}

export function setMuted(value) {
  muted = value;
  if (value) {
    queue.length = 0;
    window.speechSynthesis?.cancel();
    busy = false;
  }
}

export function isMuted() { return muted; }

/** Reset on sign-in so the current backlog isn't replayed. */
export function resetAnnounced() { announced.clear(); }

function firstName(full) {
  return (full || "").replace(/^(Engr\.|Dr\.|Prof\.|AR\.|Mr\.|Ms\.|Mrs\.)\s*/i, "").split(" ")[0];
}

/** Announce requests not seen before. Returns how many were queued. */
export function announceNew(requests) {
  const fresh = requests.filter(r => r.status === "pending" && !announced.has(r.id));
  fresh.forEach(r => {
    announced.add(r.id);
    speak(`Paging ${firstName(r.professor_name)}. ${firstName(r.student_name)} is requesting a consultation.`);
  });
  return fresh.length;
}
