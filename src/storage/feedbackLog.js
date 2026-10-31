import * as storage from "./storage";
import { STORAGE_KEYS } from "./keys";
import { log } from "../utils/log";

/**
 * Fire-and-forget append to the local feedback/signal log (recipe ratings,
 * flagged bad detections). Never throws into the caller — a logging
 * failure must not block the user action (favoriting, removing an
 * ingredient) that triggered it. Capped at 200 like scanHistory caps at 10,
 * just a higher ceiling since this is meant to accumulate over weeks, not
 * show the last few items in a UI.
 */
export async function appendFeedbackLog(entry) {
  try {
    const raw = await storage.getItem(STORAGE_KEYS.feedbackLog);
    const list = raw ? JSON.parse(raw) : [];
    const next = [
      { ...entry, loggedAt: new Date().toISOString() },
      ...(Array.isArray(list) ? list : []),
    ].slice(0, 200);
    await storage.setItem(STORAGE_KEYS.feedbackLog, JSON.stringify(next));
  } catch (err) {
    log.warn("[Cook AI] feedback log append failed:", err?.message);
  }
}
