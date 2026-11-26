import { Platform } from "react-native";
import appConfig from "../../app.json";
import { getDeviceId, proxyUrl } from "./geminiClient";

export const FEEDBACK_KINDS = ["bug", "idea", "recipe", "other"];
const TIMEOUT_MS = 12000;

/**
 * Sends one Help & Feedback message to our own server (the same one that fronts the AI), where the owner reads
 * it. Resolves when it was stored; throws when it could not be sent, so the caller can keep the text and offer
 * the email route instead. Nothing but what is listed here leaves the phone: the message, an optional reply
 * address the person typed, the recipe title when they reported a recipe, app version, platform and language.
 */
export async function sendFeedback({ id, kind, message, contact = "", recipeTitle = "", language = "" }) {
  const base = proxyUrl();
  if (!base) throw new Error("Feedback server is not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/feedback`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "X-Device-Id": await getDeviceId() },
      body: JSON.stringify({
        id,
        kind,
        message,
        contact,
        recipeTitle,
        language,
        appVersion: appConfig.expo.version,
        platform: Platform.OS,
      }),
    });
    if (!res.ok) {
      const err = new Error(`Feedback server answered ${res.status}`);
      err.status = res.status;
      throw err;
    }
  } finally {
    clearTimeout(timer);
  }
}

/** A refusal that retrying will never fix (the server says the message itself is wrong); anything else is worth another try. */
export function isPermanentFailure(err) {
  return err?.status === 400 || err?.status === 413;
}
