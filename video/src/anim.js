import { createContext, useContext } from "react";
import { Easing, interpolate, spring, useCurrentFrame } from "remotion";
import { FPS, vo } from "./timing";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

// 0 → 1 over [at, at + dur] frames.
export const ramp = (frame, at, dur = 12, easing = Easing.bezier(0.22, 1, 0.36, 1)) =>
  interpolate(frame, [at, at + dur], [0, 1], { ...clamp, easing });

export const lerp = (t, a, b) => a + (b - a) * t;

// A springy 0 → ~1 that starts at `at`.
export const pop = (frame, at, config = {}) =>
  spring({ frame: frame - at, fps: FPS, config: { damping: 14, stiffness: 170, mass: 0.8, ...config } });

// Keyframes: range([[f0, v0], [f1, v1], ...]) interpolated and clamped.
export const keys = (frame, pairs, easing = Easing.inOut(Easing.cubic)) =>
  interpolate(frame, pairs.map((p) => p[0]), pairs.map((p) => p[1]), { ...clamp, easing });

// Scenes run in their own local time. SceneStart tells a scene's children
// where that time began, so they can ask for narration cues in local frames.
export const SceneStart = createContext(0);

export const useScene = () => {
  const frame = useCurrentFrame();
  const start = useContext(SceneStart);
  return { frame, at: (voSec) => vo(voSec) - start };
};
