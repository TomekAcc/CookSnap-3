import { Animated } from "react-native";
import {
  finishProgress,
  scanProgressAt,
  startAsymptoticCreep,
  startScanProgress,
} from "../src/utils/scanProgressCreep";

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("finishProgress", () => {
  const settle = () => jest.advanceTimersByTime(130); // a native value that never answers: the fallback runs
  // Stands in for a natively driven value in jest, whose position request is never answered.
  const silent = (value) => {
    const anim = new Animated.Value(value);
    jest.spyOn(anim, "stopAnimation").mockImplementation(() => {});
    return anim;
  };

  beforeEach(() => jest.useFakeTimers());

  it("starts from the position it is given when the native value does not answer, and ends at the full bar", () => {
    const anim = silent(0); // a native animation leaves the JS value stale
    const done = jest.fn();
    finishProgress(anim, done, { useNativeDriver: false, from: 0.7, speed: 0.2 });
    settle();
    expect(anim.__getValue()).toBeCloseTo(0.7, 1);
    jest.advanceTimersByTime(3000);
    expect(done).toHaveBeenCalledTimes(1);
    expect(anim.__getValue()).toBe(1);
  });

  it("starts from the position the animation itself reports, not from the clock's guess", () => {
    const anim = new Animated.Value(0.4);
    finishProgress(anim, () => {}, { useNativeDriver: false, from: 0.9, speed: 0.2 });
    // a JS-driven value answers at once with where it really is (0.4), ignoring the 0.9 prediction
    expect(anim.__getValue()).toBeCloseTo(0.4, 5);
  });

  it("peaks at about 1.4x the bar's pace, within 0.5s to 2.2s", () => {
    const spy = jest.spyOn(Animated, "timing");
    const run = (from, speed) => {
      finishProgress(silent(from), () => {}, { useNativeDriver: false, from, speed });
      settle();
      return spy.mock.calls[spy.mock.calls.length - 1][1].duration;
    };
    expect(run(0.5, 0.25)).toBe(1429); // 0.5 left at 1.4 x 0.25/s
    expect(run(0.93, 0.03)).toBe(1667); // a creeping bar: long and gentle, not a rush
    expect(run(0.9, 1)).toBe(500); // already fast: not shorter than 0.5s
    expect(run(0.2, 0.05)).toBe(2200); // far from done and slow: capped at 2.2s
  });

  it("has a fixed pace when the bar's speed is unknown", () => {
    const spy = jest.spyOn(Animated, "timing");
    finishProgress(silent(0.6), () => {}, { useNativeDriver: false, from: 0.6 });
    settle();
    expect(spy.mock.calls[spy.mock.calls.length - 1][1].duration).toBe(900);
  });

  it("does not call back after it is cancelled", () => {
    const done = jest.fn();
    const cancel = finishProgress(silent(0.6), done, { useNativeDriver: false, from: 0.6 });
    cancel();
    jest.advanceTimersByTime(5000);
    expect(done).not.toHaveBeenCalled();
  });

  // The old bug: the creep kept ticking after completion and each tick cancelled the fill, so the bar
  // flashed forward and fell back to ~60% before the panel disappeared.
  it("fills to 100% without the creep dragging it back, once the creep is stopped", () => {
    const anim = new Animated.Value(0.6);
    const stopCreep = startAsymptoticCreep(anim, { from: 0.6, ceiling: 0.96, decayMs: 7000 });
    jest.advanceTimersByTime(1000);
    const values = [];
    anim.addListener(({ value }) => values.push(value));
    stopCreep();
    const done = jest.fn();
    finishProgress(anim, done, { useNativeDriver: false, speed: 0.1 });
    jest.advanceTimersByTime(3000);
    expect(done).toHaveBeenCalledTimes(1);
    expect(values[values.length - 1]).toBe(1);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]); // never backwards
  });
});

describe("scan progress curve", () => {
  it("starts at 0, only rises, and is at ~82% when the scan is expected to be done", () => {
    expect(scanProgressAt(0, 6500)).toBe(0);
    expect(scanProgressAt(6500, 6500)).toBeCloseTo(0.82, 5);
    let last = -1;
    for (let t = 0; t <= 60000; t += 250) {
      const v = scanProgressAt(t, 6500);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    expect(last).toBeLessThan(0.95);
    expect(last).toBeGreaterThan(0.93);
  });

  it("is paced to the expected time: a slower phone gets a slower bar", () => {
    expect(scanProgressAt(3200, 12000)).toBeLessThan(scanProgressAt(3200, 6500));
    expect(scanProgressAt(3200, 3400)).toBeGreaterThan(0.6);
  });

  it("keeps moving after the expected time instead of sitting still", () => {
    const at = (t) => scanProgressAt(t, 6500);
    expect(at(9000)).toBeGreaterThan(at(7000));
    expect(at(14000)).toBeGreaterThan(at(9000));
  });

  it("reports where the bar is, and never claims the full bar", () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    const anim = new Animated.Value(0);
    const progress = startScanProgress(anim, { expectedMs: 6500, useNativeDriver: false });
    expect(progress.estimate()).toBe(0);
    expect(progress.speed()).toBeGreaterThan(0);
    jest.setSystemTime(6500);
    expect(progress.estimate()).toBeCloseTo(0.82, 2);
    jest.setSystemTime(10 * 60 * 1000);
    expect(progress.estimate()).toBeLessThan(0.95);
    progress.stop();
  });
});
