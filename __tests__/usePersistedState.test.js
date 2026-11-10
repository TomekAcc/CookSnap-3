import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { usePersistedState } from "../src/hooks/usePersistedState";
import { arrayCodec, enumCodec, flagCodec, positiveIntCodec } from "../src/storage/codecs";

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  // The error-path tests below make the hook log a warning on purpose.
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  console.warn.mockRestore();
});

const hydrate = (result) => waitFor(() => expect(result.current[2]).toBe(true));

describe("usePersistedState", () => {
  it("starts with the initial value, then applies the stored one", async () => {
    await AsyncStorage.setItem("k", "5");
    const { result } = renderHook(() => usePersistedState("k", { initial: 2, codec: positiveIntCodec }));
    expect(result.current[0]).toBe(2);
    expect(result.current[2]).toBe(false);
    await hydrate(result);
    expect(result.current[0]).toBe(5);
  });

  it("keeps the initial value when nothing is stored or the stored value is invalid", async () => {
    await AsyncStorage.setItem("bad", "abc");
    const missing = renderHook(() => usePersistedState("missing", { initial: 2, codec: positiveIntCodec }));
    const invalid = renderHook(() => usePersistedState("bad", { initial: 2, codec: positiveIntCodec }));
    await hydrate(missing.result);
    await hydrate(invalid.result);
    expect(missing.result.current[0]).toBe(2);
    expect(invalid.result.current[0]).toBe(2);
  });

  it("uses fallback() when nothing valid is stored (device-derived defaults)", async () => {
    const { result } = renderHook(() =>
      usePersistedState("unit", { initial: "us", codec: enumCodec("us", "metric"), fallback: () => "metric" })
    );
    await hydrate(result);
    expect(result.current[0]).toBe("metric");
    // ...and, like before, the detected default is saved so it sticks.
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith("unit", "metric"));
  });

  it("never writes the default over saved data before the read has finished", async () => {
    await AsyncStorage.setItem("list", JSON.stringify(["saved"]));
    jest.clearAllMocks();
    const { result } = renderHook(() => usePersistedState("list", { initial: ["default"], codec: arrayCodec }));
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    await hydrate(result);
    for (const [, written] of AsyncStorage.setItem.mock.calls) {
      expect(JSON.parse(written)).toEqual(["saved"]);
    }
    expect(await AsyncStorage.getItem("list")).toBe(JSON.stringify(["saved"]));
  });

  it("writes every change after hydration", async () => {
    const { result } = renderHook(() => usePersistedState("n", { initial: 1, codec: positiveIntCodec }));
    await hydrate(result);
    act(() => result.current[1](7));
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenLastCalledWith("n", "7"));
    act(() => result.current[1]((prev) => prev + 1));
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenLastCalledWith("n", "8"));
  });

  it("deletes the key when serialize returns null", async () => {
    await AsyncStorage.setItem("flag", "true");
    const { result } = renderHook(() => usePersistedState("flag", { initial: false, codec: flagCodec }));
    await hydrate(result);
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    await waitFor(() => expect(AsyncStorage.removeItem).toHaveBeenCalledWith("flag"));
    expect(await AsyncStorage.getItem("flag")).toBeNull();
  });

  it("skips writes while shouldPersist() is false", async () => {
    let allowed = false;
    const { result } = renderHook(() =>
      usePersistedState("demo", { initial: "a", codec: { parse: (r) => r, serialize: (v) => v }, shouldPersist: () => allowed })
    );
    await hydrate(result);
    act(() => result.current[1]("sample"));
    await act(async () => {});
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    allowed = true;
    act(() => result.current[1]("real"));
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith("demo", "real"));
  });

  it("still becomes hydrated, with the default, when storage fails to read", async () => {
    AsyncStorage.multiGet.mockRejectedValueOnce(new Error("disk"));
    const { result } = renderHook(() => usePersistedState("k", { initial: 3, codec: positiveIntCodec }));
    await hydrate(result);
    expect(result.current[0]).toBe(3);
  });

  it("does not throw into the UI when a write fails", async () => {
    const { result } = renderHook(() => usePersistedState("k", { initial: 1, codec: positiveIntCodec }));
    await hydrate(result);
    AsyncStorage.setItem.mockRejectedValueOnce(new Error("full"));
    act(() => result.current[1](9));
    await act(async () => {});
    expect(result.current[0]).toBe(9);
  });

  it("hydrates every hook mounted together with a single native read", async () => {
    await AsyncStorage.setItem("photo", JSON.stringify("file://a.jpg"));
    await AsyncStorage.setItem("items", JSON.stringify(["egg"]));
    jest.clearAllMocks();
    const { result } = renderHook(() => ({
      photo: usePersistedState("photo", { initial: null, codec: { parse: (r) => JSON.parse(r), serialize: JSON.stringify } }),
      items: usePersistedState("items", { initial: [], codec: arrayCodec }),
    }));
    await waitFor(() => expect(result.current.photo[2] && result.current.items[2]).toBe(true));
    expect(result.current.photo[0]).toBe("file://a.jpg");
    expect(result.current.items[0]).toEqual(["egg"]);
    expect(AsyncStorage.multiGet).toHaveBeenCalledTimes(1);
  });

  it("ignores a read that finishes after unmount", async () => {
    await AsyncStorage.setItem("k", "5");
    const { result, unmount } = renderHook(() => usePersistedState("k", { initial: 2, codec: positiveIntCodec }));
    unmount();
    await act(async () => {});
    expect(result.current[0]).toBe(2);
  });
});
