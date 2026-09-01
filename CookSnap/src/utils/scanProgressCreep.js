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
