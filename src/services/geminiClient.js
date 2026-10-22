// The one place that talks to the Gemini REST API. geminiVision.js and
// geminiRecipes.js own *what* to ask (prompts, parsing, retries, safety
// filters); this file owns *how* a request is made: endpoint, auth, model
// lists, timeouts and reading the reply. It used to be copied into 8 call
// sites with slightly different timeouts, and the vision calls sent the key
// in the URL query string (which ends up in logs) while the recipe calls
// used the header.
//
// Two ways to reach Gemini:
//  - Proxy (production): EXPO_PUBLIC_GEMINI_PROXY_URL points at the Cloudflare Worker in
//    /proxy. The key lives only there; the app sends an anonymous per-install device id.
//  - Direct (local development): the key from .env goes straight to Google.
// Nothing outside this file needs to know which one is active.

import { STORAGE_KEYS } from "../storage/keys";
import { getItem, setItem } from "../storage/storage";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/** Base URL of the proxy, or "" when the app talks to Google directly. Read per call so tests can set it. */
function proxyUrl() {
  return (process.env.EXPO_PUBLIC_GEMINI_PROXY_URL || "").trim().replace(/\/+$/, "");
}

// Callers treat an empty key as "Gemini is not configured". Through the proxy there is no
// key in the app, so they get this stand-in; it is never sent anywhere.
const PROXY_PLACEHOLDER = "via-proxy";

let deviceIdPromise = null;

/** Random id created on first use and kept for the life of the install. */
export function getDeviceId() {
  if (!deviceIdPromise) {
    deviceIdPromise = (async () => {
      const saved = await getItem(STORAGE_KEYS.deviceId).catch(() => null);
      if (saved && /^[A-Za-z0-9-]{16,64}$/.test(saved)) return saved;
      const fresh = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      await setItem(STORAGE_KEYS.deviceId, fresh).catch(() => {});
      return fresh;
    })();
  }
  return deviceIdPromise;
}

/** Test hook: forget the cached id so the next call reads storage again. */
export function resetDeviceIdCache() {
  deviceIdPromise = null;
}

/**
 * Candidate models per job, best first. Keep each list short: every extra
 * entry is another full timeout window before falling through. Re-verify with
 * `node scripts/check-gemini-models.js` (it reads this file) whenever a scan
 * or generation starts failing — dead entries are pure wasted latency.
 */
export const VISION_MODELS = ["gemini-3.7-flash", "gemini-flash-lite-latest"];
export const RECIPE_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest"];
/** Single-model jobs: the recipe editor pass and one-word pantry classification. */
export const EDITOR_MODEL = "gemini-flash-latest";

// thinkingConfig is a hard HTTP 400 on models that don't support extended
// thinking (confirmed live on gemini-flash-lite-latest), so it may only be
// sent to the models listed here.
const THINKING_CAPABLE_MODELS = new Set(["gemini-3.7-flash", "gemini-flash-latest"]);

/**
 * Builds a generationConfig and, for models that support it, switches the
 * "thinking" pass off (`thinkingBudget: 0`). Left on, flash models spend
 * several unrequested seconds thinking before a plain extraction/generation.
 */
export function buildGenerationConfig(model, config = {}, thinkingBudget = 0) {
  const generationConfig = { responseMimeType: "application/json", ...config };
  if (THINKING_CAPABLE_MODELS.has(model)) {
    generationConfig.thinkingConfig = { thinkingBudget };
  }
  return generationConfig;
}

/** The configured key, with stray whitespace/quotes from .env files removed. */
export function resolveApiKey(providedApiKey = "") {
  if (proxyUrl()) return PROXY_PLACEHOLDER;
  return (
    providedApiKey ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  )
    .trim()
    .replace(/['"]/g, "");
}

function authHeaders(apiKey) {
  // Header, not `?key=` in the URL: URLs are logged by proxies and tooling.
  return { "Content-Type": "application/json", "x-goog-api-key": apiKey };
}

/** First text part of the first candidate, or "" when the reply has none. */
export function extractText(data) {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/**
 * Parses a model reply that is meant to be JSON. Models sometimes wrap it in
 * ```json fences even with responseMimeType set. Throws on invalid JSON.
 */
export function parseModelJson(text) {
  return JSON.parse(String(text).replace(/```json/gi, "").replace(/```/g, "").trim());
}

/**
 * One generateContent call against one model.
 *
 * The deadline covers the whole exchange — connecting, waiting for headers AND
 * reading the body — so a connection that stalls mid-response cannot hang the
 * caller. On deadline the underlying fetch is aborted and this throws an
 * Error named "AbortError" (callers map that to their own timeout message).
 *
 * Resolves (never throws) for HTTP-level outcomes so each caller keeps its own
 * policy for them:
 *   { ok: true,  status, data, text }       text = extractText(data)
 *   { ok: false, status, errorText }        errorText = response body, may be ""
 * Network failures and aborts reject.
 */
export async function generateContent({ apiKey, model, body, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const proxy = proxyUrl();
    const response = await fetch(`${proxy ? `${proxy}/v1beta` : GEMINI_BASE_URL}/models/${model}:generateContent`, {
      method: "POST",
      headers: proxy
        ? { "Content-Type": "application/json", "X-Device-Id": await getDeviceId() }
        : authHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return { ok: false, status: response.status, errorText };
    }
    const data = await response.json();
    return { ok: true, status: response.status, data, text: extractText(data) };
  } finally {
    clearTimeout(timer);
  }
}
