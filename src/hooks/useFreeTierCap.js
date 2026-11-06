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

// A running total since install (the free sample), as a plain non-negative whole number.
const totalCodec = jsonCodec(
  (value) => Number.isFinite(Number(value)) && Number(value) >= 0,
  (value) => Math.floor(Number(value))
);

/**
 * A usage limit. PRO gets `proLimit` uses per local day (a generous "fair use" number: every AI call costs real
 * money, so PRO is generous, not unlimited). Free users get `freeLimit`, counted either per day (default) or, when
 * `lifetimeKey` is given, as a one-time sample since install that never refills. Without a `proLimit`, PRO has no
 * limit and its uses are not counted. Persisted under `storageKey` (daily) and `lifetimeKey` (sample).
 *
 *   const fridge = useFreeTierCap(STORAGE_KEYS.dailyFridgeScans, 3, isPro, 10, STORAGE_KEYS.freeSampleFridgeScans);
 *   fridge.count      uses so far (today for PRO, since install for the free sample)
 *   fridge.limit      the limit that applies to this person right now
 *   fridge.canUse     false once the limit has been hit
 *   fridge.register() call right before the action: returns false (and does not
 *                     count) when the limit is reached, otherwise counts it
 *                     and returns true.
 */
export function useFreeTierCap(storageKey, freeLimit, isPro, proLimit, lifetimeKey) {
  const unlimited = isPro && proLimit == null;
  const limit = isPro && proLimit != null ? proLimit : freeLimit;
  const useLifetime = !isPro && !!lifetimeKey;
  const [state, setState] = usePersistedState(storageKey, {
    initial: emptyCounter,
    codec: counterCodec,
  });
  const [total, setTotal] = usePersistedState(lifetimeKey || `${storageKey}:unused`, {
    initial: 0,
    codec: totalCodec,
    shouldPersist: () => !!lifetimeKey,
  });

  // register() must see the latest count even when called twice before React
  // re-renders (a double tap), so it reads these refs instead of a stale closure.
  const stateRef = useRef(state);
  stateRef.current = state;
  const totalRef = useRef(total);
  totalRef.current = total;

  const register = useCallback(() => {
    if (unlimited) return true;
    if (useLifetime) {
      if (totalRef.current >= limit) return false;
      const next = totalRef.current + 1;
      totalRef.current = next;
      setTotal(next);
      return true;
    }
    const today = todayKey();
    if (countFor(stateRef.current, today) >= limit) return false;
    const next = increment(stateRef.current, today);
    stateRef.current = next;
    setState(next);
    return true;
  }, [unlimited, useLifetime, limit, setState, setTotal]);

  // Gives back one use that register() counted, for an action that then failed through no fault of the person
  // (no network, a server error): a failed scan must not eat one of the three free sample uses.
  const refund = useCallback(() => {
    if (unlimited) return;
    if (useLifetime) {
      if (totalRef.current <= 0) return;
      const next = totalRef.current - 1;
      totalRef.current = next;
      setTotal(next);
      return;
    }
    const today = todayKey();
    const current = countFor(stateRef.current, today);
    if (current <= 0) return;
    const next = { date: today, count: current - 1 };
    stateRef.current = next;
    setState(next);
  }, [unlimited, useLifetime, setState, setTotal]);

  const count = useLifetime ? total : countFor(state);
  return { count, limit: unlimited ? Infinity : limit, canUse: unlimited || count < limit, register, refund, isSample: useLifetime };
}
