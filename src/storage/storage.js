import AsyncStorage from "@react-native-async-storage/async-storage";

// Thin wrapper over AsyncStorage with one addition: reads requested in the
// same tick are sent to the native side as ONE multiGet.
//
// At startup every persisted value (about 20) asks for its stored copy during
// the same commit. Separate getItem calls meant ~20 native round trips, and
// the answers arrived one by one — so related values (a fridge photo and the
// ingredients it produced) could appear a frame apart. Batched, there is one
// round trip and every hook hydrates in the same render.

/** @type {Map<string, Array<{resolve: Function, reject: Function}>>} */
let queue = new Map();
let flushScheduled = false;

async function flush() {
  const batch = queue;
  queue = new Map();
  flushScheduled = false;
  try {
    const pairs = await AsyncStorage.multiGet([...batch.keys()]);
    const values = new Map(pairs);
    for (const [key, waiters] of batch) {
      const value = values.get(key) ?? null;
      waiters.forEach((w) => w.resolve(value));
    }
  } catch (err) {
    for (const waiters of batch.values()) waiters.forEach((w) => w.reject(err));
  }
}

/** Resolves to the stored string, or null when the key is not set. */
export function getItem(key) {
  return new Promise((resolve, reject) => {
    const waiters = queue.get(key);
    if (waiters) waiters.push({ resolve, reject });
    else queue.set(key, [{ resolve, reject }]);
    if (!flushScheduled) {
      flushScheduled = true;
      Promise.resolve().then(flush);
    }
  });
}

// Set by eraseAll(). Until the app is restarted, screens still hold the old values in memory; without this, any
// change made in that window would write them straight back and undo the erasure.
let erased = false;

export function setItem(key, value) {
  if (erased) return Promise.resolve();
  return AsyncStorage.setItem(key, value);
}

export function removeItem(key) {
  return AsyncStorage.removeItem(key);
}

const KEY_PREFIX = "cooksnap:";

/**
 * Removes everything this app has stored (every "cooksnap:" key) and blocks further writes until the next launch.
 * Returns how many keys were removed.
 */
export async function eraseAll() {
  erased = true;
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(KEY_PREFIX));
  if (keys.length) await AsyncStorage.multiRemove(keys);
  return keys.length;
}

/** Test hook: allow writes again. */
export function resetErasedFlag() {
  erased = false;
}
