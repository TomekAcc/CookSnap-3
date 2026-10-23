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
 * A free-tier daily limit: `limit` uses per local day for free users, no limit
 * for PRO. Persisted under `storageKey`.
 *
 *   const fridge = useFreeTierCap(STORAGE_KEYS.dailyFridgeScans, 3, isPro);
 *   fridge.count      uses so far today
 *   fridge.canUse     false once a free user has hit the limit
 *   fridge.register() call right before the action: returns false (and does not
 *                     count) when the limit is reached, otherwise counts it
 *                     and returns true. Always true for PRO, and PRO uses are
 *                     not counted.
 */
export function useFreeTierCap(storageKey, limit, isPro) {
  const [state, setState] = usePersistedState(storageKey, {
    initial: emptyCounter,
    codec: counterCodec,
  });

  // register() must see the latest count even when called twice before React
  // re-renders (a double tap), so it reads this ref instead of a stale closure.
  const stateRef = useRef(state);
  stateRef.current = state;

  const register = useCallback(() => {
    if (isPro) return true;
    const today = todayKey();
    if (countFor(stateRef.current, today) >= limit) return false;
    const next = increment(stateRef.current, today);
    stateRef.current = next;
    setState(next);
    return true;
  }, [isPro, limit, setState]);

  const count = countFor(state);
  return { count, canUse: isPro || count < limit, register };
}
