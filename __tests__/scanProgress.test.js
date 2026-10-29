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
  it("has a fixed fallback pace when the bar's speed is unknown, and always ends at the full bar", () => {
    const spy = jest.spyOn(Animated, "timing");
    for (const [from, expected] of [[0.6, 700], [0.95, 700], [1, 700]]) {
      const anim = new Animated.Value(from);
      finishProgress(anim, () => {});
      const config = spy.mock.calls[spy.mock.calls.length - 1][1];
      expect(config.toValue).toBe(1);
      expect(config.duration).toBe(expected);
    }
  });

  it("fills at most twice as fast as the bar was moving, within 0.45s to 1.1s", () => {
    const spy = jest.spyOn(Animated, "timing");
    const run = (from, speed) => {
      finishProgress(new Animated.Value(from), () => {}, { from, speed });
      return spy.mock.calls[spy.mock.calls.length - 1][1].duration;
    };
    expect(run(0.5, 0.25)).toBe(1000); // 0.5 left at twice 0.25/s
    expect(run(0.93, 0.03)).toBe(1100); // a creeping bar: capped, not dragged to full in a rush
    expect(run(0.9, 1)).toBe(450); // already fast: not slower than 0.45s
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
  it("starts at 0, only rises, and is at ~88% when the scan is expected to be done", () => {
    expect(scanProgressAt(0, 6500)).toBe(0);
    expect(scanProgressAt(6500, 6500)).toBeCloseTo(0.88, 5);
    let last = -1;
    for (let t = 0; t <= 60000; t += 250) {
      const v = scanProgressAt(t, 6500);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    expect(last).toBeLessThan(0.97);
    expect(last).toBeGreaterThan(0.95);
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
    expect(progress.estimate()).toBeCloseTo(0.88, 2);
    jest.setSystemTime(10 * 60 * 1000);
    expect(progress.estimate()).toBeLessThan(0.97);
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
