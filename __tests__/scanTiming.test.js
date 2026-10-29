import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_SCAN_MS,
  expectedScanMs,
  loadScanTimings,
  recordScanTiming,
  resetScanTimingsForTests,
} from "../src/utils/scanTiming";

beforeEach(async () => {
  await AsyncStorage.clear();
  resetScanTimingsForTests();
});

describe("scan timing", () => {
  it("uses the default until this phone has taught it something", async () => {
    await loadScanTimings();
    expect(expectedScanMs("fridge")).toBe(DEFAULT_SCAN_MS);
  });

  it("learns the median of the recent scans, per kind, and keeps it across restarts", async () => {
    await loadScanTimings();
    for (const ms of [9000, 11000, 10000]) await recordScanTiming("fridge", ms);
    await recordScanTiming("pantry", 5000);
    expect(expectedScanMs("fridge")).toBe(10000);
    expect(expectedScanMs("pantry")).toBe(5000);

    resetScanTimingsForTests(); // a restart: memory gone, storage stays
    expect(expectedScanMs("fridge")).toBe(DEFAULT_SCAN_MS);
    await loadScanTimings();
    expect(expectedScanMs("fridge")).toBe(10000);
  });

  it("keeps the estimate within sane bounds and ignores values that cannot be a scan", async () => {
    await loadScanTimings();
    for (const ms of [1000, 500, 200000, NaN]) await recordScanTiming("fridge", ms);
    expect(expectedScanMs("fridge")).toBe(DEFAULT_SCAN_MS); // none of them counted
    for (const ms of [3000, 3000, 3000]) await recordScanTiming("fridge", ms);
    expect(expectedScanMs("fridge")).toBe(4000); // clamped up
    for (const ms of [60000, 60000, 60000, 60000, 60000, 60000]) await recordScanTiming("fridge", ms);
    expect(expectedScanMs("fridge")).toBe(15000); // clamped down
  });
});
