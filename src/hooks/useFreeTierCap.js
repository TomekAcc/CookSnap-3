import { useCallback, useRef } from "react";
import { usePersistedState } from "./usePersistedState";
import { jsonCodec } from "../storage/codecs";
import { countFor, emptyCounter, increment, parseCounter, todayKey } from "../utils/dailyCounter";

// A saved count from an earlier day loads as a fresh zero for today.
const counterCodec = jsonCodec(
  (value) => parseCounter(value) !== undefined,
  (value) => {
    const saved = parseCounter(value);
    return saved.date === todayKey() ? saved : emptyCounter();
  }
);

/**
 * A daily limit: `freeLimit` uses per local day for free users and `proLimit` for PRO (a larger "fair use" number —
 * every AI call costs real money, so PRO is generous, not unlimited). Without a `proLimit`, PRO has no limit and its
 * uses are not counted. Persisted under `storageKey`.
 *
 *   const fridge = useFreeTierCap(STORAGE_KEYS.dailyFridgeScans, 2, isPro, 10);
 *   fridge.count      uses so far today
 *   fridge.limit      today's limit for this person (free or PRO)
 *   fridge.canUse     false once the limit has been hit
 *   fridge.register() call right before the action: returns false (and does not
 *                     count) when the limit is reached, otherwise counts it
 *                     and returns true.
 */
export function useFreeTierCap(storageKey, freeLimit, isPro, proLimit) {
  const unlimited = isPro && proLimit == null;
  const limit = isPro && proLimit != null ? proLimit : freeLimit;
  const [state, setState] = usePersistedState(storageKey, {
    initial: emptyCounter,
    codec: counterCodec,
  });

  // register() must see the latest count even when called twice before React
  // re-renders (a double tap), so it reads this ref instead of a stale closure.
  const stateRef = useRef(state);
  stateRef.current = state;

  const register = useCallback(() => {
    if (unlimited) return true;
    const today = todayKey();
    if (countFor(stateRef.current, today) >= limit) return false;
    const next = increment(stateRef.current, today);
    stateRef.current = next;
    setState(next);
    return true;
  }, [unlimited, limit, setState]);

  const count = countFor(state);
  return { count, limit: unlimited ? Infinity : limit, canUse: unlimited || count < limit, register };
}
