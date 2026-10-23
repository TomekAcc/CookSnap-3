import { useEffect, useRef, useState } from "react";
import * as storage from "../storage/storage";
import { log } from "../utils/log";

/**
 * useState that survives app restarts.
 *
 *   const [servings, setServings, hydrated] = usePersistedState(STORAGE_KEYS.servings, {
 *     initial: 2,
 *     codec: positiveIntCodec,
 *   });
 *
 * - Reads the stored value once on mount (see storage.getItem for how reads
 *   are batched) and applies it if the codec accepts it. A missing or invalid
 *   value leaves `initial` — or, if given, `fallback()`, e.g. the device
 *   language on first launch.
 * - `hydrated` flips true once that read has finished (or failed). Writes are
 *   held back until then, so the default can never overwrite saved data that
 *   simply hasn't been read yet.
 * - After that, every change is written back. `codec.serialize` returning
 *   null deletes the key.
 * - `shouldPersist` (optional) is asked right before each write; return false
 *   to keep a value in memory only (the onboarding sample scan uses this).
 * - Storage errors are logged, never thrown into the UI.
 *
 * Options: { initial, codec, fallback, shouldPersist }. `initial` may be a
 * function (lazy initial state, as with useState).
 */
export function usePersistedState(key, { initial, codec, fallback, shouldPersist }) {
  const [value, setValue] = useState(initial);
  const [hydrated, setHydrated] = useState(false);

  // Latest options, so the effects below don't need them as dependencies.
  const optionsRef = useRef({ codec, fallback, shouldPersist });
  optionsRef.current = { codec, fallback, shouldPersist };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await storage.getItem(key);
        if (cancelled) return;
        const { codec: c, fallback: f } = optionsRef.current;
        const parsed = raw == null ? undefined : c.parse(raw);
        if (parsed !== undefined) setValue(parsed);
        else if (f) setValue(f());
      } catch (err) {
        log.warn(`[Cook AI] ${key} hydrate failed:`, err?.message);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    const { codec: c, shouldPersist: allowed } = optionsRef.current;
    if (allowed && !allowed()) return;
    const raw = c.serialize(value);
    const write = raw == null ? storage.removeItem(key) : storage.setItem(key, raw);
    write.catch((err) => log.warn(`[Cook AI] ${key} persist failed:`, err?.message));
  }, [key, hydrated, value]);

  return [value, setValue, hydrated];
}
