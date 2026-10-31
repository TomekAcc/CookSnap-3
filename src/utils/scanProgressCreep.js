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
 * (`expectedMs`, learned per phone in scanTiming.js): it climbs steadily and reaches about 82% right when a slowish
 * scan finishes, then keeps creeping toward 95% for as long as the real result takes, so the bar neither
 * runs out early and makes you wait nor claims to be done. It is a single Animated.timing, so on the native
 * driver it runs on the UI thread and does not stutter while the JS thread is busy preparing and uploading the
 * photo. (It used to be a linear run to 60% followed by a JS timer that moved the bar in 100ms steps.)
 *
 * `estimate()` says where the bar is now, from the clock and the same curve: a native animation does not
 * report its value back, and the final fill needs to start from where the bar actually is.
 */
export const SCAN_PROGRESS_AT_EXPECTED = 0.82;
export const SCAN_PROGRESS_CEILING = 0.95;

/** Bar value (0..1) `t` ms into a scan that is expected to take `expectedMs`. */
export function scanProgressAt(t, expectedMs, atExpected = SCAN_PROGRESS_AT_EXPECTED, ceiling = SCAN_PROGRESS_CEILING) {
  const x = Math.max(0, t) / expectedMs;
  if (x <= 1) return atExpected * (1 - Math.pow(1 - x, 1.5));
  return atExpected + (ceiling - atExpected) * (1 - Math.exp(-(x - 1) / 0.8));
}

/**
 * `atExpected` and `ceiling` default to the real-scan values above, which leave room for a scan that runs long.
 * The scripted sample scan has a known length and needs no such room, so it passes higher ones and its bar is
 * nearly full when it ends.
 */
export function startScanProgress(
  anim,
  { expectedMs = 6500, useNativeDriver = true, atExpected = SCAN_PROGRESS_AT_EXPECTED, ceiling = SCAN_PROGRESS_CEILING } = {}
) {
  const startedAt = Date.now();
  const at = (t) => scanProgressAt(t, expectedMs, atExpected, ceiling);
  const span = Math.min(60000, Math.max(20000, expectedMs * 5));
  const timing = Animated.timing(anim, {
    toValue: ceiling,
    duration: span,
    easing: (u) => at(u * span) / ceiling,
    useNativeDriver,
  });
  timing.start();
  return {
    stop: () => timing.stop(),
    estimate: () => at(Math.min(span, Date.now() - startedAt)),
    // How fast the bar is moving right now, in bar-lengths per second.
    speed: () => {
      const t = Math.min(span, Date.now() - startedAt);
      return (at(t + 100) - at(t)) / 0.1;
    },
  };
}

/**
 * Fills a progress bar the rest of the way to 100% once the real result has landed, with no jump and no rush.
 *
 * - It starts from where the bar REALLY is. A natively driven value only knows its position natively, and on a
 *   phone whose JS thread is busy preparing the photo the native animation can start late, so the position the
 *   clock predicts (`from`) can be ahead of the bar; starting there made the bar leap forward in one frame. So the
 *   native position is asked for (stopAnimation's callback) and `from`/the JS value are only the fallback, for
 *   environments that never answer (tests) or answer too late (NATIVE_POSITION_WAIT_MS).
 * - It continues at the bar's own pace (`speed`, bar-lengths per second): the first moment of the fill moves as
 *   fast as the bar was moving, and the fill peaks at about 1.4x that, within 0.5s to 2.2s. (A bar creeping at
 *   0.03/s used to be dragged to full at 5-10 times that, and even at 2x it read as a rush.)
 *
 * The caller must stop its own driver first: anything that keeps calling setValue on the same Animated.Value
 * cancels the fill. Returns a cancel function; `onDone` is not called after it.
 */
// How long to wait for the native position before falling back to the clock's estimate. The answer has to
// cross to the UI thread and back, and it arrives just as the JS thread is busiest (parsing the result,
// rendering the list), so 120ms was often too short: the estimate then won, and when the native bar was behind it
// (it can start late while JS is busy preparing the photo) the bar visibly jumped forward.
const NATIVE_POSITION_WAIT_MS = 450;

export function finishProgress(anim, onDone, { useNativeDriver = true, from, speed } = {}) {
  let cancelled = false;
  let started = false;
  let fallbackTimer = null;

  const begin = (position) => {
    if (cancelled || started) return;
    started = true;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    const current = Math.min(1, Math.max(0, Number(position) || 0));
    anim.setValue(current);
    const remaining = 1 - current;
    let duration = 900;
    let startSlope = 0.5; // the curve's initial speed as a fraction of its average speed
    if (speed > 0) {
      duration = Math.min(2200, Math.max(500, (remaining / (1.4 * speed)) * 1000));
      const average = remaining / (duration / 1000);
      startSlope = Math.min(1, Math.max(0.2, speed / average));
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: Math.round(duration),
      // Starts at the pace the bar already had, then runs on to 100% still moving, so the card can move on at once.
      easing: Easing.bezier(0.25, 0.25 * startSlope, 0.7, 0.7),
      useNativeDriver,
    }).start(() => {
      if (!cancelled) onDone();
    });
  };

  anim.stopAnimation((value) => begin(value));
  fallbackTimer = setTimeout(() => {
    const js = typeof anim.__getValue === "function" ? Number(anim.__getValue()) || 0 : 0;
    begin(typeof from === "number" ? from : js);
  }, NATIVE_POSITION_WAIT_MS);

  return () => {
    cancelled = true;
    if (fallbackTimer) clearTimeout(fallbackTimer);
  };
}
