import { Animated } from "react-native";
import { finishProgress, startAsymptoticCreep } from "../src/utils/scanProgressCreep";

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("finishProgress", () => {
  it("takes longer from further back, and always ends at the full bar", () => {
    const spy = jest.spyOn(Animated, "timing");
    for (const [from, expected] of [[0.6, 412], [0.95, 244], [1, 220]]) {
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
