import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../storage/keys";
import { log } from "./log";

// What a scan takes before this phone has taught us: measured from a data centre it is 5-6s (including the 3.2s
// the scan always shows); a phone on mobile data with a bigger photo is slower, which the history then learns.
// Deliberately on the slow side: a bar that is still short when the result lands just fills up, but a bar that
// reaches "nearly done" while the scan goes on looks stuck.
export const DEFAULT_SCAN_MS = 8000;
export const MIN_SCAN_MS = 4000;
export const MAX_SCAN_MS = 15000;
const KEEP = 6;

let cache = { fridge: [], pantry: [] };
let loaded = false;

// The 75th percentile, not the median: paced to the median, half of all scans outlast the bar's "about done"
// mark and the bar sits near the end while the scan carries on (reported on a phone). Paced to the slower end,
// three scans in four finish before it gets there.
const slowEnd = (list) => {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.ceil(0.75 * (sorted.length - 1))];
};

/** Reads the saved timings once; safe to call again. Never throws. */
export async function loadScanTimings() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.scanTimings);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") {
      for (const kind of Object.keys(cache)) {
        if (Array.isArray(parsed[kind])) cache[kind] = parsed[kind].filter((n) => Number.isFinite(n)).slice(-KEEP);
      }
    }
  } catch (err) {
    log.warn("[Cook AI] scan timings could not be read:", err?.message);
  }
}

/** How long a scan of this kind takes on this phone when it is on the slow side (ms): the 75th percentile of the last few, within sane bounds. */
export function expectedScanMs(kind) {
  const list = cache[kind] || [];
  if (list.length === 0) return DEFAULT_SCAN_MS;
  return Math.min(MAX_SCAN_MS, Math.max(MIN_SCAN_MS, Math.round(slowEnd(list))));
}

/** Remembers how long a finished scan took. Ignores values that cannot be a real scan. */
export async function recordScanTiming(kind, ms) {
  if (!cache[kind] || !Number.isFinite(ms) || ms < 2500 || ms > 120000) return;
  cache[kind] = [...cache[kind], Math.round(ms)].slice(-KEEP);
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.scanTimings, JSON.stringify(cache));
  } catch (err) {
    log.warn("[Cook AI] scan timing could not be saved:", err?.message);
  }
}

/** For tests. */
export function resetScanTimingsForTests() {
  cache = { fridge: [], pantry: [] };
  loaded = false;
}
