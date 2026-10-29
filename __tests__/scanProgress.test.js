import { Animated } from "react-native";
import {
  finishProgress,
  scanProgressCurve,
  startAsymptoticCreep,
  startScanProgress,
} from "../src/utils/scanProgressCreep";

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("finishProgress", () => {
  it("takes longer from further back, and always ends at the full bar", () => {
    const spy = jest.spyOn(Animated, "timing");
    for (const [from, expected] of [[0.6, 900], [0.95, 550], [1, 500]]) {
      const anim = new Animated.Value(from);
      finishProgress(anim, () => {});
      const config = spy.mock.calls[spy.mock.calls.length - 1][1];
      expect(config.toValue).toBe(1);
      expect(config.duration).toBe(expected);
    }
  });

  it("does not call back after it is cancelled", () => {
    const done = jest.fn();
    const anim = new Animated.Value(0.6);
    const cancel = finishProgress(anim, done);
    cancel();
    expect(done).not.toHaveBeenCalled();
  });

  // The old bug: the creep kept ticking after completion and each tick cancelled the fill, so the bar
  // flashed forward and fell back to ~60% before the panel disappeared.
  it("fills to 100% without the creep dragging it back, once the creep is stopped", () => {
    jest.useFakeTimers();
    const anim = new Animated.Value(0.6);
    const stopCreep = startAsymptoticCreep(anim, { from: 0.6, ceiling: 0.96, decayMs: 7000 });
    jest.advanceTimersByTime(1000);
    const values = [];
    anim.addListener(({ value }) => values.push(value));
    stopCreep();
    const done = jest.fn();
    finishProgress(anim, done, { useNativeDriver: false });
    jest.advanceTimersByTime(1500);
    expect(done).toHaveBeenCalledTimes(1);
    expect(values[values.length - 1]).toBe(1);
    // never moves backwards on its way up
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
  });
});

describe("scan progress curve", () => {
  it("starts at 0, only rises, and is about half way when the scan's fixed 3.2s are up", () => {
    expect(scanProgressCurve(0)).toBe(0);
    expect(scanProgressCurve(1)).toBeCloseTo(1, 5);
    let last = -1;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const v = scanProgressCurve(Math.min(1, t));
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    expect(0.92 * scanProgressCurve(3200 / 30000)).toBeGreaterThan(0.45);
    expect(0.92 * scanProgressCurve(3200 / 30000)).toBeLessThan(0.6);
    expect(0.92 * scanProgressCurve(8000 / 30000)).toBeGreaterThan(0.7);
  });

  it("reports where the bar is, and never claims the full bar", () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    const anim = new Animated.Value(0);
    const progress = startScanProgress(anim, { useNativeDriver: false });
    expect(progress.estimate()).toBe(0);
    jest.setSystemTime(3200);
    const early = progress.estimate();
    expect(early).toBeGreaterThan(0.45);
    jest.setSystemTime(10 * 60 * 1000);
    expect(progress.estimate()).toBeLessThanOrEqual(0.92);
    progress.stop();
  });

  it("finishProgress starts from the given position, not from the stale JS value", () => {
    jest.useFakeTimers();
    const anim = new Animated.Value(0); // a native animation leaves this stale
    const done = jest.fn();
    finishProgress(anim, done, { useNativeDriver: false, from: 0.7 });
    expect(anim.__getValue()).toBeCloseTo(0.7, 5);
    jest.advanceTimersByTime(2000);
    expect(done).toHaveBeenCalledTimes(1);
    expect(anim.__getValue()).toBe(1);
  });
});
