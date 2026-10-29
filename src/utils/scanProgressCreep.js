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
 * The scan bar's whole journey as ONE continuous curve, paced to how long this scan is expected to take
 * (`expectedMs`, learned per phone in scanTiming.js): it climbs steadily and reaches about 88% right when the
 * scan usually finishes, then keeps creeping toward 97% for as long as the real result takes, so the bar neither
 * runs out early and makes you wait nor claims to be done. It is a single Animated.timing, so on the native
 * driver it runs on the UI thread and does not stutter while the JS thread is busy preparing and uploading the
 * photo. (It used to be a linear run to 60% followed by a JS timer that moved the bar in 100ms steps.)
 *
 * `estimate()` says where the bar is now, from the clock and the same curve: a native animation does not
 * report its value back, and the final fill needs to start from where the bar actually is.
 */
export const SCAN_PROGRESS_AT_EXPECTED = 0.88;
export const SCAN_PROGRESS_CEILING = 0.97;

/** Bar value (0..1) `t` ms into a scan that is expected to take `expectedMs`. */
export function scanProgressAt(t, expectedMs) {
  const x = Math.max(0, t) / expectedMs;
  if (x <= 1) return SCAN_PROGRESS_AT_EXPECTED * (1 - Math.pow(1 - x, 1.5));
  return (
    SCAN_PROGRESS_AT_EXPECTED +
    (SCAN_PROGRESS_CEILING - SCAN_PROGRESS_AT_EXPECTED) * (1 - Math.exp(-(x - 1) / 0.8))
  );
}

export function startScanProgress(anim, { expectedMs = 6500, useNativeDriver = true } = {}) {
  const startedAt = Date.now();
  const span = Math.min(60000, Math.max(20000, expectedMs * 5));
  const timing = Animated.timing(anim, {
    toValue: SCAN_PROGRESS_CEILING,
    duration: span,
    easing: (u) => scanProgressAt(u * span, expectedMs) / SCAN_PROGRESS_CEILING,
    useNativeDriver,
  });
  timing.start();
  return {
    stop: () => timing.stop(),
    estimate: () => scanProgressAt(Math.min(span, Date.now() - startedAt), expectedMs),
  };
}

/**
 * Fills a progress bar the rest of the way to 100% once the real result has landed, from wherever
 * the bar currently is (`from`, e.g. startScanProgress's estimate; otherwise the JS-side value). The caller must
 * stop its own driver first: anything that keeps calling setValue on the same Animated.Value cancels the fill,
 * which is how the bar used to flash forward and fall back to ~60% right before it disappeared.
 *
 * The time scales with the distance left (about 0.9s from 60%, 0.6s from 90%) and eases in and out, so the end
 * reads as a deliberate finish instead of a sudden dash. Returns a cancel function; `onDone` is not called after it.
 */
export function finishProgress(anim, onDone, { useNativeDriver = true, from } = {}) {
  let cancelled = false;
  anim.stopAnimation();
  if (typeof from === "number") anim.setValue(from);
  // The JS-side value is current when `from` is not given: the creep writes it every tick and a finished native
  // animation reports its end value. (stopAnimation's callback would ask the native module, which is
  // asynchronous and never answers in tests.)
  const current =
    typeof from === "number"
      ? from
      : typeof anim.__getValue === "function"
        ? Number(anim.__getValue()) || 0
        : 0;
  const remaining = Math.min(1, Math.max(0, 1 - current));
  Animated.timing(anim, {
    toValue: 1,
    duration: Math.round(500 + remaining * 1000),
    easing: Easing.inOut(Easing.quad),
    useNativeDriver,
  }).start(() => {
    if (!cancelled) onDone();
  });
  return () => {
    cancelled = true;
  };
}
