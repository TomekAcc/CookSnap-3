import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../storage/keys";
import { log } from "./log";

// What a scan takes before this phone has taught us: measured from a data centre it is 5-6s (including the 3.2s
// the scan always shows); a phone on mobile data with a bigger photo is slower, which the history then learns.
export const DEFAULT_SCAN_MS = 6500;
export const MIN_SCAN_MS = 4000;
export const MAX_SCAN_MS = 15000;
const KEEP = 6;

let cache = { fridge: [], pantry: [] };
let loaded = false;

const median = (list) => {
  const sorted = [...list].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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

/** How long a scan of this kind usually takes on this phone (ms): the median of the last few, within sane bounds. */
export function expectedScanMs(kind) {
  const list = cache[kind] || [];
  if (list.length === 0) return DEFAULT_SCAN_MS;
  return Math.min(MAX_SCAN_MS, Math.max(MIN_SCAN_MS, Math.round(median(list))));
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
