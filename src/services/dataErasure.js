import { Platform } from "react-native";
import { eraseAll } from "../storage/storage";
import { deleteAllPhotos } from "../utils/photoStorage";
import { resetDeviceIdCache } from "./geminiClient";
import { log } from "../utils/log";

/**
 * "Delete all my data": removes everything CookSnap keeps on this phone — saved recipes, pantry, scan history,
 * preferences, the feedback outbox, the anonymous device id and the stored scan photos. CookSnap has no accounts,
 * so this is the whole of what the app holds. Messages already sent through Help & Feedback live on the server and
 * are removed on request (see the privacy policy).
 *
 * Resolves to { ok, keys }. Never throws: a failure to remove photos does not stop the rest.
 */
export async function eraseAllLocalData() {
  let keys = 0;
  try {
    keys = await eraseAll();
  } catch (err) {
    log.warn("[CookSnap] Erasing stored data failed:", err?.message);
    return { ok: false, keys: 0 };
  }
  try {
    deleteAllPhotos();
  } catch (err) {
    log.warn("[CookSnap] Erasing scan photos failed:", err?.message);
  }
  resetDeviceIdCache();
  return { ok: true, keys };
}

/**
 * Starts the app again so every screen shows the empty state. Returns true if a restart was triggered; false means
 * the platform could not do it and the person should close and reopen the app (the data is already gone either way).
 */
export async function restartApp() {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.reload();
      return true;
    }
    const Updates = require("expo-updates");
    await Updates.reloadAsync();
    return true;
  } catch (err) {
    try {
      const { DevSettings } = require("react-native");
      if (DevSettings?.reload) {
        DevSettings.reload();
        return true;
      }
    } catch (_unused) {
      // fall through
    }
    log.warn("[CookSnap] Could not restart after erasing data:", err?.message);
    return false;
  }
}
