import { Animated, Easing } from "react-native";

/**
 * Drives a progress-bar Animated.Value from `from` toward (but never
 * reaching) `ceiling`, using a live real-clock curve instead of a
 * fixed-duration Animated.timing.
 *
 * Both scanner heroes' original "phase 2" was `Animated.timing(..., {
 * toValue: 0.99, duration: 8000 })` — smooth for the first 8 seconds, then
 * it simply stopped moving if the real scan hadn't resolved yet. That is
 * the exact "it still stops" a user reported after the first fix: any
 * fixed duration is a deadline, and a deadline is always eventually wrong
 * for a variable network call. Driving the value off `Date.now()` instead
 * removes the deadline entirely — the curve keeps creeping, more slowly
 * over time, for as long as the real scan actually takes, and the caller
 * snaps straight to the genuine 100% the instant the real result lands.
 */
export function startAsymptoticCreep(
  anim,
  { from, ceiling = 0.99, decayMs = 3000, tickMs = 100 }
) {
  const start = Date.now();
  const span = ceiling - from;
  const intervalId = setInterval(() => {
    const elapsed = Date.now() - start;
    // 0 → 1 as elapsed grows, but mathematically never reaches 1.
    const eased = elapsed / (elapsed + decayMs);
    anim.setValue(from + span * eased);
  }, tickMs);

  return function stop() {
    clearInterval(intervalId);
  };
}

/**
 * Fills a progress bar the rest of the way to 100% once the real result has landed, from wherever
 * the bar currently is. The caller must stop its creep first: the creep keeps calling setValue on
 * the same Animated.Value, and every setValue cancels a running animation, which is how the bar
 * used to flash forward and fall back to ~60% right before it disappeared.
 *
 * The time scales with the distance left (about 0.7s from 60%, 0.25s from 95%), so a bar that is
 * nearly there does not crawl and one that is far behind does not teleport. Returns a cancel
 * function; `onDone` is not called after it.
 */
export function finishProgress(anim, onDone, { useNativeDriver = true } = {}) {
  let cancelled = false;
  anim.stopAnimation();
  // The JS-side value is current here: the creep writes it every tick, and a finished native
  // animation reports its end value. (stopAnimation's callback would ask the native module, which
  // is asynchronous and never answers in tests.)
  const current = typeof anim.__getValue === "function" ? Number(anim.__getValue()) || 0 : 0;
  const remaining = Math.min(1, Math.max(0, 1 - current));
  Animated.timing(anim, {
    toValue: 1,
    duration: Math.round(220 + remaining * 480),
    easing: Easing.out(Easing.cubic),
    useNativeDriver,
  }).start(() => {
    if (!cancelled) onDone();
  });
  return () => {
    cancelled = true;
  };
}
