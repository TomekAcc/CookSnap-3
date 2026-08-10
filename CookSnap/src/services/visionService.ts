import { Alert } from "react-native";
import { Ingredient, IngredientCategory, ScanMode } from "@/types";

/**
 * The Scanner Engine's AI backend. Every call goes to the real Gemini Vision
 * API — there is no mock/demo/hardcoded ingredient fallback of any kind. If
 * EXPO_PUBLIC_GEMINI_API_KEY isn't configured, this throws immediately rather
 * than substituting fake data, so a misconfigured key fails loudly (an empty
 * scan result) instead of silently returning items that were never actually
 * in the photo.
 */

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
// gemini-1.5-flash has been retired (confirmed via a live 404 from the API
// itself, and absent from a ListModels query against this exact key).
// gemini-2.0-flash is confirmed available (it 429'd on quota, not 404 —
// meaning the model itself is valid) but rate-limited on the free tier.
// gemini-2.0-flash-lite is Google's lighter variant of the same generation,
// built for higher free-tier throughput — override via EXPO_PUBLIC_GEMINI_MODEL
// if you move to a paid tier and want the full model back.
const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL ?? "gemini-2.0-flash-lite";

// Automatic fallback chain if the configured model 404s. Google retires
// model names over time (gemini-1.5-flash did, mid-project) — a 404 means
// "this model no longer exists," not a payload/auth/version problem, so
// blindly retrying the same model or switching API versions (v1beta vs v1)
// would never help. These fallbacks are models CONFIRMED to exist for this
// project via a live ListModels query, not guesses.
const MODEL_FALLBACK_CHAIN = Array.from(
  new Set([GEMINI_MODEL, "gemini-2.0-flash-lite", "gemini-2.0-flash"])
);

function endpointFor(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

interface DetectedItem {
  name: string;
  category: IngredientCategory;
  confidence: number;
}

const CONFIDENCE_THRESHOLD = 60;

/**
 * "Culinary Vision Auditor" — performs a deterministic zone-by-zone scan
 * rather than a loose left-to-right pass, so results are consistent between
 * scans of the same fridge/pantry. Zero-hallucination: anything ambiguous is
 * discarded rather than guessed, but labels/packaging may be used to deduce
 * a product's identity rather than throwing it away.
 *
 * IMPORTANT: confidence reflects certainty in the FINAL identification, not
 * the method used to reach it. A branded product confidently recognized by
 * its packaging (e.g., a distinctive tub or carton) should score just as
 * high as one with a fully legible label — only genuinely ambiguous or
 * illegible items should score low. Confusing "used deduction" with "low
 * confidence" was actively causing real items to be filtered out below.
 *
 * Note: we ask for "category" + "confidence" rather than an AI-supplied
 * "icon" — icons are resolved locally and deterministically from name+category
 * via getIngredientEmoji (src/utils/ingredientEmoji.ts), which is faster and
 * far more visually consistent than trusting the model to invent one per
 * item. category also drives the Pantry screen's grouping, and confidence
 * feeds the threshold filter below (60 — high enough to reject wild guesses,
 * low enough not to discard legitimate brand/packaging-based identification).
 */
const BASE_AUDITOR_PROMPT = `You are a world-class culinary AI auditor conducting a deterministic, shelf-by-shelf inspection of a domestic fridge or pantry photo.

Rules:
- Identify ALL visible items. Do not truncate the list.
- Products are often only identifiable by brand packaging rather than a plain-text description.
  If an item has a recognizable label or logo (e.g., "TaoTao", "Piątnica", "Łaciate", "Alpro"),
  deduce the generic product name from it (e.g., TaoTao → Soy Sauce, Piątnica → Cottage Cheese,
  Łaciate → Milk, Alpro → Plant Milk). This is a confident identification, not a guess — score it
  accordingly high.
- Only DISCARD an item if it is genuinely too blurry, obstructed, or generic to identify at all.
- Never invent items that are not visibly present (e.g., no "Chicken Breast" unless actually visible).
- Ignore shelves, drawers, plastic walls, cutlery, appliances, and any other non-food objects.
- If the photo is NOT a fridge/pantry, or contains no clearly identifiable food at all, return
  an empty items array. An empty result is correct and expected in that case — do not invent
  items just to have something to report.
- For every item, include a "confidence" score from 0-100 reflecting how sure you are of the
  final identification — not whether you used a label or packaging cues to get there.

Respond with strict JSON only, no markdown: {"items":[{"name":"...", "category":"produce|dairy|protein|grain|condiment|spice|other", "confidence": 0-100}]}`;

const MODE_FOCUS: Record<ScanMode, string> = {
  fridge:
    "This photo is of a REFRIGERATOR. Perform a 5-Zone Scan across whatever zones are visible " +
    "in this shot:\n" +
    "ZONE 1 (TOP): Glass jars, cartons, yogurt tubs (e.g., Piątnica), leftovers in containers.\n" +
    "ZONE 2 (MIDDLE): Jars of pesto, mayonnaise, mustard, jams, dressings.\n" +
    "ZONE 3 (BOTTOM SHELVES/DRAWERS): Eggs, melons, produce, leafy greens, apples, peppers.\n" +
    "ZONE 4 (DOOR TOP): Sauces, condiments.\n" +
    "ZONE 5 (DOOR BOTTOM): Milk cartons (e.g., Łaciate), plant milks (e.g., Alpro), oils.",
  pantry:
    "This photo is of a PANTRY or SPICE RACK. Perform a 5-Zone Scan across whatever zones are " +
    "visible in this shot:\n" +
    "ZONE 1 — Top Shelf: bulk grains, cereals, bread.\n" +
    "ZONE 2 — Middle Shelf: canned goods, jars, sauces.\n" +
    "ZONE 3 — Spice Rack: spices and small seasoning jars.\n" +
    "ZONE 4 — Lower Shelf: oils, vinegars, condiments.\n" +
    "ZONE 5 — Floor/Bottom Storage: bulk bags and large containers.",
};

function buildPrompt(mode: ScanMode): string {
  return `${BASE_AUDITOR_PROMPT}\n\n${MODE_FOCUS[mode]}`;
}

const REFINED_SCAN_SUFFIX =
  "\n\nA first pass over this photo found very few items — that usually means regions were " +
  "skimmed rather than inspected individually. Look again, one region at a time: every top " +
  "shelf item, every middle shelf item, every door shelf/bin item, and the crisper drawer " +
  "contents, treating each as its own pass before moving to the next. Do not skip a region " +
  "just because it's partially out of frame — report whatever is visible in it.";

function buildRefinedPrompt(mode: ScanMode): string {
  return `${buildPrompt(mode)}${REFINED_SCAN_SUFFIX}`;
}

const MIN_ITEMS_BEFORE_REFINED_PASS = 3;

/** Merges two raw Gemini passes, deduplicating by lowercased name. */
function mergeDetectedItems(first: DetectedItem[], second: DetectedItem[]): DetectedItem[] {
  const seen = new Set(first.map((item) => item.name.toLowerCase()));
  const fresh = second.filter((item) => {
    const key = item.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...first, ...fresh];
}

function toIngredients(items: DetectedItem[], mode: ScanMode): Ingredient[] {
  const now = Date.now();
  return items.map((item, index) => ({
    id: `scan-${now}-${index}`,
    name: item.name,
    category: item.category,
    status: "in_stock",
    // Pantry scans (spices, flour, oils) are staples; fridge scans are fresh.
    isStaple: mode === "pantry",
    addedAt: now,
  }));
}

function extractJson(text: string): unknown {
  // Gemini occasionally wraps JSON in a code fence despite instructions not to.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

interface GeminiHttpError extends Error {
  status: number;
  body: string;
  url: string;
}

/** One raw call to a specific model. Throws a GeminiHttpError (with status/body/url) on failure. */
async function callGeminiModel(
  model: string,
  base64Image: string,
  promptText: string
): Promise<DetectedItem[]> {
  const url = endpointFor(model);
  console.log(`[CookSnap Vision Diagnostic] Requesting model "${model}" at: ${url}`);

  const response = await fetch(`${url}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: promptText },
            { inline_data: { mime_type: "image/jpeg", data: base64Image } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    let errorBody = "";
    try {
      errorBody = await response.text();
    } catch {
      errorBody = "(could not read error response body)";
    }
    const error = new Error(
      `Gemini vision request failed: ${response.status} — ${errorBody}`
    ) as GeminiHttpError;
    error.status = response.status;
    error.body = errorBody;
    error.url = url;
    throw error;
  }

  const data = await response.json();
  console.log("[CookSnap Vision Diagnostic] Full raw API response:", JSON.stringify(data));

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  console.log("[CookSnap Vision] Raw Gemini response text:", text);

  const parsed = extractJson(text) as { items?: DetectedItem[] };
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  console.log("[CookSnap Vision Diagnostic] Detected items array length:", items.length);

  return items;
}

const RATE_LIMIT_RETRY_DELAY_MS = 2000;

/**
 * A 429 is often a brief per-minute burst limit, not a hard cap — one retry
 * after a short delay clears it in that case. If the retry also 429s, this
 * lets the error propagate normally rather than retrying indefinitely
 * (a sustained 429 usually means the daily/project quota is actually
 * exhausted, which no amount of retrying will fix).
 */
async function callGeminiModelWithRetry(
  model: string,
  base64Image: string,
  promptText: string
): Promise<DetectedItem[]> {
  try {
    return await callGeminiModel(model, base64Image, promptText);
  } catch (error) {
    const httpError = error as GeminiHttpError;
    if (httpError.status !== 429) throw error;

    console.log(
      `[CookSnap Vision Diagnostic] 429 Quota Exceeded for model "${model}" — ` +
        `waiting ${RATE_LIMIT_RETRY_DELAY_MS}ms and retrying once.`
    );
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_DELAY_MS));
    return await callGeminiModel(model, base64Image, promptText);
  }
}

// Once a model in the fallback chain is confirmed working this session,
// reuse it directly instead of re-probing the (known-dead) configured model
// on every subsequent scan.
let resolvedModel: string | null = null;

/**
 * Tries each model in MODEL_FALLBACK_CHAIN in order. A 404 means "this model
 * doesn't exist" — that's the one case where trying the next candidate makes
 * sense. Any other error (429 quota, 401 auth, 500, etc.) is a real problem
 * with the request itself, not the model name, so it's surfaced immediately
 * instead of masked by silently cycling through models.
 */
async function callGeminiWithFallback(
  base64Image: string,
  promptText: string
): Promise<DetectedItem[]> {
  console.log("[CookSnap Vision Diagnostic] base64 length:", base64Image.length);

  const chain = resolvedModel ? [resolvedModel] : MODEL_FALLBACK_CHAIN;

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    try {
      const items = await callGeminiModelWithRetry(model, base64Image, promptText);
      resolvedModel = model;
      return items;
    } catch (error) {
      const httpError = error as GeminiHttpError;
      const isLastCandidate = i === chain.length - 1;

      if (httpError.status === 404) {
        console.log(
          `[CookSnap Vision Diagnostic] 404 Not Found for model "${model}" at URL: ${httpError.url}` +
            (isLastCandidate ? " — no more fallbacks to try." : " — trying next fallback.")
        );
        if (!isLastCandidate) continue;
        Alert.alert(
          "Gemini API Error (404)",
          `None of these models exist for your API key/version:\n${chain.join(", ")}`
        );
        throw httpError;
      }

      // Non-404: quota, auth, server error — not a "wrong model" problem.
      console.log("[CookSnap Vision Diagnostic] API error status:", httpError.status);
      console.log("[CookSnap Vision Diagnostic] API error body:", httpError.body);
      Alert.alert(
        `Gemini API Error (${httpError.status})`,
        (httpError.body ?? "").slice(0, 500) || "No error body returned."
      );
      throw httpError;
    }
  }

  throw new Error("Unreachable: model fallback chain is never empty");
}

/**
 * 3-pass detection: an initial broad scan, an automatic region-focused
 * refined pass if the first came back thin (a strong signal it skimmed
 * rather than inspected each shelf), then a name-deduplicated merge of both
 * passes before the confidence threshold is applied to the combined result.
 */
async function detectWithGemini(base64Image: string, mode: ScanMode): Promise<DetectedItem[]> {
  const firstPass = await callGeminiWithFallback(base64Image, buildPrompt(mode));

  let combined = firstPass;
  if (firstPass.length < MIN_ITEMS_BEFORE_REFINED_PASS) {
    console.warn("[CookSnap Vision] Detection sensitivity low — triggering refined region scan");
    const refinedPass = await callGeminiWithFallback(base64Image, buildRefinedPrompt(mode));
    combined = mergeDetectedItems(firstPass, refinedPass);
  }

  return combined.filter((item) => item.confidence >= CONFIDENCE_THRESHOLD);
}

export async function detectIngredientsFromPhoto(
  base64Image: string,
  mode: ScanMode = "fridge"
): Promise<Ingredient[]> {
  if (!GEMINI_API_KEY) {
    console.log("[CookSnap Vision Diagnostic] EXPO_PUBLIC_GEMINI_API_KEY is undefined/missing");
    Alert.alert(
      "CookSnap Vision Debug",
      "EXPO_PUBLIC_GEMINI_API_KEY is undefined — it isn't set, or the dev server wasn't restarted after adding it to .env."
    );
    throw new Error(
      "EXPO_PUBLIC_GEMINI_API_KEY is not configured — the scanner has no mock/demo fallback " +
        "by design. Set the key in .env and restart the dev server to enable scanning."
    );
  }
  const items = await detectWithGemini(base64Image, mode);
  return toIngredients(items, mode);
}
