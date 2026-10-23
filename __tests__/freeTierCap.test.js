import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { countFor, emptyCounter, increment, parseCounter, todayKey } from "../src/utils/dailyCounter";
import { useFreeTierCap } from "../src/hooks/useFreeTierCap";

const KEY = "cookai:test:cap";

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe("dailyCounter", () => {
  it("formats the local date as YYYY-MM-DD", () => {
    expect(todayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(todayKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("counts only uses stamped with today's date", () => {
    expect(countFor({ date: "2026-01-05", count: 3 }, "2026-01-05")).toBe(3);
    expect(countFor({ date: "2026-01-04", count: 3 }, "2026-01-05")).toBe(0);
    expect(countFor(undefined, "2026-01-05")).toBe(0);
    expect(countFor({ date: "2026-01-05", count: "many" }, "2026-01-05")).toBe(0);
  });

  it("starts the count over on a new day", () => {
    expect(increment({ date: "2026-01-04", count: 3 }, "2026-01-05")).toEqual({ date: "2026-01-05", count: 1 });
    expect(increment({ date: "2026-01-05", count: 3 }, "2026-01-05")).toEqual({ date: "2026-01-05", count: 4 });
  });

  it("parses only { date, count } objects", () => {
    expect(parseCounter({ date: "2026-01-05", count: 2 })).toEqual({ date: "2026-01-05", count: 2 });
    expect(parseCounter({ date: "2026-01-05", count: "x" })).toEqual({ date: "2026-01-05", count: 0 });
    expect(parseCounter(null)).toBeUndefined();
    expect(parseCounter({ count: 2 })).toBeUndefined();
    expect(parseCounter(7)).toBeUndefined();
  });
});

describe("useFreeTierCap", () => {
  const setup = (limit = 3, isPro = false) => renderHook((props) => useFreeTierCap(KEY, props.limit, props.isPro), { initialProps: { limit, isPro } });
  const hydrated = async () => act(async () => {});

  it("allows uses up to the limit, then refuses without counting", async () => {
    const { result } = setup(2);
    await hydrated();
    expect(result.current).toMatchObject({ count: 0, canUse: true });
    let outcomes;
    act(() => {
      outcomes = [result.current.register(), result.current.register(), result.current.register()];
    });
    expect(outcomes).toEqual([true, true, false]);
    expect(result.current).toMatchObject({ count: 2, canUse: false });
  });

  it("respects the limit when register() is called twice before React re-renders (double tap)", async () => {
    const { result } = setup(1);
    await hydrated();
    let outcomes;
    act(() => {
      outcomes = [result.current.register(), result.current.register()];
    });
    expect(outcomes).toEqual([true, false]);
  });

  it("never limits or counts PRO", async () => {
    const { result } = setup(1, true);
    await hydrated();
    act(() => {
      for (let i = 0; i < 5; i++) expect(result.current.register()).toBe(true);
    });
    expect(result.current).toMatchObject({ count: 0, canUse: true });
  });

  it("persists { date, count } and restores today's count after a restart", async () => {
    const first = setup(3);
    await hydrated();
    act(() => {
      first.result.current.register();
      first.result.current.register();
    });
    await waitFor(async () => expect(JSON.parse(await AsyncStorage.getItem(KEY))).toEqual({ date: todayKey(), count: 2 }));
    first.unmount();
    const second = setup(3);
    await waitFor(() => expect(second.result.current.count).toBe(2));
  });

  it("treats a count saved on an earlier day as zero", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ date: "2000-01-01", count: 9 }));
    const { result } = setup(3);
    await hydrated();
    expect(result.current).toMatchObject({ count: 0, canUse: true });
    await waitFor(async () => expect(JSON.parse(await AsyncStorage.getItem(KEY))).toEqual(emptyCounter()));
  });

  it("recovers from corrupt stored data", async () => {
    await AsyncStorage.setItem(KEY, "garbage");
    const { result } = setup(3);
    await hydrated();
    expect(result.current.count).toBe(0);
  });

  it("starts over when the day changes while the app stays open (previously carried over)", async () => {
    jest.useFakeTimers({ now: new Date(2026, 5, 10, 23, 58), doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
    const { result } = setup(1);
    await hydrated();
    act(() => {
      expect(result.current.register()).toBe(true);
    });
    act(() => {
      expect(result.current.register()).toBe(false); // limit hit today
    });
    jest.setSystemTime(new Date(2026, 5, 11, 0, 2)); // past midnight, app never restarted
    act(() => {
      expect(result.current.register()).toBe(true);
    });
    expect(result.current.count).toBe(1);
    expect(JSON.parse(await AsyncStorage.getItem(KEY))).toEqual({ date: "2026-06-11", count: 1 });
  });
});
