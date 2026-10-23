// What the proxy is willing to forward. The app only ever sends these shapes (see
// src/services/geminiVision.js and geminiRecipes.js), so anything else is refused:
// the proxy URL can't be used as a general-purpose Gemini endpoint.

export const ALLOWED_MODELS = ["gemini-3.7-flash", "gemini-flash-lite-latest", "gemini-flash-latest"];
export const MAX_BODY_BYTES = 4 * 1024 * 1024; // scans send a few ~250 KB JPEGs
export const MAX_OUTPUT_TOKENS = 16384;
export const MAX_THINKING_BUDGET = 4096;
const MAX_CONTENTS = 8;
const MAX_PARTS = 16;
const MAX_IMAGES = 8;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const TOP_LEVEL = new Set(["contents", "generationConfig", "systemInstruction"]);
const GENERATION = new Set([
  "temperature",
  "topP",
  "topK",
  "responseMimeType",
  "responseSchema",
  "maxOutputTokens",
  "thinkingConfig",
]);

const DEVICE_ID = /^[A-Za-z0-9-]{16,64}$/;
const PATH = /^\/v1beta\/models\/([A-Za-z0-9.\-]+):generateContent$/;

export const isValidDeviceId = (value) => typeof value === "string" && DEVICE_ID.test(value);

/** The model named in a request path, or null when the path isn't a generateContent call. */
export function modelFromPath(pathname) {
  const match = PATH.exec(pathname);
  return match ? match[1] : null;
}

const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

function checkParts(parts, where, counters) {
  if (!Array.isArray(parts) || parts.length === 0 || parts.length > MAX_PARTS) {
    return `${where}.parts must be 1-${MAX_PARTS} items`;
  }
  for (const part of parts) {
    if (!isObject(part)) return `${where}.parts must be objects`;
    const keys = Object.keys(part);
    if (keys.length === 1 && keys[0] === "text" && typeof part.text === "string") continue;
    if (keys.length === 1 && keys[0] === "inlineData" && isObject(part.inlineData)) {
      const { mimeType, data, ...rest } = part.inlineData;
      if (Object.keys(rest).length > 0 || !IMAGE_TYPES.has(mimeType) || typeof data !== "string") {
        return `${where}: only inline JPEG/PNG/WebP images are allowed`;
      }
      if (++counters.images > MAX_IMAGES) return `too many images (max ${MAX_IMAGES})`;
      continue;
    }
    return `${where}: parts may only be text or inline images`;
  }
  return null;
}

/**
 * Validates a parsed generateContent body. Returns an error message, or null when it is fine.
 */
export function validateBody(body) {
  if (!isObject(body)) return "body must be a JSON object";
  for (const key of Object.keys(body)) {
    if (!TOP_LEVEL.has(key)) return `field not allowed: ${key}`;
  }
  const counters = { images: 0 };

  if (!Array.isArray(body.contents) || body.contents.length === 0 || body.contents.length > MAX_CONTENTS) {
    return `contents must be 1-${MAX_CONTENTS} items`;
  }
  for (const item of body.contents) {
    if (!isObject(item)) return "contents must be objects";
    const { role, parts, ...rest } = item;
    if (Object.keys(rest).length > 0) return "unexpected field in contents";
    if (role !== undefined && role !== "user" && role !== "model") return "invalid role";
    const problem = checkParts(parts, "contents", counters);
    if (problem) return problem;
  }

  if (body.systemInstruction !== undefined) {
    if (!isObject(body.systemInstruction)) return "systemInstruction must be an object";
    const { parts, ...rest } = body.systemInstruction;
    if (Object.keys(rest).length > 0) return "unexpected field in systemInstruction";
    const problem = checkParts(parts, "systemInstruction", counters);
    if (problem) return problem;
  }

  if (body.generationConfig !== undefined) {
    const config = body.generationConfig;
    if (!isObject(config)) return "generationConfig must be an object";
    for (const key of Object.keys(config)) {
      if (!GENERATION.has(key)) return `generationConfig field not allowed: ${key}`;
    }
    if (config.maxOutputTokens !== undefined && !(config.maxOutputTokens >= 1 && config.maxOutputTokens <= MAX_OUTPUT_TOKENS)) {
      return `maxOutputTokens must be 1-${MAX_OUTPUT_TOKENS}`;
    }
    if (config.thinkingConfig !== undefined) {
      const thinking = config.thinkingConfig;
      const budget = isObject(thinking) ? thinking.thinkingBudget : undefined;
      if (!isObject(thinking) || Object.keys(thinking).length !== 1 || !(budget >= 0 && budget <= MAX_THINKING_BUDGET)) {
        return `thinkingConfig must be only a thinkingBudget of 0-${MAX_THINKING_BUDGET}`;
      }
    }
  }
  return null;
}
