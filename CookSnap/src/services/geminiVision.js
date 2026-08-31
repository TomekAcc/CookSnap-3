import * as ImageManipulator from "expo-image-manipulator";
import { getIngredientStyle } from "../utils/imageUtils";
import { getIngredientEmoji } from "../utils/ingredientEmoji";

// Per-request timeout so one hung candidate model can't stall the whole
// scan — a bare fetch() has no built-in timeout and will otherwise wait on
// the OS-level default (can be 60s+), multiplied by every candidate tried.
const REQUEST_TIMEOUT_MS = 10000;

function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

// expo-image-manipulator has no built-in timeout either — on some devices
// it can stall on a large/odd-format capture and never resolve or reject,
// which would hang the whole scan before it even reaches the network call
// (and before REQUEST_TIMEOUT_MS above ever gets a chance to matter).
const COMPRESS_TIMEOUT_MS = 12000;

// thinkingConfig is only valid on models that actually support extended
// thinking — sending it to gemini-flash-lite-latest is a hard HTTP 400
// ("Request contains an invalid argument"), confirmed live. Shared between
// analyzeFridgeImage and analyzePantryImage so both build their per-model
// request bodies from the same source of truth.
const THINKING_CAPABLE_MODELS = new Set(["gemini-3.7-flash"]);

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Deterministic 5-Zone Master Prompt — actionable cooking ingredients only.
 */
export const MASTER_VISION_SYSTEM_PROMPT = `
You are a culinary AI vision auditor inspecting a domestic fridge photo.

TASK:
Identify clearly visible, actionable cooking ingredients: produce, dairy, sauces, spreads, drinks, condiments, meats, and packaged goods. Systematically scan left-to-right across all 5 zones. If 20+ actionable items are visible, list every one.

STRICT VISIBILITY RULE (ZERO GUESSING):
- Only output ingredients that are 100% clearly visible in the photo.
- DO NOT guess covered or hidden food. If an item is under a pot lid, inside a completely opaque unlabeled container, or hidden behind other items, DO NOT invent its contents — skip it.
- LABEL DEDUCTION ONLY: Deduce contents only when packaging branding or visual context is unambiguous (e.g. Piątnica cottage cheese tub, Winiary mayonnaise jar, TaoTao soy sauce bottle).
- Prefer omitting an unclear item over hallucinating a name.

5-ZONE INSPECTION PROTOCOL:
1. ZONE 1 (TOP SHELVES): Labeled glass jars of broth/soup stock when readable, yogurt buckets with clear branding -> "Greek Yogurt" / "Natural Yogurt". Wrapped rectangular block in butter-style foil/paper packaging -> "Butter". Skip unlabeled opaque containers and lidded pots with unknown contents.
2. ZONE 2 (MIDDLE SHELVES): Clearly branded white/green plastic tubs -> "Cottage Cheese" / "Serek Wiejski". Distinct blue tub -> "Mascarpone". Readable spreads -> "Hummus" / "Dips". Clearly visible wrapped citrus -> "Lemon" / "Lime". Container of bread rolls, buns, or crackers -> "Bread Rolls" / "Crackers".
3. ZONE 3 (LOWER SHELVES & DRAWERS): Egg cartons -> "Eggs". Visible melon -> "Melon". Green stalks -> "Spring Onions" / "Chives". Visible white bulb -> "Garlic" / "Onion". Apples, avocados, bell peppers, leafy greens when clearly seen.
4. ZONE 4 (UPPER DOOR SHELVES): Yellow/white cap jar with mayo cues -> "Mayonnaise". Dark jars with readable lids/labels -> "Pesto" / "Jam" / "Mustard". Red-labelled bottle -> "Soy Sauce".
5. ZONE 5 (LOWER DOOR SHELVES): "Łaciate" carton -> "Milk". Yellow/white plant-milk carton -> "Oat Milk". Dark glass bottles when oil type is clear -> "Olive Oil" / "Sesame Oil".

STRICT EXCLUSION RULES:
- DO NOT detect or output generic meta-terms like "Leftovers", "Cooked Food", "Tupperware", "Storage Box", "Pot", "Pots", "Pan", "Unknown Container", "Container", "Cutlery", or "Containers".
- Detect ONLY actionable cooking ingredients (e.g. "Cottage Cheese", "Mayonnaise", "Red Bell Pepper", "Eggs", "Milk", "Spring Onions", "Butter", "Bread Rolls").
- If a container's contents are not clearly identifiable from a label or visible food, SKIP it entirely — never invent a generic name.
- Exclude non-food infrastructure (fridge walls, shelves, plastic drawers, empty bags).

STRICT RULES:
1. DETERMINISTIC EXHAUSTIVE SCAN of clearly visible actionable items only. Do NOT stop after 10-12 items when more are clearly visible.
2. Clean, concise ingredient names, written in the LANGUAGE specified in the request below (English if none given).
3. Pair every detected item with the single most specific food emoji available for that exact food — e.g. 🥒 for pickles/cucumber, 🧅 for spring onion, 🥚 for eggs, 🧀 for cheese. The emoji choice is entirely independent of the "name" field's language — always pick it from what the food visually IS, never a generic placeholder like 🫙/📦/🥫/🛒 when a specific, more accurate emoji exists for that food.
4. Output MUST be ONLY a valid raw JSON array of objects with keys "name" and "icon".

Example Output:
[
  {"name": "Greek Yogurt", "icon": "🥣"},
  {"name": "Cottage Cheese", "icon": "🥣"},
  {"name": "Mascarpone", "icon": "🧀"},
  {"name": "Hummus", "icon": "🥣"},
  {"name": "Butter", "icon": "🧈"},
  {"name": "Bread Rolls", "icon": "🥐"},
  {"name": "Spring Onions", "icon": "🥬"},
  {"name": "Eggs", "icon": "🥚"},
  {"name": "Lemon", "icon": "🍋"},
  {"name": "Lime", "icon": "🍋"},
  {"name": "Melon", "icon": "🍈"},
  {"name": "Apple", "icon": "🍎"},
  {"name": "Red Bell Pepper", "icon": "🫑"},
  {"name": "Garlic", "icon": "🧄"},
  {"name": "Mayonnaise", "icon": "🥣"},
  {"name": "Pesto", "icon": "🫙"},
  {"name": "Mustard", "icon": "🟡"},
  {"name": "Soy Sauce", "icon": "🍾"},
  {"name": "Olive Oil", "icon": "🫒"},
  {"name": "Sesame Oil", "icon": "🍾"},
  {"name": "Oat Milk", "icon": "🥛"},
  {"name": "Milk", "icon": "🥛"}
]
`.trim();

/** Block generic / non-actionable vision labels. */
function isMetaIngredientName(name = "") {
  const n = String(name).toLowerCase().trim();
  if (!n) return true;
  // Real foods that share substrings with meta terms
  if (
    /potato|pot\s*stick|pottage|mustard|compote|panini|pancake|panna\s*cotta/.test(
      n
    )
  ) {
    return false;
  }
  return (
    /\bleftovers?\b/.test(n) ||
    /cooked\s*(food|meal|dish)/.test(n) ||
    /tupperware/.test(n) ||
    /storage\s*(box|container)/.test(n) ||
    /unknown\s*container/.test(n) ||
    /^(plastic|food|storage)?\s*containers?$/.test(n) ||
    /\b(plastic|food)\s+containers?\b/.test(n) ||
    /^pots?$/.test(n) ||
    /^pans?$/.test(n) ||
    /steel\s*pot/.test(n) ||
    /stainless\s*steel/.test(n) ||
    /^cutlery$/.test(n) ||
    /bowl\s+of\s+food/.test(n)
  );
}

/**
 * High-resolution compressor for label reading (~250KB JPEG).
 * Width 1280px / quality 0.70 for crisp shelf & door labels.
 */
export async function compressPhotoForVision(imageInput) {
  if (!imageInput) return null;

  try {
    if (
      typeof imageInput === "string" &&
      !imageInput.startsWith("file:") &&
      !imageInput.startsWith("content:") &&
      !imageInput.startsWith("ph:") &&
      !imageInput.startsWith("http") &&
      imageInput.length > 500
    ) {
      return imageInput.includes(",")
        ? imageInput.split(",")[1].trim()
        : imageInput.trim();
    }

    const manipResult = await withTimeout(
      ImageManipulator.manipulateAsync(
        imageInput,
        [{ resize: { width: 1280 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      ),
      COMPRESS_TIMEOUT_MS,
      "Photo compression"
    );

    return manipResult.base64 ? manipResult.base64.trim() : null;
  } catch (err) {
    console.warn("[Cook AI Vision] Compression warning:", err?.message);
    if (typeof imageInput === "string" && imageInput.includes(",")) {
      return imageInput.split(",")[1].trim();
    }
    return typeof imageInput === "string" ? imageInput.trim() : null;
  }
}

/**
 * 5-Zone Master-Grade Gemini Vision Service (Deterministic).
 * Accepts a single image URI/base64 OR an array for collective multi-shelf analysis.
 */
export async function analyzeFridgeImage(
  imageInput,
  providedApiKey = "",
  // English name of the user's selected recipe/UI language ("English",
  // "Polish", "Spanish", ...) — same convention as geminiRecipes.js's
  // `language` param. Only the "name" field's text is affected; "icon"
  // is an emoji so it's language-agnostic either way.
  language = "English"
) {
  const apiKey = (
    providedApiKey ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  )
    .trim()
    .replace(/['"]/g, "");

  if (!apiKey) {
    console.error("[Cook AI Vision] CRITICAL: Missing Gemini API Key!");
    throw new Error(
      "Missing Gemini API Key. Configure EXPO_PUBLIC_GEMINI_API_KEY in your .env file."
    );
  }

  const inputs = (Array.isArray(imageInput) ? imageInput : [imageInput]).filter(
    Boolean
  );
  if (!inputs.length) {
    throw new Error("Invalid image format. Please capture a new photo.");
  }

  console.log(
    `[Cook AI Vision] Processing ${inputs.length} photo(s) with 1280px sampler...`
  );

  const base64Array = [];
  for (let i = 0; i < inputs.length; i += 1) {
    const cleanBase64 = await compressPhotoForVision(inputs[i]);
    if (cleanBase64) base64Array.push(cleanBase64);
  }

  if (!base64Array.length) {
    console.error(
      "[Cook AI Vision] CRITICAL: Could not generate Base64 from photo(s)."
    );
    throw new Error("Invalid image format. Please capture a new photo.");
  }

  const multi = base64Array.length > 1;
  const promptText = multi
    ? `
Analyze ALL these ${base64Array.length} fridge/pantry shelf photos and provide ONE consolidated list of ingredients.
Treat every image as a different shelf, door section, or pantry bay of the same kitchen.
Merge duplicates across photos into a single entry (same ingredient only once).
For each photo, apply the full 5-zone inspection when the frame looks like a fridge; for pantry/shelf frames, list every clearly visible dry good, sauce, oil, spice, and packaged staple.
Detect ONLY 100% clearly visible, actionable cooking ingredients.
ZERO GUESSING: Do not invent contents of lidded pots, opaque unlabeled containers, or items hidden behind others.
LABEL DEDUCTION ONLY when branding is unambiguous.
NEVER output meta-labels like Leftovers, Cooked Food, Tupperware, Pot, Pan, Storage Box, or Unknown Container.
Return ONLY a JSON array of {"name","icon"} objects.
`.trim()
    : `
Perform a full 5-zone inspection of this fridge photo.
Scan Zone 1 (Top shelves), Zone 2 (Middle shelves), Zone 3 (Lower drawers), Zone 4 (Upper door shelves), and Zone 5 (Lower door shelves).
Detect ONLY 100% clearly visible, actionable cooking ingredients (dairy, sauces, produce, meats, drinks, labeled packaged goods).
ZERO GUESSING: Do not invent contents of lidded pots, opaque unlabeled containers, or items hidden behind others.
LABEL DEDUCTION ONLY when branding is unambiguous (e.g. Piątnica cottage cheese, Winiary mayonnaise, TaoTao soy sauce).
NEVER output meta-labels like Leftovers, Cooked Food, Tupperware, Pot, Pan, Storage Box, or Unknown Container.
Prefer skipping an unclear item over hallucinating a name.
Return ONLY a JSON array of {"name","icon"} objects.
`.trim();

  const imageParts = base64Array.map((data) => ({
    inlineData: {
      mimeType: "image/jpeg",
      data,
    },
  }));

  const isEnglish = language === "English";
  const systemPromptForRequest = isEnglish
    ? MASTER_VISION_SYSTEM_PROMPT
    : `${MASTER_VISION_SYSTEM_PROMPT}\n\nLANGUAGE (MANDATORY): write every "name" value in ${language}, not English — the real ${language} word for the ingredient, not a transliteration. This applies ONLY to the "name" field's text; JSON keys and the "icon" emoji are unaffected.`;

  // Building the request body per-candidate (rather than once, shared)
  // keeps thinkingConfig model-specific instead of poisoning the fallback
  // request — see THINKING_CAPABLE_MODELS above.
  function buildPayloadFor(model) {
    const generationConfig = {
      // Strictly deterministic (zero variation for identical inputs)
      temperature: 0.0,
      topP: 1.0,
      responseMimeType: "application/json",
    };
    if (THINKING_CAPABLE_MODELS.has(model)) {
      // Confirmed real failure, not a hypothetical: gemini-3.7-flash spends
      // an unrequested "thinking" pass before answering this vision prompt
      // (usageMetadata.thoughtsTokenCount ~975 on an unmodified call) —
      // measured live at 6.8-10.4s per scan, well past the fixed 3.2s
      // choreography bar, which is exactly the "freezes at 92%" a user
      // reported. thinkingBudget: 0 turns that off; live A/B against the
      // same real fridge photo (4 runs) held item count at 13-15 with the
      // same core ingredients each time, while cutting latency to
      // 1.3-2.2s — the detection quality gemini-3.7-flash was chosen for,
      // without paying for reasoning a single structured JSON list never
      // needed.
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }
    return {
      systemInstruction: {
        parts: [{ text: systemPromptForRequest }],
      },
      contents: [
        {
          parts: [{ text: promptText }, ...imageParts],
        },
      ],
      generationConfig,
    };
  }

  // Short, verified-working list only. Each failed/rate-limited candidate
  // Just the best model plus one fast fallback — every extra candidate in
  // the chain is pure downside for speed (another full timeout window
  // before falling through), so keep this as short as resilience allows.
  const candidateModels = [
    "gemini-3.7-flash",
    "gemini-flash-lite-latest",
  ];

  const candidateUrls = candidateModels.map(
    (model) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  );

  let lastError = null;

  for (const url of candidateUrls) {
    const modelName = url.split("models/")[1].split(":")[0];
    try {
      console.log(
        `[Cook AI Vision] Requesting deterministic ${multi ? "multi-photo" : "5-zone"} deep scan (${base64Array.length} image(s)) from ${modelName}...`
      );

      const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayloadFor(modelName)),
      });

      // On rate-limit, move straight to the next candidate model instead of
      // waiting out this one's cooldown (previously up to 35s) — with a
      // short, bounded candidate list, a fresh model is faster than waiting.
      if (response.status === 429) {
        console.warn(`[Cook AI Vision] ${modelName} rate-limited (429), trying next model...`);
        lastError = new Error(`Gemini API Error 429: rate limited`);
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        console.warn(
          `[Cook AI Vision] Endpoint ${modelName} returned status ${response.status}:`,
          errText.slice(0, 280)
        );
        lastError = new Error(
          `Gemini API Error ${response.status}: ${errText.slice(0, 200)}`
        );
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      console.log(`[Cook AI Vision] Raw response from ${modelName}:`, rawText);

      const jsonMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      const jsonString = jsonMatch
        ? jsonMatch[0]
        : rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

      if (!jsonString) {
        lastError = new Error(`Empty vision response from ${modelName}`);
        continue;
      }

      if (jsonString === "[]") {
        console.log(`[Cook AI Vision] ${modelName} returned empty food list.`);
        return [];
      }

      const items = JSON.parse(jsonString);

      if (Array.isArray(items)) {
        const normalized = items
          .filter(
            (item) =>
              item &&
              typeof item.name === "string" &&
              item.name.trim() &&
              !isMetaIngredientName(item.name)
          )
          .map((item, idx) => {
            const name = item.name.trim();
            // Prefer Gemini's own per-item icon (language-independent —
            // see MASTER_VISION_SYSTEM_PROMPT) over the local English-
            // keyword guesser, which can't match a name that's now in the
            // user's selected language and was silently discarding the
            // AI's real icon on every scan.
            const icon =
              (typeof item.icon === "string" && item.icon.trim()) ||
              getIngredientEmoji(name) ||
              getIngredientStyle(name).emoji ||
              "🛒";
            return {
              id: (Date.now() + idx).toString(),
              name,
              icon,
              emoji: icon,
            };
          });

        const seen = new Set();
        const unique = normalized.filter((item) => {
          const key = item.name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        console.log(
          `[Cook AI Vision] SUCCESS! Master scan detected ${unique.length} items:`,
          unique
        );
        return unique;
      }
    } catch (err) {
      console.warn(`[Cook AI Vision] Error with ${modelName}:`, err?.message);
      lastError = err;
    }
  }

  throw (
    lastError ||
    new Error("Master Vision scan failed to recognize food items.")
  );
}

/** @deprecated Always returns [] — never invent fridge ingredients. */
export function getFallbackFridgeItems() {
  return [];
}

// --- Pantry helpers (used by CookAIContext) ---

const CANDIDATE_MODELS = ["gemini-3.7-flash", "gemini-flash-lite-latest"];

function resolveApiKey(providedApiKey = "") {
  return (
    providedApiKey ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  )
    .trim()
    .replace(/['"]/g, "");
}

/**
 * Batch-translates a list of ingredient/pantry item names into `language`
 * in one request — used when the user switches the app language, so
 * already-scanned inventory (free-text names with no translation-key
 * system of their own, unlike the rest of the UI) follows along instead
 * of staying stuck in whatever language it was originally detected in.
 * Returns the SAME items with only "name"/"icon" swapped, same order and
 * count — the caller keeps id/inStock/category/etc. as-is. No-op
 * (returns items unchanged) without an API key, on any failure, or if the
 * model's response doesn't match the input count — never corrupts the
 * list, and never blocks the language switch itself.
 */
export async function translateIngredientNames(items, language, providedApiKey = "") {
  if (!Array.isArray(items) || items.length === 0) return items;
  const apiKey = resolveApiKey(providedApiKey);
  if (!apiKey) return items;

  const promptText = `Translate the "name" of each food/ingredient item below into ${language} — the real ${language} word for that food, not a transliteration. Keep the exact same order and count as the input, one output object per input item. Also re-confirm "icon": the single most specific food emoji for that exact item (independent of language) — keep it if already accurate, correct it if a more specific emoji exists.
Return ONLY a raw JSON array of {"name","icon"} objects, same length as the input, no markdown, no commentary.

INPUT:
${JSON.stringify(
    items.map((i) => ({ name: i?.name || "", icon: i?.icon || i?.emoji || "" }))
  )}`;

  const candidateUrls = CANDIDATE_MODELS.map(
    (model) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  );

  for (const url of candidateUrls) {
    try {
      const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      });
      if (!response.ok) continue;
      const data = await response.json();
      let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
      let translated;
      try {
        translated = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!Array.isArray(translated) || translated.length !== items.length) continue;
      return items.map((item, idx) => {
        const entry = translated[idx];
        const name =
          typeof entry?.name === "string" && entry.name.trim()
            ? entry.name.trim()
            : item.name;
        const icon =
          typeof entry?.icon === "string" && entry.icon.trim()
            ? entry.icon.trim()
            : item.icon || item.emoji;
        return { ...item, name, icon, emoji: icon };
      });
    } catch (err) {
      console.warn("[Cook AI Vision] translateIngredientNames failed:", err?.message);
    }
  }
  return items;
}

/**
 * Deep Shelf Inspection protocol — pantry shelves are dense and layered, so a
 * shallow "front row only" scan misses most of the real inventory. This
 * mirrors the fridge's zone-based exhaustive-scan structure but tuned for
 * pantry shelving depth (stacked cans, back-row jars, bottom-shelf bottles).
 */
const PANTRY_ANALYSIS_PROMPT = `
You are an expert pantry auditor performing a DEEP SHELF INSPECTION of a food storage area: pantry shelves, cabinets, cupboards, spice racks, or countertop stores. Photos of stocked pantries are dense and layered — a shallow scan only catches the front row and misses most of the real inventory. Your task is to out-audit that shallow pass.

DEEP SHELF RECALL PROTOCOL (mandatory):
- Do NOT stop at the front row. Actively look PAST front-row items for cans, jars, bottles, and boxes stacked behind, beside, or partially occluded by other items.
- Inspect shelf-by-shelf, top to bottom. Within each shelf, scan front-to-back and left-to-right — items are frequently two or three deep.
- Detect stacked cans (cans sitting on top of cans), grouped jars, and boxes/bags pushed to the back or sides of a shelf.
- If a label is partially blocked but the container's shape, color, and any visible text fragment make the item unambiguous, include it. If truly unreadable and ambiguous, skip it rather than guess.

PRIORITY CATEGORIES — actively hunt for these; they are the items shallow scans miss most often:
1. Coffee & Tea: coffee tins/bags (including plain black coffee tins), instant coffee jars, tea boxes and tins.
2. Grains, Pasta & Flour: pasta in any shape or packaging, rice, flour, oats, cereal, and grains in transparent or colorful bags/boxes.
3. Bottled Liquids: cooking oils, vinegars, and wine bottles — especially ones tucked on bottom shelves or along the sides.
4. Large Condiment & Passata Bottles: big tomato passata / pasta sauce bottles (e.g. Mutti-style), ketchup, and other large condiment bottles that don't look like typical small jars.
5. Canned Goods: canned vegetables, beans, tomatoes, tuna, soups — check behind taller items for hidden cans.
6. Spices & Seasoning: spice jars, spice racks, seasoning packets, salt and pepper containers.

STRICT VISIBILITY RULE (ZERO GUESSING — this is the most important rule):
- Only output items that are clearly identifiable from visible packaging, shape, color, or readable label text.
- Do not invent contents for fully opaque, unlabeled containers.
- NEVER output a specific product name (e.g. "Horseradish", "BBQ Sauce", a brand name) unless the label is actually readable or the container is unmistakably that product. Guessing a plausible-sounding but unconfirmed item is a hallucination and is strictly forbidden.
- When uncertain between two possible items, or when a label is blurry/angled/too small to read, SKIP the item entirely rather than picking your best guess. Omitting a real item is always better than inventing a fake one.
- Do NOT default to common pantry staples out of assumption. Every pantry does not necessarily have "Cooking Oil", "Olive Oil", "Salt", or "Flour" — only output these if an actual oil bottle, salt container, or flour bag is visibly present in THIS photo. Never add a "typical" staple just because most pantries tend to have one.

STRICT EXCLUSION RULES — FOOD ONLY, NO EXCEPTIONS:
- This is a food-ingredient inventory ONLY. If an item is not something a person would eat, drink, or cook with, it must NEVER appear in the output, no matter how confidently you can identify it or how clearly its label reads.
- Do not output generic meta-terms: "Container", "Box", "Bag", "Jar" (without a food name), "Shelf", "Cabinet", "Unknown Item".
- Exclude ALL household paper & cleaning products, even when clearly branded and shelved right next to food: paper towels, toilet paper, tissues, napkins, cleaning sponges, dish cloths, dish soap, detergent, trash bags, foil, cling wrap, baking paper.
- Exclude kitchen utensils, tools, and appliances: pots, pans, cutlery, mixing bowls, mortar and pestle, thermoses, flasks, travel mugs, mugs, cups, blenders, toasters, scales.
- Exclude other non-food objects: batteries, chargers, cosmetics, stationery, decorative items.
- Exclude empty or clearly-unlabeled glass storage jars — a jar with no visible food inside and no label is empty kitchen storage, not a staple.
- Exclude plain bottled drinking water (still, sparkling, or mineral water bottles/jugs) — it is not a cooking pantry staple and must never be listed, even if clearly visible.
- Before including ANY item, silently ask: "Is this something you eat, drink, or cook with?" If the answer is no or unsure, leave it out.

OUTPUT REQUIREMENTS:
1. DETERMINISTIC EXHAUSTIVE SCAN — if 15+ items are visible across all shelf depths, list every one. Do not stop early.
2. Clean, concise item names in the LANGUAGE specified in the request below (English if none given) — translate any non-English label text on the packaging into that language too, don't just copy the label verbatim.
3. Pair every item with the single most specific food emoji for that exact item — independent of the "name" field's language, always chosen from what the food visually IS, never a generic placeholder like 🫙/📦/🥫/🛒 when a more specific emoji exists.
4. Assign each item a category from EXACTLY one of these fixed English tokens (never translate this field — the app matches it in code): "Spices & Herbs", "Oils & Sauces", "Grains & Baking", "Condiments & Jars".
5. Output MUST be ONLY a valid raw JSON array of objects with keys: "name" (in the target language), "icon" (emoji), "category" (one of the four fixed English tokens above), "role" (short English culinary use — internal only, never shown to the user, always English regardless of the name's language).

Example Output:
[
  {"name":"Black Coffee Tin","icon":"☕","category":"Condiments & Jars","role":"Brewed coffee base"},
  {"name":"Green Tea Box","icon":"🍵","category":"Condiments & Jars","role":"Tea infusion"},
  {"name":"Spaghetti","icon":"🍝","category":"Grains & Baking","role":"Pasta base for dinners"},
  {"name":"All-Purpose Flour","icon":"🌾","category":"Grains & Baking","role":"Baking foundation"},
  {"name":"Olive Oil","icon":"🫒","category":"Oils & Sauces","role":"Cooking oil base"},
  {"name":"Red Wine Vinegar","icon":"🍾","category":"Oils & Sauces","role":"Dressing acid"},
  {"name":"Red Wine","icon":"🍷","category":"Oils & Sauces","role":"Cooking wine / deglazing"},
  {"name":"Tomato Passata","icon":"🍅","category":"Condiments & Jars","role":"Pasta sauce base"},
  {"name":"Canned Tomatoes","icon":"🥫","category":"Condiments & Jars","role":"Sauce & stew base"},
  {"name":"Canned Chickpeas","icon":"🫘","category":"Condiments & Jars","role":"Protein & fiber base"},
  {"name":"Paprika","icon":"🧂","category":"Spices & Herbs","role":"Warm smoky seasoning"}
]

Return ONLY the raw JSON array — no markdown, no commentary.
`;

const PANTRY_CATEGORIES_SET = new Set([
  "Spices & Herbs",
  "Oils & Sauces",
  "Grains & Baking",
  "Condiments",
  "Condiments & Jars",
]);

function normalizePantryCategory(raw) {
  if (raw === "Condiments & Jars") return "Condiments";
  if (PANTRY_CATEGORIES_SET.has(raw) && raw !== "Condiments & Jars") return raw;
  return null;
}

function normalizePantryItems(items) {
  return (items || [])
    .filter((item) => item && typeof item.name === "string" && item.name.trim())
    .map((item, idx) => {
      const name = item.name.trim();
      // Gemini already returns an accurate, language-independent emoji per
      // item — prefer that over the local English-keyword guesser, which
      // can't match a name that's now in the user's selected language and
      // has its own unconditional "🫙" fallback (so it was always winning
      // this comparison, silently masking the AI's real icon).
      const iconOrEmoji =
        (typeof item.icon === "string" && item.icon.trim()) ||
        (typeof item.emoji === "string" && item.emoji.trim()) ||
        getIngredientEmoji(name) ||
        getIngredientStyle(name).emoji ||
        "🫙";
      const category =
        normalizePantryCategory(item.category) ||
        classifyPantryCategoryLocal(name);
      const role =
        (typeof item.role === "string" && item.role.trim()) ||
        "Essential pantry staple for recipes";
      return {
        id: `pantry-${Date.now()}-${idx}-${name.toLowerCase().replace(/\s+/g, "-")}`,
        name,
        emoji: iconOrEmoji,
        icon: iconOrEmoji,
        category,
        role,
        inStock: true,
      };
    });
}

export function classifyPantryCategoryLocal(name = "") {
  const n = String(name).toLowerCase();
  if (
    /salt|pepper|garlic|oregano|basil|cumin|paprika|cinnamon|chili|herb|spice|thyme|rosemary/.test(
      n
    )
  ) {
    return "Spices & Herbs";
  }
  if (/oil|butter|soy|sauce|vinegar|sesame|ghee|broth|stock/.test(n)) {
    return "Oils & Sauces";
  }
  if (
    /flour|rice|pasta|oat|grain|sugar|baking|yeast|cornstarch|noodle/.test(n)
  ) {
    return "Grains & Baking";
  }
  return "Condiments";
}

export function classifyPantryItemLocal(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  const category = classifyPantryCategoryLocal(trimmed);
  // Per-item keyword match first (e.g. "Walnuts" → 🥜) — the old broad
  // category→emoji map forced every uncategorized item into the same
  // generic Condiments jar even when a precise match existed.
  const categoryFallback = {
    "Spices & Herbs": "🌿",
    "Oils & Sauces": "🫒",
    "Grains & Baking": "🌾",
    Condiments: "🫙",
  };
  const emoji =
    getIngredientEmoji(trimmed) || categoryFallback[category] || "🫙";
  return {
    id: `pantry-manual-${Date.now()}-${trimmed.toLowerCase().replace(/\s+/g, "-")}`,
    name: trimmed,
    emoji,
    icon: emoji,
    category,
    role: "Essential pantry staple for recipes",
    inStock: true,
  };
}

export function getFallbackPantryItems() {
  return [
    {
      id: "pantry-fb-oil",
      name: "Olive Oil",
      emoji: "🫒",
      category: "Oils & Sauces",
      role: "Healthy cooking oil & dressing base",
      inStock: true,
    },
    {
      id: "pantry-fb-salt",
      name: "Sea Salt",
      emoji: "🧂",
      category: "Spices & Herbs",
      role: "Essential seasoning",
      inStock: true,
    },
    {
      id: "pantry-fb-oregano",
      name: "Dried Oregano",
      emoji: "🌿",
      category: "Spices & Herbs",
      role: "Herb accent for Italian dishes",
      inStock: true,
    },
    {
      id: "pantry-fb-flour",
      name: "All-Purpose Flour",
      emoji: "🌾",
      category: "Grains & Baking",
      role: "Thickener & baking foundation",
      inStock: true,
    },
  ];
}

export async function analyzePantryImage(
  imageUriOrBase64,
  providedApiKey = "",
  language = "English"
) {
  const apiKey = resolveApiKey(providedApiKey);

  if (!apiKey) {
    return getFallbackPantryItems();
  }

  let base64Image = null;
  if (
    typeof imageUriOrBase64 === "string" &&
    (imageUriOrBase64.startsWith("file:") ||
      imageUriOrBase64.startsWith("content:") ||
      imageUriOrBase64.startsWith("ph://") ||
      imageUriOrBase64.startsWith("assets-library:"))
  ) {
    base64Image = await compressPhotoForVision(imageUriOrBase64);
  } else if (
    typeof imageUriOrBase64 === "string" &&
    imageUriOrBase64.length > 200 &&
    !imageUriOrBase64.startsWith("http")
  ) {
    base64Image = imageUriOrBase64;
  } else if (typeof imageUriOrBase64 === "string") {
    base64Image = await compressPhotoForVision(imageUriOrBase64);
  }

  if (!base64Image) {
    return getFallbackPantryItems();
  }

  const cleanBase64 = base64Image.includes(",")
    ? base64Image.split(",")[1].trim()
    : base64Image.trim();

  const isEnglish = language === "English";
  const pantryPromptForRequest = isEnglish
    ? PANTRY_ANALYSIS_PROMPT
    : `${PANTRY_ANALYSIS_PROMPT}\n\nLANGUAGE (MANDATORY): write every "name" value in ${language}, not English — the real ${language} word for the item, not a transliteration. "category" stays one of the four fixed English tokens regardless, and "role" stays English too — neither is shown to the user.`;

  // Same per-model split as analyzeFridgeImage above: thinkingConfig is a
  // hard HTTP 400 on gemini-flash-lite-latest, confirmed live, so it can
  // only go on the request body for models that actually support it.
  function buildPantryPayloadFor(model) {
    const generationConfig = {
      temperature: 0.0,
      topP: 1.0,
      responseMimeType: "application/json",
    };
    if (THINKING_CAPABLE_MODELS.has(model)) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }
    return {
      contents: [
        {
          parts: [
            { text: pantryPromptForRequest },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanBase64,
              },
            },
          ],
        },
      ],
      generationConfig,
    };
  }

  const candidateUrls = CANDIDATE_MODELS.map(
    (model) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  );

  for (const url of candidateUrls) {
    const endpointName = url.match(/models\/(.*?):/)?.[1] || "unknown-model";
    try {
      console.log(`[Cook AI Vision] Pantry attempt: ${endpointName}`);
      const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPantryPayloadFor(endpointName)),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.warn(
          `[Cook AI Vision] Pantry ${endpointName} failed (${response.status}):`,
          errText.slice(0, 280)
        );
        continue;
      }

      const data = await response.json();
      let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

      let items;
      try {
        items = JSON.parse(rawText);
      } catch {
        continue;
      }

      if (Array.isArray(items) && items.length > 0) {
        const normalized = normalizePantryItems(items);
        if (normalized.length > 0) {
          console.log(
            `[Cook AI Vision] Pantry SUCCESS — ${normalized.length} staples via ${endpointName}`
          );
          return normalized;
        }
      }
    } catch (err) {
      console.warn(`[Cook AI Vision] Pantry failed:`, err?.message);
    }
  }

  return getFallbackPantryItems();
}
