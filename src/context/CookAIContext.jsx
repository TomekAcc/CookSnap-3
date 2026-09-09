import React, { createContext, useContext, useState, useMemo, useCallback, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import {
  RECIPES,
  FALLBACK_RECIPES,
} from "../data/recipes";
import {
  analyzeFridgeImage,
  analyzePantryImage,
  classifyPantryItemLocal,
  translateIngredientNames,
} from "../services/geminiVision";
import {
  generateRecipesWithGemini,
  generatePlannerMealsWithGemini,
  modifyRecipeWithGemini,
  RECIPES_PER_SCAN,
} from "../services/geminiRecipes";
import {
  stampRecipeEmojis,
} from "../utils/imageUtils";
import { DIETARY_OPTIONS_DEFAULT } from "../data/dietaryOptions";
import * as Localization from "expo-localization";
import {
  DEFAULT_LANGUAGE_ID,
  LANGUAGE_OPTIONS,
  getLanguageById,
  matchDeviceLanguage,
} from "../data/languageOptions";
import { translate } from "../i18n";
import { useModalState } from "./ModalContext";
import { EXIT_DURATION_MS } from "../utils/bottomSheet";

const CookAIContext = createContext(null);

const PANTRY_STORAGE_KEY = "cookai:pantryItems:v1";
const PRO_STORAGE_KEY = "cookai:isPro:v1";
const SCAN_COUNT_STORAGE_KEY = "cookai:dailyFridgeScans:v1";
const PANTRY_SCAN_COUNT_STORAGE_KEY = "cookai:dailyPantryScans:v1";
const GENERATION_COUNT_STORAGE_KEY = "cookai:dailyRecipeGenCount:v1";
const FAVORITES_STORAGE_KEY = "cookai:favorites:v1";
const SAVED_RECIPES_STORAGE_KEY = "cookai:savedRecipes:v1";
const FRIDGE_PHOTO_STORAGE_KEY = "cookai:fridgePhoto:v1";
const SCAN_HISTORY_STORAGE_KEY = "cookai:scanHistory:v1";
const INGREDIENTS_STORAGE_KEY = "cookai:ingredients:v1";
const UNIT_SYSTEM_STORAGE_KEY = "cookai:unitSystem:v1";
const INGREDIENT_PRIORITY_STORAGE_KEY = "cookai:ingredientPriority:v1";
const RECIPE_LANGUAGE_STORAGE_KEY = "cookai:recipeLanguage:v1";
const ONBOARDING_STORAGE_KEY = "cookai:onboardingComplete:v1";
const SETTINGS_DONE_HINT_STORAGE_KEY = "cookai:settingsDoneHintShown:v1";
const DIETARY_RESTRICTIONS_STORAGE_KEY = "cookai:dietaryRestrictions:v1";
const CUSTOM_DIET_AVOID_STORAGE_KEY = "cookai:customDietAvoid:v1";
const CUSTOM_DIET_PREFER_STORAGE_KEY = "cookai:customDietPrefer:v1";

// Craving/mood quick-tag ids → plain-English flavor-mood phrasing for the
// prompt (never shown to the user — MealPreferences.jsx owns the
// translated labelKey for each id shown on-screen). Kept as fixed English
// tokens same as dishType/category, not run through t() — the prompt
// itself is always built in English regardless of the app's display
// language (see LANGUAGE block in geminiRecipes.js's buildPrompt).
const CRAVING_PROMPT_TEXT = {
  salty: "salty",
  spicy: "spicy",
  sweet: "sweet",
  savory: "bold, savory",
  light: "light and fresh",
  comfort: "comforting, hearty",
};
const SERVINGS_STORAGE_KEY = "cookai:servings:v1";
const HUNGER_LEVEL_STORAGE_KEY = "cookai:hungerLevel:v1";

/**
 * Copies a captured/picked fridge photo into a permanent, app-owned
 * directory (Paths.document) instead of leaving it at its original
 * ephemeral location — camera captures and gallery picks both land in
 * OS-managed cache/temp paths that are NOT guaranteed to survive an app
 * restart or a cache purge. Without this, `fridgePhoto` and `scanHistory`
 * thumbnails would silently break (broken image) even if the URI string
 * itself were persisted correctly, since the underlying file could already
 * be gone. Falls back to the original URI on any failure — a scan should
 * never be blocked by a storage-housekeeping step failing.
 */
function persistPhotoToDevice(sourceUri) {
  try {
    const scansDir = new Directory(Paths.document, "cookai-scans");
    scansDir.create({ intermediates: true, idempotent: true });
    const sourceFile = new File(sourceUri);
    const ext = sourceFile.extension || ".jpg";
    const destFile = new File(scansDir, `scan-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    sourceFile.copy(destFile);
    return destFile.uri;
  } catch (err) {
    console.warn("[Cook AI] Could not persist scan photo to device:", err?.message);
    return sourceUri;
  }
}
// Scanning a fridge is inherently infrequent — it rarely changes more than
// once every few days — so a low free cap barely constrains real usage.
// Regenerating recipe suggestions is what people actually repeat within a
// single session, and each one is its own Gemini text-generation call,
// making it the meaningful usage-based (and cost-based) lever. See
// FREE_DAILY_RECIPE_GENERATIONS below.
const FREE_DAILY_FRIDGE_SCANS = 2;
// Pantry scanning used to be deliberately left free/unlimited (see the old
// comment this replaced) — reversed after confirming pantry scans hit
// gemini-3.7-flash, the same pricier vision model fridge scans use, with no
// cap and no PRO gate at all. An unmetered path to the most expensive call
// in the app was a real, unbounded cost exposure (anyone could script
// repeated "scans" all day for free), not just a monetization gap. Same
// cap as fridge scans — no reason for pantry to be more or less restricted.
const FREE_DAILY_PANTRY_SCANS = 2;
const FREE_DAILY_RECIPE_GENERATIONS = 2;

// A single Scanner "generation" returns RECIPES_PER_SCAN (5) recipes at
// once, while a single Meal Planner day-generate returns exactly 1 — so
// the same 2-generations/day allowance is worth 5x more spent on Scanner
// than on Meal Planner. At the full 5, a free user could pull up to 10
// AI recipes a day indefinitely via Scanner alone, which made "unlimited"
// a weak PRO benefit (the free daily volume was already generous). This
// gives PRO a second, immediate, day-one benefit beyond just no daily cap
// — a fuller batch every time, not just more of them over time.
const FREE_RECIPES_PER_GENERATION = 3;

/** Local-date key (YYYY-MM-DD) — used to reset the free scan cap each day. */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Shared duplicate-check key — trims, lowercases, and collapses whitespace so
// "Olive Oil", " olive oil", and "olive  oil" all count as the same staple.
function normalizePantryName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Smart Append — NEVER overwrite. Strict case-insensitive dedupe.
 * Matches the mandated pattern; also strips dupes inside the incoming batch
 * and ensures stable ids for new rows.
 */
function mergeUniqueIngredients(prevItems, newScannedItems) {
  const existing = Array.isArray(prevItems) ? prevItems : [];
  const incoming = Array.isArray(newScannedItems) ? newScannedItems : [];

  const uniqueNew = incoming.filter(
    (newItem) =>
      !existing.some(
        (existingItem) =>
          String(existingItem?.name || "")
            .toLowerCase()
            .trim() ===
          String(newItem?.name || "")
            .toLowerCase()
            .trim()
      )
  );

  // Guard against duplicates within the same Gemini response
  const seen = new Set(
    existing.map((i) =>
      String(i?.name || "")
        .toLowerCase()
        .trim()
    )
  );
  const uniqueNewItems = [];
  for (const item of uniqueNew) {
    const key = String(item?.name || "")
      .toLowerCase()
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueNewItems.push({
      ...item,
      id:
        item?.id ||
        `ing-${Date.now()}-${existing.length + uniqueNewItems.length}-${Math.random()
          .toString(36)
          .slice(2, 7)}`,
    });
  }

  return [...existing, ...uniqueNewItems];
}

/** Brand-new users start with a clean, empty pantry — no seeded staples. */
function safePantryInit() {
  try {
    return [];
  } catch (err) {
    console.warn("[Cook AI] pantry init failed:", err?.message);
    return [];
  }
}

/**
 * Optional persisted state hydration hook-point.
 * Wrap any future AsyncStorage reads here so storage failures never red-screen.
 */
function safeStorageRead(reader, fallback) {
  try {
    const value = typeof reader === "function" ? reader() : fallback;
    return value == null ? fallback : value;
  } catch (err) {
    console.warn("[Cook AI] storage read failed, using fallback:", err?.message);
    return fallback;
  }
}

/** Sync emoji + vectorType stamp for recipe cards. */
function enrichRecipes(rawRecipes) {
  try {
    return stampRecipeEmojis(
      Array.isArray(rawRecipes) ? rawRecipes.filter(Boolean) : []
    );
  } catch (err) {
    console.warn("[Cook AI] enrichRecipes failed:", err?.message);
    return Array.isArray(rawRecipes)
      ? rawRecipes.filter(Boolean).slice(0, 5)
      : [];
  }
}
// Confirmed real bug, not a hypothetical: every single AI-generated recipe
// card showed the exact same "Uses 3 fridge items" badge, regardless of
// the recipe's actual content — because `r.matchCount || 3` below always
// fell through to the literal 3, since normalizeRecipe() in
// geminiRecipes.js never sets a numeric `matchCount` field (only a
// `matchBadge` *string*, which the card doesn't even read). A live test
// against the real API confirmed the AI itself generates recipes with
// genuinely varied ingredient counts (2-6 depending on the dish) — this
// was purely a display bug flattening all of that into a constant. Counts
// how many of the recipe's own ingredientsList entries actually reference
// one of the user's real scanned fridge items (case-insensitive substring
// match — ingredientsList entries are formatted like "1 lb Chicken Breast
// 🍗", so this is deliberately loose rather than an exact-string match).
function countFridgeMatches(ingredientsList, fridgeItems) {
  if (!Array.isArray(ingredientsList) || !Array.isArray(fridgeItems)) {
    return null;
  }
  const listText = ingredientsList.join(" | ").toLowerCase();
  let count = 0;
  for (const item of fridgeItems) {
    const name = String(item?.name || "").toLowerCase().trim();
    if (name && listText.includes(name)) count++;
  }
  return count;
}

function safeVisibleRecipes(
  generatedRecipes,
  mealType,
  hungerLevel,
  maxCount,
  fridgeItems
) {
  // Never show recipes before the user has actually generated any —
  // generatedRecipes stays null until generateRecipes() runs at least once,
  // so this is the one place we can tell "never generated" apart from
  // "generated but the API fell back to smart matches."
  if (generatedRecipes == null) return [];

  try {
    const source =
      Array.isArray(generatedRecipes) && generatedRecipes.length > 0
        ? generatedRecipes
        : FALLBACK_RECIPES || [];

    let stamped = enrichRecipes(source).slice(0, maxCount);

    // Guarantee exactly `maxCount` Soft UI emoji cards — this used to be
    // hardcoded to 5 regardless of caller, which silently re-padded a free
    // user's deliberately-smaller batch (generateRecipes requests only
    // FREE_RECIPES_PER_GENERATION) right back up to 5 with filler recipes,
    // completely undoing that free/PRO differentiation at the display
    // layer. Confirmed directly: a free user still saw exactly 5 cards
    // until this was threaded through.
    if (stamped.length < maxCount) {
      const fillers = enrichRecipes(FALLBACK_RECIPES || []);
      for (const filler of fillers) {
        if (stamped.length >= maxCount) break;
        if (
          stamped.some((r) => r.title === filler.title || r.id === filler.id)
        ) {
          continue;
        }
        stamped.push({
          ...filler,
          category: mealType !== "all" ? mealType : filler.category,
          cardIndex: stamped.length,
        });
      }
    }

    return stamped.slice(0, maxCount).map((r, idx) => {
      // Real fridge-item overlap when possible; a genuine per-recipe
      // ingredient count as a sane fallback (still varies card-to-card,
      // unlike the old flat 3) when there's no fridge inventory to match
      // against (e.g. a pantry-staples-only generation) or matching found
      // nothing. r.matchCount survives untouched for FALLBACK_RECIPES,
      // which already carry their own hand-set, genuinely varied values.
      const fridgeMatch = countFridgeMatches(r.ingredientsList, fridgeItems);
      const computedMatch =
        fridgeMatch != null && fridgeMatch > 0
          ? fridgeMatch
          : Array.isArray(r.ingredientsList)
            ? Math.max(r.ingredientsList.length, 1)
            : 3;
      return {
        ...r,
        cardIndex: idx,
        // Strip any leftover image / vector fields — emoji-only cards
        emoji: r.emoji,
        matchCount: r.matchCount || computedMatch,
      };
    });
  } catch (err) {
    console.warn("[Cook AI] visibleRecipes failed:", err?.message);
  }

  try {
    return enrichRecipes(FALLBACK_RECIPES || []).slice(0, maxCount);
  } catch {
    return [];
  }
}

export function CookAIProvider({ children }) {
  // Modal open/close state lives in its own context (see ModalContext.jsx) —
  // only pulled in here because addIngredient() needs to close its sheet.
  const { setAddIngredientOpen, setProModalOpen } = useModalState();
  const [activeTab, setActiveTab] = useState("scanner");
  const [ingredients, setIngredients] = useState([]);
  // Smart default instead of always "All" — a one-tap-to-change starting
  // point that's actually relevant to when someone opened the app, rather
  // than making them filter manually every single time. Lazy initializer
  // so this only runs once on mount, never fights a user's own selection
  // afterward. Late night has no clean single mapping among the five
  // options, so it falls back to "all" rather than forcing a bad guess.
  const [mealType, setMealType] = useState(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "breakfast";
    if (hour >= 11 && hour < 16) return "lunch";
    if (hour >= 16 && hour < 22) return "dinner";
    return "all";
  });
  const [servings, setServings] = useState(2);
  const [hungerLevel, setHungerLevel] = useState("normal");
  // Craving/mood quick-tags + one-off batch exclusion — deliberately NOT
  // persisted to AsyncStorage, same as mealType above: this is "what am I
  // in the mood for right now," not a standing preference like the diet
  // toggles or Custom Diet. Free for every tier, not PRO-gated — it's a
  // lightweight steering nudge, not a safety-relevant allergy declaration.
  const [cravingTags, setCravingTags] = useState([]);
  const toggleCravingTag = useCallback((id) => {
    setCravingTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }, []);
  const [excludeThisBatch, setExcludeThisBatch] = useState("");

  // Ingredient Source Priority — persisted standing preference, same
  // hydrate-once-then-persist-on-change pattern as unitSystem elsewhere in
  // this file: "balanced" (default, current behavior, never added to the
  // prompt) | "fridge" | "pantry". Soft steering only (see buildPrompt's
  // INVENTORY LOCK section in geminiRecipes.js) — it changes which list a
  // recipe leans on more, never what's allowed at all, so unlike Custom
  // Diet this needs no code-level safety net.
  const [ingredientPriority, setIngredientPriorityState] = useState("balanced");
  const [ingredientPriorityHydrated, setIngredientPriorityHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(INGREDIENT_PRIORITY_STORAGE_KEY);
        if (!cancelled && (raw === "fridge" || raw === "pantry" || raw === "balanced")) {
          setIngredientPriorityState(raw);
        }
      } catch (err) {
        console.warn("[Cook AI] ingredient priority hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setIngredientPriorityHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ingredientPriorityHydrated) return;
    AsyncStorage.setItem(INGREDIENT_PRIORITY_STORAGE_KEY, ingredientPriority).catch((err) =>
      console.warn("[Cook AI] ingredient priority persist failed:", err?.message)
    );
  }, [ingredientPriorityHydrated, ingredientPriority]);

  const setIngredientPriority = useCallback((next) => {
    setIngredientPriorityState(
      next === "fridge" || next === "pantry" ? next : "balanced"
    );
  }, []);

  // Favorites id list — dish #1 liked by default (🤍 → ❤️)
  const [favorites, setFavorites] = useState([1]);
  // Seed Saved tab with recipe #1 so heart state matches favorites
  const [savedRecipes, setSavedRecipes] = useState(() =>
    safeStorageRead(() => {
      const first = (RECIPES || FALLBACK_RECIPES || []).find(
        (r) => r && String(r.id) === "1"
      );
      return first ? enrichRecipes([first]) : [];
    }, [])
  );
  const [pantryItems, setPantryItems] = useState(safePantryInit);

  // Saved-recipe persistence — favorites[] and savedRecipes[] were
  // previously plain useState with no AsyncStorage backing at all, so
  // every heart tap was lost the instant the app restarted. Same
  // hydrate-once-then-persist pattern as pantry below: `savedHydrated`
  // gates the persist effect so a restart can't overwrite real saved data
  // with the default single-recipe seed before the read resolves.
  const [savedHydrated, setSavedHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawFavorites, rawSaved] = await Promise.all([
          AsyncStorage.getItem(FAVORITES_STORAGE_KEY),
          AsyncStorage.getItem(SAVED_RECIPES_STORAGE_KEY),
        ]);
        if (!cancelled && rawFavorites) {
          const parsed = JSON.parse(rawFavorites);
          if (Array.isArray(parsed)) setFavorites(parsed);
        }
        if (!cancelled && rawSaved) {
          const parsed = JSON.parse(rawSaved);
          if (Array.isArray(parsed)) setSavedRecipes(parsed);
        }
      } catch (err) {
        console.warn("[Cook AI] saved recipes hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setSavedHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!savedHydrated) return;
    AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites)).catch(
      (err) => console.warn("[Cook AI] favorites persist failed:", err?.message)
    );
  }, [savedHydrated, favorites]);

  useEffect(() => {
    if (!savedHydrated) return;
    AsyncStorage.setItem(
      SAVED_RECIPES_STORAGE_KEY,
      JSON.stringify(savedRecipes)
    ).catch((err) =>
      console.warn("[Cook AI] savedRecipes persist failed:", err?.message)
    );
  }, [savedHydrated, savedRecipes]);

  // Pantry persistence — hydrate once from AsyncStorage on mount, then
  // persist every subsequent change. `hydrated` gates the persist effect so
  // we never overwrite a user's saved pantry with the default seed before
  // the read has resolved.
  const [pantryHydrated, setPantryHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PANTRY_STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setPantryItems(parsed);
        }
      } catch (err) {
        console.warn("[Cook AI] pantry hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setPantryHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pantryHydrated) return;
    AsyncStorage.setItem(PANTRY_STORAGE_KEY, JSON.stringify(pantryItems)).catch(
      (err) => console.warn("[Cook AI] pantry persist failed:", err?.message)
    );
  }, [pantryHydrated, pantryItems]);

  // ─── PRO entitlement (LOCAL MOCK — no real payment processor wired up) ───
  // `isPro` here is a locally-persisted flag flipped by activatePro(), which
  // ProSubscriptionModal's "Start Free Trial" button calls directly. There
  // is no RevenueCat / StoreKit / Play Billing integration — hooking up a
  // real payment SDK requires App Store Connect product IDs and API
  // credentials that live outside this codebase. activatePro() is the exact
  // spot a real `Purchases.purchasePackage(...)` call would replace this.
  const [isPro, setIsPro] = useState(false);
  const [proHydrated, setProHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PRO_STORAGE_KEY);
        if (!cancelled && raw === "true") setIsPro(true);
      } catch (err) {
        console.warn("[Cook AI] pro entitlement hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setProHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!proHydrated) return;
    AsyncStorage.setItem(PRO_STORAGE_KEY, isPro ? "true" : "false").catch((err) =>
      console.warn("[Cook AI] pro entitlement persist failed:", err?.message)
    );
  }, [proHydrated, isPro]);

  /** Mock trial activation — see the PRO entitlement note above. */
  const activatePro = useCallback(() => {
    setIsPro(true);
  }, []);

  /**
   * Testing-only reset — there's no real subscription to cancel yet (see
   * the PRO entitlement note above), so once a device flips isPro on via
   * activatePro() there was previously no way back to reviewing the free
   * tier short of clearing app storage entirely. Exposed via a clearly
   * "testing" toggle in Settings, not framed as real subscription
   * management.
   */
  const deactivatePro = useCallback(() => {
    setIsPro(false);
  }, []);

  // ─── Daily free-tier fridge scan cap ───
  const [dailyFridgeScanCount, setDailyFridgeScanCount] = useState(0);
  const [scanCountHydrated, setScanCountHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SCAN_COUNT_STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.date === todayKey()) {
            setDailyFridgeScanCount(Number(parsed.count) || 0);
          }
          // Different date (or malformed) → leave at 0, a fresh day.
        }
      } catch (err) {
        console.warn("[Cook AI] scan count hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setScanCountHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!scanCountHydrated) return;
    AsyncStorage.setItem(
      SCAN_COUNT_STORAGE_KEY,
      JSON.stringify({ date: todayKey(), count: dailyFridgeScanCount })
    ).catch((err) =>
      console.warn("[Cook AI] scan count persist failed:", err?.message)
    );
  }, [scanCountHydrated, dailyFridgeScanCount]);

  const canScanFridge = isPro || dailyFridgeScanCount < FREE_DAILY_FRIDGE_SCANS;

  /** Call right before opening the fridge camera. Returns false + does not
   *  increment when the free daily cap is already hit — caller should show
   *  the paywall in that case instead of proceeding. */
  const registerFridgeScanAttempt = useCallback(() => {
    if (isPro) return true;
    if (dailyFridgeScanCount >= FREE_DAILY_FRIDGE_SCANS) return false;
    setDailyFridgeScanCount((prev) => prev + 1);
    return true;
  }, [isPro, dailyFridgeScanCount]);

  // ─── Daily free-tier pantry scan cap ───
  // Same shape as the fridge scan cap above, and deliberately the same
  // limit — pantry scans hit gemini-3.7-flash, the same pricier vision
  // model fridge scans use, so there's no cost reason to treat them
  // differently. This used to be free/unlimited by explicit product
  // direction; reversed after confirming that left the single most
  // expensive call in the app reachable with no cap and no PRO gate at
  // all — a real, unbounded cost exposure, not just a monetization gap.
  const [dailyPantryScanCount, setDailyPantryScanCount] = useState(0);
  const [pantryScanCountHydrated, setPantryScanCountHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PANTRY_SCAN_COUNT_STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.date === todayKey()) {
            setDailyPantryScanCount(Number(parsed.count) || 0);
          }
        }
      } catch (err) {
        console.warn("[Cook AI] pantry scan count hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setPantryScanCountHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pantryScanCountHydrated) return;
    AsyncStorage.setItem(
      PANTRY_SCAN_COUNT_STORAGE_KEY,
      JSON.stringify({ date: todayKey(), count: dailyPantryScanCount })
    ).catch((err) =>
      console.warn("[Cook AI] pantry scan count persist failed:", err?.message)
    );
  }, [pantryScanCountHydrated, dailyPantryScanCount]);

  const canScanPantry = isPro || dailyPantryScanCount < FREE_DAILY_PANTRY_SCANS;

  /** Call right before opening the pantry camera. Same contract as
   *  registerFridgeScanAttempt. */
  const registerPantryScanAttempt = useCallback(() => {
    if (isPro) return true;
    if (dailyPantryScanCount >= FREE_DAILY_PANTRY_SCANS) return false;
    setDailyPantryScanCount((prev) => prev + 1);
    return true;
  }, [isPro, dailyPantryScanCount]);

  // ─── Daily free-tier recipe-generation cap ───
  // Same hydrate-once/persist/reset-daily pattern as the fridge scan cap
  // above — see FREE_DAILY_RECIPE_GENERATIONS for why this is the cap that
  // actually matters. Counts both the initial "Generate AI Recipes" and
  // every "Regenerate" tap on the Scanner screen equally.
  const [dailyRecipeGenerationCount, setDailyRecipeGenerationCount] = useState(0);
  const [generationCountHydrated, setGenerationCountHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(GENERATION_COUNT_STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.date === todayKey()) {
            setDailyRecipeGenerationCount(Number(parsed.count) || 0);
          }
          // Different date (or malformed) → leave at 0, a fresh day.
        }
      } catch (err) {
        console.warn("[Cook AI] generation count hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setGenerationCountHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!generationCountHydrated) return;
    AsyncStorage.setItem(
      GENERATION_COUNT_STORAGE_KEY,
      JSON.stringify({ date: todayKey(), count: dailyRecipeGenerationCount })
    ).catch((err) =>
      console.warn("[Cook AI] generation count persist failed:", err?.message)
    );
  }, [generationCountHydrated, dailyRecipeGenerationCount]);

  const canGenerateRecipes =
    isPro || dailyRecipeGenerationCount < FREE_DAILY_RECIPE_GENERATIONS;

  /** Call right before generateRecipes(). Returns false + does not
   *  increment when the free daily cap is already hit — caller should show
   *  the paywall in that case instead of proceeding. */
  const registerRecipeGenerationAttempt = useCallback(() => {
    if (isPro) return true;
    if (dailyRecipeGenerationCount >= FREE_DAILY_RECIPE_GENERATIONS) return false;
    setDailyRecipeGenerationCount((prev) => prev + 1);
    return true;
  }, [isPro, dailyRecipeGenerationCount]);

  const [isGeneratingRecipes, setIsGeneratingRecipes] = useState(false);
  const [generatedRecipes, setGeneratedRecipes] = useState(null);
  // True only when a generate/regenerate call failed AND there was no
  // previous real batch on screen to fall back to — RecipeFeed uses this to
  // show an honest "couldn't generate" state instead of nothing at all.
  // Never paired with fake/template recipes: on failure we either keep
  // showing the last real batch (this stays false) or show no cards at all
  // (this becomes true) — never a fabricated batch dressed up as real.
  const [recipeGenerationFailed, setRecipeGenerationFailed] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  // null until an append-mode ("Scan More") scan sets an explicit label —
  // the render side falls back to the translated default/step text so
  // this never needs a value baked in before `t` exists.
  const [scanningLabel, setScanningLabel] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [fridgePhoto, setFridgePhoto] = useState(null);
  /** Next capture appends to existing ingredients (Scan More) instead of replacing. */
  const scanAppendModeRef = useRef(false);

  // Pantry's counterparts to isScanning/cameraOpen/fridgePhoto above — see
  // the pantryScanSessionIdRef comment further down for why these live
  // here instead of as PantryScannerHero component state.
  const [isPantryScanning, setIsPantryScanning] = useState(false);
  const [pantryCameraOpen, setPantryCameraOpen] = useState(false);
  const [pantryPhoto, setPantryPhoto] = useState(null);

  const [scanHistory, setScanHistory] = useState([]);
  // fridgePhoto + scanHistory + ingredients persistence — same hydrate-once-
  // then-persist pattern as pantry/favorites above. fridgePhoto/scanHistory
  // now store permanent Paths.document URIs (see persistPhotoToDevice), so
  // a restored URI still resolves to a real file after an app restart.
  // ingredients is included here too — persisting the photo without the
  // ingredients it produced would restore a fridge photo next to an empty
  // list, which is a more confusing state than neither persisting at all.
  const [scanDataHydrated, setScanDataHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawPhoto, rawHistory, rawIngredients] = await Promise.all([
          AsyncStorage.getItem(FRIDGE_PHOTO_STORAGE_KEY),
          AsyncStorage.getItem(SCAN_HISTORY_STORAGE_KEY),
          AsyncStorage.getItem(INGREDIENTS_STORAGE_KEY),
        ]);
        if (!cancelled && rawPhoto) setFridgePhoto(JSON.parse(rawPhoto));
        if (!cancelled && rawHistory) {
          const parsed = JSON.parse(rawHistory);
          if (Array.isArray(parsed)) setScanHistory(parsed);
        }
        if (!cancelled && rawIngredients) {
          const parsed = JSON.parse(rawIngredients);
          if (Array.isArray(parsed)) setIngredients(parsed);
        }
      } catch (err) {
        console.warn("[Cook AI] scan data hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setScanDataHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!scanDataHydrated) return;
    AsyncStorage.setItem(
      FRIDGE_PHOTO_STORAGE_KEY,
      JSON.stringify(fridgePhoto)
    ).catch((err) =>
      console.warn("[Cook AI] fridgePhoto persist failed:", err?.message)
    );
  }, [scanDataHydrated, fridgePhoto]);

  useEffect(() => {
    if (!scanDataHydrated) return;
    AsyncStorage.setItem(
      SCAN_HISTORY_STORAGE_KEY,
      JSON.stringify(scanHistory)
    ).catch((err) =>
      console.warn("[Cook AI] scanHistory persist failed:", err?.message)
    );
  }, [scanDataHydrated, scanHistory]);

  useEffect(() => {
    if (!scanDataHydrated) return;
    AsyncStorage.setItem(
      INGREDIENTS_STORAGE_KEY,
      JSON.stringify(ingredients)
    ).catch((err) =>
      console.warn("[Cook AI] ingredients persist failed:", err?.message)
    );
  }, [scanDataHydrated, ingredients]);

  // Confirmed real failure, not a hypothetical: this and servings/hungerLevel
  // below were plain useState with no AsyncStorage read/write at all — every
  // one of them (dietary restrictions included, the single most safety-
  // relevant setting in the app) silently reset to its default the moment
  // the app restarted. A user who set "Vegan" once would see it vanish on
  // the next launch and get non-vegan recipes with no warning. Same
  // hydrate-once-then-persist-on-change pattern as unitSystem below.
  const [dietaryRestrictions, setDietaryRestrictions] = useState(
    DIETARY_OPTIONS_DEFAULT
  );
  const [dietaryRestrictionsHydrated, setDietaryRestrictionsHydrated] =
    useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DIETARY_RESTRICTIONS_STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            setDietaryRestrictions({ ...DIETARY_OPTIONS_DEFAULT, ...parsed });
          }
        }
      } catch (err) {
        console.warn("[Cook AI] dietary restrictions hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setDietaryRestrictionsHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dietaryRestrictionsHydrated) return;
    AsyncStorage.setItem(
      DIETARY_RESTRICTIONS_STORAGE_KEY,
      JSON.stringify(dietaryRestrictions)
    ).catch((err) =>
      console.warn("[Cook AI] dietary restrictions persist failed:", err?.message)
    );
  }, [dietaryRestrictionsHydrated, dietaryRestrictions]);

  // PRO-only Custom Diet — raw comma-separated text, same hydrate-once-
  // then-persist-on-change pattern as dietaryRestrictions above. Stored
  // under their own keys (plain strings, not the boolean map) so they
  // don't interfere with FULL_DIETARY_OPTIONS' fixed id set. Kept even if
  // the user's PRO status later lapses — dietaryRestrictionsWithCustom
  // below is what actually gates whether they reach generation, so a
  // lapsed-then-renewed PRO user gets their list back instead of having
  // to retype it.
  const [customDietAvoid, setCustomDietAvoid] = useState("");
  const [customDietPrefer, setCustomDietPrefer] = useState("");
  const [customDietHydrated, setCustomDietHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [avoidRaw, preferRaw] = await Promise.all([
          AsyncStorage.getItem(CUSTOM_DIET_AVOID_STORAGE_KEY),
          AsyncStorage.getItem(CUSTOM_DIET_PREFER_STORAGE_KEY),
        ]);
        if (!cancelled) {
          if (avoidRaw != null) setCustomDietAvoid(avoidRaw);
          if (preferRaw != null) setCustomDietPrefer(preferRaw);
        }
      } catch (err) {
        console.warn("[Cook AI] custom diet hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setCustomDietHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!customDietHydrated) return;
    AsyncStorage.setItem(CUSTOM_DIET_AVOID_STORAGE_KEY, customDietAvoid).catch((err) =>
      console.warn("[Cook AI] custom diet avoid persist failed:", err?.message)
    );
  }, [customDietHydrated, customDietAvoid]);

  useEffect(() => {
    if (!customDietHydrated) return;
    AsyncStorage.setItem(CUSTOM_DIET_PREFER_STORAGE_KEY, customDietPrefer).catch((err) =>
      console.warn("[Cook AI] custom diet prefer persist failed:", err?.message)
    );
  }, [customDietHydrated, customDietPrefer]);

  // What every generation call actually receives — dietaryRestrictions
  // (the boolean preset map) with customAvoid/customPrefer/craving riding
  // along on the same object (see buildDietaryGuardrail/getDietViolation
  // in geminiRecipes.js for why: every one of their ~10 call sites already
  // threads this exact object through untouched, so piggybacking here
  // needs zero signature changes downstream).
  //
  // customAvoid merges TWO sources with different gating: the persisted
  // PRO Custom Diet list (gated on isPro, same as any other PRO feature —
  // a lapsed-PRO user's typed list stays saved but stops affecting
  // generation) and excludeThisBatch, the free-for-everyone one-off
  // exclusion from the craving quick-tags row. Both get the SAME hard
  // enforcement via getDietViolation's keyword safety net — "exclude
  // ingredient X for this batch" is a real exclusion, not just a prompt
  // suggestion, even though it's never saved anywhere.
  const parseCustomDietList = (text) =>
    String(text || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const dietaryRestrictionsWithCustom = useMemo(() => {
    const proAvoid = isPro ? parseCustomDietList(customDietAvoid) : [];
    const proPrefer = isPro ? parseCustomDietList(customDietPrefer) : [];
    const batchAvoid = parseCustomDietList(excludeThisBatch);
    const avoid = [...new Set([...proAvoid, ...batchAvoid])];
    const prefer = proPrefer;
    const craving = Array.isArray(cravingTags)
      ? cravingTags
          .map((id) => CRAVING_PROMPT_TEXT[id])
          .filter(Boolean)
      : [];
    const priority =
      ingredientPriority === "fridge" || ingredientPriority === "pantry"
        ? ingredientPriority
        : undefined;
    if (
      avoid.length === 0 &&
      prefer.length === 0 &&
      craving.length === 0 &&
      !priority
    ) {
      return dietaryRestrictions;
    }
    return {
      ...dietaryRestrictions,
      customAvoid: avoid,
      customPrefer: prefer,
      craving,
      ingredientPriority: priority,
    };
  }, [
    dietaryRestrictions,
    customDietAvoid,
    customDietPrefer,
    excludeThisBatch,
    cravingTags,
    ingredientPriority,
    isPro,
  ]);

  const [includePantryStaples, setIncludePantryStaples] = useState(true);

  // Same real failure as dietaryRestrictions above — servings and hunger
  // level (declared near the top of this component, with mealType) reset
  // to their defaults (2 people, "normal") on every restart instead of
  // remembering the user's last choice.
  const [mealPrefsHydrated, setMealPrefsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawServings, rawHunger] = await Promise.all([
          AsyncStorage.getItem(SERVINGS_STORAGE_KEY),
          AsyncStorage.getItem(HUNGER_LEVEL_STORAGE_KEY),
        ]);
        if (!cancelled && rawServings) {
          const parsedServings = parseInt(rawServings, 10);
          if (Number.isFinite(parsedServings) && parsedServings > 0) {
            setServings(parsedServings);
          }
        }
        if (!cancelled && rawHunger) {
          setHungerLevel(rawHunger);
        }
      } catch (err) {
        console.warn("[Cook AI] meal prefs hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setMealPrefsHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mealPrefsHydrated) return;
    AsyncStorage.setItem(SERVINGS_STORAGE_KEY, String(servings)).catch((err) =>
      console.warn("[Cook AI] servings persist failed:", err?.message)
    );
  }, [mealPrefsHydrated, servings]);

  useEffect(() => {
    if (!mealPrefsHydrated) return;
    AsyncStorage.setItem(HUNGER_LEVEL_STORAGE_KEY, hungerLevel).catch((err) =>
      console.warn("[Cook AI] hunger level persist failed:", err?.message)
    );
  }, [mealPrefsHydrated, hungerLevel]);

  // Recipe measurement system — "us" (cups/tbsp/°F) or "metric" (g/ml/°C).
  // User explicitly asked NOT to show both units at once (a prior fix had
  // shown dual units inline everywhere); this is a persisted single choice
  // that's threaded into every Gemini recipe prompt so generated recipes
  // come back in exactly one system, never mixed.
  const [unitSystem, setUnitSystemState] = useState("us");
  const [unitSystemHydrated, setUnitSystemHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(UNIT_SYSTEM_STORAGE_KEY);
        if (!cancelled && (raw === "metric" || raw === "us")) {
          setUnitSystemState(raw);
        }
      } catch (err) {
        console.warn("[Cook AI] unit system hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setUnitSystemHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!unitSystemHydrated) return;
    AsyncStorage.setItem(UNIT_SYSTEM_STORAGE_KEY, unitSystem).catch((err) =>
      console.warn("[Cook AI] unit system persist failed:", err?.message)
    );
  }, [unitSystemHydrated, unitSystem]);

  const setUnitSystem = useCallback((next) => {
    setUnitSystemState(next === "metric" ? "metric" : "us");
  }, []);

  // Recipe output language — persisted the same way as unitSystem. Drives
  // both the language Gemini writes recipe titles/ingredients/steps in
  // (task #28) AND the app's own UI chrome text via `t()` below — the two
  // were deliberately unified into one setting rather than kept separate.
  //
  // First launch (nothing persisted yet) auto-detects from the device's
  // own language setting via expo-localization rather than defaulting to
  // English outright — matches the device's preferred language against
  // LANGUAGE_OPTIONS, falling back to English only when the device
  // language isn't one we support. Still fully overridable in Settings,
  // and whatever the user picks there always wins from then on.
  const [recipeLanguageId, setRecipeLanguageIdState] = useState(
    DEFAULT_LANGUAGE_ID
  );
  const [recipeLanguageHydrated, setRecipeLanguageHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(RECIPE_LANGUAGE_STORAGE_KEY);
        if (!cancelled && raw && LANGUAGE_OPTIONS.some((l) => l.id === raw)) {
          setRecipeLanguageIdState(raw);
        } else if (!cancelled) {
          const deviceCode = Localization.getLocales?.()?.[0]?.languageCode;
          setRecipeLanguageIdState(matchDeviceLanguage(deviceCode));
        }
      } catch (err) {
        console.warn("[Cook AI] recipe language hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setRecipeLanguageHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!recipeLanguageHydrated) return;
    AsyncStorage.setItem(
      RECIPE_LANGUAGE_STORAGE_KEY,
      recipeLanguageId
    ).catch((err) =>
      console.warn("[Cook AI] recipe language persist failed:", err?.message)
    );
  }, [recipeLanguageHydrated, recipeLanguageId]);

  const setRecipeLanguageId = useCallback((next) => {
    setRecipeLanguageIdState(
      LANGUAGE_OPTIONS.some((l) => l.id === next) ? next : DEFAULT_LANGUAGE_ID
    );
  }, []);

  // English name (e.g. "Polish") threaded into every Gemini prompt — the
  // model is instructed in English regardless of which language the
  // recipe text itself should come back in.
  const recipeLanguageName = useMemo(
    () => getLanguageById(recipeLanguageId).englishName,
    [recipeLanguageId]
  );

  // Auto-translates already-scanned fridge/pantry item names when the
  // language actually changes (not on first mount/hydration) — these are
  // free-text AI-detected names with no translation-key system of their
  // own, unlike the rest of the UI driven by t(), so switching the app
  // language alone doesn't touch them; without this they'd silently stay
  // in whatever language they were first scanned in forever. Fire-and-
  // forget: never blocks the switch itself, and any failure just leaves
  // the names as they were.
  const inventoryLangTrackerRef = useRef(null);
  useEffect(() => {
    if (!recipeLanguageHydrated || !scanDataHydrated || !pantryHydrated) return;
    if (inventoryLangTrackerRef.current === null) {
      // First render after everything's hydrated — this already IS the
      // language the current inventory was captured in (or close enough);
      // just record it, don't fire a translate pass on mount.
      inventoryLangTrackerRef.current = recipeLanguageId;
      return;
    }
    if (inventoryLangTrackerRef.current === recipeLanguageId) return;
    inventoryLangTrackerRef.current = recipeLanguageId;

    let cancelled = false;
    (async () => {
      if (ingredients.length > 0) {
        try {
          const translated = await translateIngredientNames(ingredients, recipeLanguageName);
          if (!cancelled) setIngredients(translated);
        } catch (err) {
          console.warn("[Cook AI] Fridge inventory auto-translate failed:", err?.message);
        }
      }
      if (pantryItems.length > 0) {
        try {
          const translated = await translateIngredientNames(pantryItems, recipeLanguageName);
          if (!cancelled) setPantryItems(translated);
        } catch (err) {
          console.warn("[Cook AI] Pantry auto-translate failed:", err?.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately keyed only on the language + hydration flags — ingredients/
    // pantryItems are read from the closure at switch time, not tracked as
    // triggers, so this never re-fires just because the inventory itself changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeLanguageId, recipeLanguageHydrated, scanDataHydrated, pantryHydrated, recipeLanguageName]);

  // `t()` — the SAME recipeLanguageId now drives both recipe generation
  // AND app UI text, deliberately not a second separate setting. Changing
  // it in Settings re-renders every consumer instantly (ordinary React
  // context propagation — no restart needed), since every translated
  // string is looked up live through this function rather than cached.
  const t = useCallback(
    (key, vars) => translate(recipeLanguageId, key, vars),
    [recipeLanguageId]
  );

  // First-launch onboarding gate — App.jsx shows a language + units picker
  // instead of the main shell until this flips true. `onboardingHydrated`
  // is what App.jsx actually waits on before deciding what to render — an
  // existing user must never see the gate flash while AsyncStorage is
  // still being read, so the gate stays hidden (nothing renders yet)
  // until hydration resolves either way.
  const [onboardingComplete, setOnboardingCompleteState] = useState(false);
  const [onboardingHydrated, setOnboardingHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (!cancelled && raw === "true") setOnboardingCompleteState(true);
      } catch (err) {
        console.warn("[Cook AI] onboarding hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setOnboardingHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completeOnboarding = useCallback(() => {
    setOnboardingCompleteState(true);
    AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true").catch((err) =>
      console.warn("[Cook AI] onboarding persist failed:", err?.message)
    );
  }, []);

  // Testing-only escape hatch (Settings > Testing) — replays the
  // first-launch onboarding flow (language/units + the PRO intro screen)
  // without needing to uninstall/reinstall the app to clear AsyncStorage.
  const resetOnboarding = useCallback(() => {
    setOnboardingCompleteState(false);
    AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY).catch((err) =>
      console.warn("[Cook AI] onboarding reset failed:", err?.message)
    );
    // Replaying onboarding is meant to simulate a genuine first-time user
    // end to end — that includes Settings' one-time "Done" hint below,
    // not just the onboarding screens themselves.
    setSettingsDoneHintShownState(false);
    AsyncStorage.removeItem(SETTINGS_DONE_HINT_STORAGE_KEY).catch((err) =>
      console.warn("[Cook AI] settings done-hint reset failed:", err?.message)
    );
  }, []);

  // Confirmed real feedback: Settings' sticky "Done" button only earns its
  // keep the very first time someone lands there — by any later visit,
  // they've already learned the screen has a way out and the extra button
  // just adds noise. SettingsScreen reads this flag once per mount (via
  // its own lazy useState initializer, not live) so it still shows for
  // that first visit even though this flips true the moment it mounts.
  const [settingsDoneHintShown, setSettingsDoneHintShownState] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_DONE_HINT_STORAGE_KEY);
        if (!cancelled && raw === "true") setSettingsDoneHintShownState(true);
      } catch (err) {
        console.warn("[Cook AI] settings done-hint hydrate failed:", err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markSettingsDoneHintShown = useCallback(() => {
    setSettingsDoneHintShownState(true);
    AsyncStorage.setItem(SETTINGS_DONE_HINT_STORAGE_KEY, "true").catch((err) =>
      console.warn("[Cook AI] settings done-hint persist failed:", err?.message)
    );
  }, []);

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const scrollViewRef = useRef(null);
  const recipesSectionYRef = useRef(0);
  const scanSessionIdRef = useRef(0);
  const pendingDetectedRef = useRef(null);
  const ingredientsCommittedRef = useRef(false);
  const scanAwaitTimerRef = useRef(null);
  const scanMetaRef = useRef({ photoUri: null, source: "camera" });
  // Pantry's own copy of the fridge scan refs directly above — same
  // fire-and-forget-then-poll pattern, kept in context (not component-local
  // state) for the same reason: confirmed real complaint, a user leaves the
  // Pantry tab mid- or right-after a scan and the scanned photo/result
  // vanishes on return, even though the items were actually detected and
  // merged. Component-local state gets wiped the instant PantryTab
  // unmounts (this app switches tabs via a plain conditional render, not a
  // persistent navigator); these refs and the pantryPhoto/isPantryScanning
  // state below live on the provider instead, so an in-flight or just-
  // finished scan survives navigating away and back exactly like fridge.
  const pantryScanSessionIdRef = useRef(0);
  const pantryPendingDetectedRef = useRef(null);
  const pantryIngredientsCommittedRef = useRef(false);
  const pantryScanAwaitTimerRef = useRef(null);
  const [recipesSectionY, setRecipesSectionY] = useState(0);
  const [scanStartedAt, setScanStartedAt] = useState(null);

  const updateRecipesSectionY = useCallback((y) => {
    const next = typeof y === "number" && Number.isFinite(y) ? y : 0;
    recipesSectionYRef.current = next;
    setRecipesSectionY(next);
  }, []);

  /** Scroll so the recipes header sits just under the top edge (12px breathing room).
   *
   * Previously tried measureLayout() against a ref to the RecipeFeed
   * wrapper for a "can't go stale" measurement, but that throws
   * synchronously ("ref.measureLayout must be called with a ref to a
   * native component") on this View — confirmed by a live crash report —
   * rather than falling through to the failure callback, so there was no
   * safe way to catch it. Back to the plain onLayout-cached Y, which is
   * the version that was actually working. */
  const scrollToRecipesTop = useCallback(() => {
    const scroll = () => {
      const y = Math.max((recipesSectionYRef.current || 0) - 12, 0);
      scrollViewRef.current?.scrollTo?.({ y, animated: true });
    };
    // First pass after commit; second after recipe cards finish laying out.
    requestAnimationFrame(() => {
      setTimeout(scroll, 80);
      setTimeout(scroll, 280);
    });
  }, []);

  const hasScanned = !!fridgePhoto;
  const hasPantryScanned = !!pantryPhoto;

  const visibleRecipes = useMemo(
    () =>
      safeVisibleRecipes(
        generatedRecipes,
        mealType,
        hungerLevel,
        isPro ? RECIPES_PER_SCAN : FREE_RECIPES_PER_GENERATION,
        ingredients
      ),
    [generatedRecipes, mealType, hungerLevel, isPro, ingredients]
  );

  const showToast = useCallback((message, type = "info", duration = 3200) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  const removeIngredient = useCallback((id) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const addIngredient = useCallback((item) => {
    setIngredients((prev) => mergeUniqueIngredients(prev, [item]));
    setAddIngredientOpen(false);
  }, []);

  /** Merge new vision items — append only, never overwrite; de-dupe by name. */
  const appendIngredients = useCallback((newItems) => {
    const incoming = Array.isArray(newItems) ? newItems : [];
    if (!incoming.length) return;
    setIngredients((prev) => mergeUniqueIngredients(prev, incoming));
  }, []);

  const pushScanHistory = useCallback((photoUri, source, itemCount, snapshotIngredients) => {
    setScanHistory((prev) => [
      {
        id: `${Date.now()}`,
        photoUri,
        source,
        itemCount,
        // Full ingredient snapshot at scan time — lets restoreScan bring
        // back exactly what this scan detected, not just a photo + count.
        ingredients: Array.isArray(snapshotIngredients) ? snapshotIngredients : [],
        date: new Date().toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      },
      ...prev,
    ].slice(0, 10));
  }, []);

  /**
   * Bring back a past scan from history — restores its photo + the
   * ingredients detected at that time as the active scan. Older history
   * entries saved before ingredient snapshots existed fall back to just
   * restoring the photo (their `ingredients` array is empty).
   */
  const restoreScan = useCallback(
    (scanId) => {
      const entry = scanHistory.find((s) => s.id === scanId);
      if (!entry) return;
      setFridgePhoto(entry.photoUri);
      if (entry.ingredients?.length) setIngredients(entry.ingredients);
      setGeneratedRecipes(null);
      setIsGeneratingRecipes(false);
      scanMetaRef.current = { photoUri: entry.photoUri, source: entry.source || "camera" };
      setActiveTab("scanner");
    },
    [scanHistory]
  );

  /**
   * Instant Vision scan — AI runs immediately; UI choreography (laser/radar)
   * commits ingredients via endScanChoreography when progress hits 100%.
   * Scan More sets append mode → new items merge into existing list.
   */
  const completeScan = useCallback(async (photoUri, source = "camera") => {
    const rawUri = Array.isArray(photoUri) ? photoUri[0] : photoUri;
    if (!rawUri || typeof rawUri !== "string") {
      console.warn("[Cook AI] completeScan called with no photo");
      return;
    }
    // Every real scan funnels through here regardless of entry point (main
    // Take Photo/Gallery on the fridge photo, or the Scan More popover's
    // Take Photo/Gallery) — gating the free daily cap at this single choke
    // point means no current or future entry point can bypass it (an
    // earlier version of Scan More did exactly that), and the allowance is
    // only ever consumed once a real photo exists to scan, never burned on
    // a permission denial or a cancelled camera/picker upstream.
    if (!registerFridgeScanAttempt()) {
      // completeScan() runs right after the camera Modal closes (see
      // handleCapture in FridgeScannerHero) — a bare setProModalOpen(true)
      // here would try to mount a second native Modal while that one is
      // still mid-dismissal, the same proven-on-device iOS multi-Modal
      // freeze already fixed for Meal Planner and Scan More.
      setTimeout(() => setProModalOpen?.(true), EXIT_DURATION_MS + 40);
      return;
    }
    // Copy into permanent app storage immediately — the original camera/
    // gallery URI lives in an OS-managed cache/temp location that isn't
    // guaranteed to survive an app restart. Everything downstream (vision
    // analysis, fridgePhoto display, scan history) uses this permanent URI.
    const uri = persistPhotoToDevice(rawUri);

    // Always Smart Append — never wipe the list on a new photo.
    // Explicit clear only happens via resetScan().
    const append = true;
    scanAppendModeRef.current = false;

    setFridgePhoto(uri);
    // Keep existing ingredients; only clear recipe results for a fresh generate pass
    setGeneratedRecipes(null);
    setIsGeneratingRecipes(false);

    const sessionId = Date.now();
    scanSessionIdRef.current = sessionId;
    if (scanAwaitTimerRef.current) {
      clearInterval(scanAwaitTimerRef.current);
      scanAwaitTimerRef.current = null;
    }
    pendingDetectedRef.current = null;
    ingredientsCommittedRef.current = false;
    scanMetaRef.current = {
      photoUri: uri,
      source: source || "camera",
      append,
    };
    setScanStartedAt(sessionId);
    setIsScanning(true);
    setScanningLabel(t("scanner.appendScanningLabel"));

    try {
      let detected;
      try {
        detected = await analyzeFridgeImage(uri, "", recipeLanguageName);
      } catch (firstErr) {
        // Gemini occasionally returns a transient "model overloaded" (503)
        // on every candidate model in the same beat — confirmed live via
        // direct testing. One retry after a short pause clears it almost
        // every time, instead of the scan silently finishing with zero
        // ingredients and no explanation.
        console.warn(
          "Cook AI Vision scan failed, retrying once:",
          firstErr?.message
        );
        await new Promise((resolve) => setTimeout(resolve, 900));
        detected = await analyzeFridgeImage(uri, "", recipeLanguageName);
      }
      if (scanSessionIdRef.current !== sessionId) return;
      if (ingredientsCommittedRef.current) return;
      pendingDetectedRef.current = Array.isArray(detected) ? detected : [];
    } catch (err) {
      if (scanSessionIdRef.current !== sessionId) return;
      if (ingredientsCommittedRef.current) return;
      console.warn("Cook AI Vision scan failed after retry:", err?.message);
      pendingDetectedRef.current = [];
      showToast(t("errors.readPhotoFailed"), "error", 4200);
    }
  }, [t, recipeLanguageName, registerFridgeScanAttempt, setProModalOpen]);

  /**
   * Called when laser/radar progress hits 100%.
   * Waits for Vision API (pendingDetectedRef) before committing —
   * prevents empty-state flash while the request is still in flight.
   */
  const endScanChoreography = useCallback(() => {
    if (ingredientsCommittedRef.current) {
      setIsScanning(false);
      setScanStartedAt(null);
      return;
    }

    if (pendingDetectedRef.current === null) {
      if (scanAwaitTimerRef.current) return;
      const startedAt = Date.now();
      scanAwaitTimerRef.current = setInterval(() => {
        const timedOut = Date.now() - startedAt > 60000;
        if (pendingDetectedRef.current !== null || timedOut) {
          clearInterval(scanAwaitTimerRef.current);
          scanAwaitTimerRef.current = null;
          if (timedOut && pendingDetectedRef.current === null) {
            pendingDetectedRef.current = [];
          }
          endScanChoreography();
        }
      }, 120);
      return;
    }

    if (scanAwaitTimerRef.current) {
      clearInterval(scanAwaitTimerRef.current);
      scanAwaitTimerRef.current = null;
    }

    const fullList = Array.isArray(pendingDetectedRef.current)
      ? pendingDetectedRef.current
      : [];

    ingredientsCommittedRef.current = true;
    pendingDetectedRef.current = fullList;

    // STRICT Smart Append — never overwrite the NAME of an existing item;
    // case-insensitive dedupe.
    //
    // Confirmed real failure, reported by a first-time tester: delete an
    // item, then immediately rescan, and the deleted item could reappear
    // (sometimes duplicated). Root cause was reading `ingredientsRef.current`
    // here — that ref is kept current by a useEffect (see its declaration
    // above), which only runs AFTER React commits a render, i.e.
    // asynchronously relative to the delete's own setIngredients call. A
    // scan finishing in that same window read the ref before the delete's
    // effect had flushed, so `prevItems` below still contained the
    // just-deleted item and the merge silently resurrected it.
    //
    // Fixed by computing the merge inside setIngredients' own functional
    // updater instead, which React always calls with the true latest state
    // — no stale ref involved. The updater runs synchronously as part of
    // this call (React invokes it immediately, only the resulting re-render
    // is deferred), so `mergedIngredients` is populated by the time
    // setIngredients() returns below, preserving the original need for a
    // synchronous merged list to snapshot into scan history right after.
    const newScannedItems = fullList;
    const normalizeName = (n) => String(n || "").toLowerCase().trim();

    let mergedIngredients = [];
    setIngredients((prevItems) => {
      // A name match against an existing item still gets its ICON refreshed
      // from this fresh detection — a rescan re-photographs the same food,
      // so the new icon is at least as trustworthy as whatever was stored
      // before (and self-heals any item whose icon was assigned back when
      // the icon-matching logic was worse, without the user having to
      // manually delete and rescan it).
      const refreshedPrevItems = prevItems.map((existing) => {
        const match = newScannedItems.find(
          (n) => normalizeName(n?.name) === normalizeName(existing?.name)
        );
        const freshIcon =
          match &&
          ((typeof match.icon === "string" && match.icon.trim()) ||
            (typeof match.emoji === "string" && match.emoji.trim()));
        if (!freshIcon || freshIcon === existing.icon) return existing;
        return { ...existing, icon: freshIcon, emoji: freshIcon };
      });

      const uniqueNew = newScannedItems.filter(
        (newItem) => !prevItems.some((existing) => normalizeName(existing?.name) === normalizeName(newItem?.name))
      );
      // Collapse dupes inside Gemini batch + assign stable ids, then append
      const uniqueNewItems = mergeUniqueIngredients([], uniqueNew);
      mergedIngredients = [...refreshedPrevItems, ...uniqueNewItems];
      return mergedIngredients;
    });

    setIsScanning(false);
    setScanStartedAt(null);

    const { photoUri, source } = scanMetaRef.current || {};
    if (photoUri) {
      const addedCount = fullList.length;
      pushScanHistory(photoUri, source || "camera", addedCount, mergedIngredients);
    }
  }, [pushScanHistory]);

  /** Next completeScan will APPEND (de-duped). */
  const prepareScanMore = useCallback(() => {
    scanAppendModeRef.current = true;
  }, []);

  /** Open camera — next completeScan APPENDs (de-duped). */
  const startScanMore = useCallback(() => {
    scanAppendModeRef.current = true;
    setCameraOpen(true);
  }, []);

  /** Pantry's own version — every pantry scan already merges/appends (see
   * mergePantryScanResults), so there's no separate "append mode" flag to
   * set here, just open the camera. */
  const startPantryScanMore = useCallback(() => {
    setPantryCameraOpen(true);
  }, []);

  const resetScan = useCallback(() => {
    if (scanAwaitTimerRef.current) {
      clearInterval(scanAwaitTimerRef.current);
      scanAwaitTimerRef.current = null;
    }
    scanAppendModeRef.current = false;
    setFridgePhoto(null);
    setIngredients([]);
    setIsGeneratingRecipes(false);
    setGeneratedRecipes(null);
    setIsScanning(false);
    scanSessionIdRef.current = 0;
    pendingDetectedRef.current = null;
    ingredientsCommittedRef.current = false;
    scanMetaRef.current = { photoUri: null, source: "camera" };
    setScanStartedAt(null);
  }, []);

  const toggleSaveRecipe = useCallback((recipe) => {
    if (!recipe || recipe.id == null) return;
    const idStr = String(recipe.id);

    setFavorites((prev) => {
      const has = (prev || []).some((id) => String(id) === idStr);
      return has
        ? (prev || []).filter((id) => String(id) !== idStr)
        : [...(prev || []), recipe.id];
    });

    setSavedRecipes((prev) => {
      try {
        const exists = prev.some((r) => String(r.id) === idStr);
        if (exists) return prev.filter((r) => String(r.id) !== idStr);
        const [enriched] = enrichRecipes([recipe]);
        return [...prev, enriched || recipe];
      } catch {
        return prev;
      }
    });
  }, []);

  /** Toggle favorite by id — keeps favorites[] + savedRecipes in sync. */
  const toggleFavorite = useCallback((recipeId) => {
    if (recipeId == null) return;
    const idStr = String(recipeId);

    setFavorites((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.some((id) => String(id) === idStr)
        ? list.filter((id) => String(id) !== idStr)
        : [...list, recipeId];
    });

    setSavedRecipes((prev) => {
      try {
        const exists = prev.some((r) => String(r.id) === idStr);
        if (exists) return prev.filter((r) => String(r.id) !== idStr);

        const pool = [
          ...(Array.isArray(generatedRecipes) ? generatedRecipes : []),
          ...(Array.isArray(RECIPES) ? RECIPES : []),
          ...(Array.isArray(FALLBACK_RECIPES) ? FALLBACK_RECIPES : []),
        ];
        const found = pool.find((r) => r && String(r.id) === idStr);
        if (!found) return prev;
        const [enriched] = enrichRecipes([found]);
        return [...prev, enriched || found];
      } catch {
        return prev;
      }
    });
  }, [generatedRecipes]);

  // Re-stamp dish emoji badges on every render of the saved list.
  const savedRecipesWithImages = useMemo(() => {
    try {
      return enrichRecipes(savedRecipes);
    } catch {
      return Array.isArray(savedRecipes) ? savedRecipes : [];
    }
  }, [savedRecipes]);

  const isRecipeSaved = useCallback(
    (id) => {
      const idStr = String(id);
      if ((favorites || []).some((fav) => String(fav) === idStr)) return true;
      return savedRecipes.some((r) => String(r.id) === idStr);
    },
    [favorites, savedRecipes]
  );

  const savedCount = useMemo(() => {
    try {
      const fromFavorites = Array.isArray(favorites) ? favorites.length : 0;
      return Math.max(fromFavorites, Array.isArray(savedRecipes) ? savedRecipes.length : 0);
    } catch {
      return 0;
    }
  }, [favorites, savedRecipes]);

  const togglePantryItem = useCallback((id) => {
    setPantryItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, inStock: !p.inStock } : p))
    );
  }, []);

  const addPantryItem = useCallback((rawNameOrItem) => {
    const item =
      typeof rawNameOrItem === "string"
        ? classifyPantryItemLocal(rawNameOrItem)
        : rawNameOrItem;
    if (!item?.name) return null;

    setPantryItems((prev) => {
      const existing = prev.find(
        (p) => normalizePantryName(p.name) === normalizePantryName(item.name)
      );
      if (existing) {
        return prev.map((p) =>
          p.id === existing.id ? { ...p, inStock: true } : p
        );
      }
      return [{ ...item, inStock: true }, ...prev];
    });
    return item;
  }, []);

  const removePantryItem = useCallback((id) => {
    if (!id) return;
    setPantryItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearPantry = useCallback(() => {
    setPantryItems([]);
  }, []);

  /**
   * Append ingredient names to the Shopping List.
   * The list is derived from out-of-stock pantry items, so each name is either
   * marked out-of-stock (existing staple) or added as a new out-of-stock item.
   * Names already on the list are skipped. Returns how many were added.
   */
  const addToShoppingList = useCallback(
    (names = []) => {
      const clean = [
        ...new Set(
          (Array.isArray(names) ? names : [])
            .map((n) => String(n || "").trim())
            .filter(Boolean)
        ),
      ];
      if (clean.length === 0) return 0;

      // Plan changes against current state so the count is reliable —
      // setState updaters may run deferred, so counting inside one is unsafe.
      const markOutOfStock = [];
      const newItems = [];
      for (const name of clean) {
        const existing = pantryItems.find(
          (p) => normalizePantryName(p.name) === normalizePantryName(name)
        );
        if (existing) {
          // Already out of stock → already on the list, skip
          if (existing.inStock) markOutOfStock.push(existing.id);
        } else {
          const item = classifyPantryItemLocal(name);
          if (item?.name) newItems.push({ ...item, inStock: false });
        }
      }

      if (markOutOfStock.length > 0 || newItems.length > 0) {
        setPantryItems((prev) => [
          ...newItems,
          ...prev.map((p) =>
            markOutOfStock.includes(p.id) ? { ...p, inStock: false } : p
          ),
        ]);
      }
      return markOutOfStock.length + newItems.length;
    },
    [pantryItems]
  );

  const mergePantryScanResults = useCallback((detected = []) => {
    if (!Array.isArray(detected) || detected.length === 0) return 0;
    let added = 0;
    setPantryItems((prev) => {
      const next = [...prev];
      for (const item of detected) {
        if (!item?.name) continue;
        const idx = next.findIndex(
          (p) => normalizePantryName(p.name) === normalizePantryName(item.name)
        );
        if (idx >= 0) {
          // Also refresh the icon from this fresh detection — same
          // reasoning as the fridge scan's Smart Append: a rescan
          // re-photographs the same item, so its new icon self-heals
          // anything stored with a worse icon from an earlier scan.
          const freshIcon =
            (typeof item.icon === "string" && item.icon.trim()) ||
            (typeof item.emoji === "string" && item.emoji.trim());
          next[idx] = {
            ...next[idx],
            inStock: true,
            ...(freshIcon ? { icon: freshIcon, emoji: freshIcon } : null),
          };
        } else {
          next.unshift({ ...item, inStock: true });
          added += 1;
        }
      }
      return next;
    });
    return detected.length;
  }, []);

  /**
   * Fire-and-forget, mirroring completeScan's fridge counterpart above:
   * kicks off the real Vision analysis immediately and returns, without
   * waiting for it. The result lands in pantryPendingDetectedRef, and
   * endPantryScanChoreography (below) is what actually commits it — called
   * by PantryScannerHero's own local progress-bar timing effect once its
   * choreography finishes, same split as the fridge scan.
   */
  const completePantryScan = useCallback(
    async (photoUri, source = "camera") => {
      if (!photoUri) return;
      // Single choke point, same reasoning as completeScan's fridge-cap
      // check above: every pantry scan entry point funnels through here,
      // so gating right here (rather than in each call site) means none of
      // them can bypass the cap. The allowance is only consumed once a real
      // photo is about to be analyzed, never burned on a permission denial
      // or a cancelled camera/picker upstream.
      if (!registerPantryScanAttempt()) {
        // Same native-Modal-collision avoidance as completeScan: this runs
        // right after the pantry camera Modal closes (see handleCapture in
        // PantryScannerHero), so a bare setProModalOpen(true) here would
        // try to mount a second native Modal while that one is still
        // mid-dismissal.
        setTimeout(() => setProModalOpen?.(true), EXIT_DURATION_MS + 40);
        return;
      }

      setPantryPhoto(photoUri);
      const sessionId = Date.now();
      pantryScanSessionIdRef.current = sessionId;
      if (pantryScanAwaitTimerRef.current) {
        clearInterval(pantryScanAwaitTimerRef.current);
        pantryScanAwaitTimerRef.current = null;
      }
      pantryPendingDetectedRef.current = null;
      pantryIngredientsCommittedRef.current = false;
      setIsPantryScanning(true);

      try {
        const detected = await analyzePantryImage(photoUri, "", recipeLanguageName);
        if (pantryScanSessionIdRef.current !== sessionId) return;
        if (pantryIngredientsCommittedRef.current) return;
        pantryPendingDetectedRef.current = Array.isArray(detected) ? detected : [];
      } catch (err) {
        if (pantryScanSessionIdRef.current !== sessionId) return;
        if (pantryIngredientsCommittedRef.current) return;
        console.warn("[Cook AI] Pantry scan failed:", err?.message);
        pantryPendingDetectedRef.current = [];
        showToast(t("errors.analyzePantryFailed"), "error");
      }
    },
    [t, recipeLanguageName, registerPantryScanAttempt, setProModalOpen, showToast]
  );

  /**
   * Called when the pantry progress bar choreography hits 100%. Waits for
   * the Vision API (pantryPendingDetectedRef) before committing — prevents
   * an empty-state flash while the request is still in flight. Being a
   * context function (not component state) means this still runs and
   * still merges the real result even if PantryScannerHero has since
   * unmounted (the user left the Pantry tab mid-scan) — the merge and the
   * "added N staples" toast are not lost, only the visual choreography
   * that led up to them.
   */
  const endPantryScanChoreography = useCallback(() => {
    if (pantryIngredientsCommittedRef.current) {
      setIsPantryScanning(false);
      return;
    }

    if (pantryPendingDetectedRef.current === null) {
      if (pantryScanAwaitTimerRef.current) return;
      const startedAt = Date.now();
      pantryScanAwaitTimerRef.current = setInterval(() => {
        const timedOut = Date.now() - startedAt > 60000;
        if (pantryPendingDetectedRef.current !== null || timedOut) {
          clearInterval(pantryScanAwaitTimerRef.current);
          pantryScanAwaitTimerRef.current = null;
          if (timedOut && pantryPendingDetectedRef.current === null) {
            pantryPendingDetectedRef.current = [];
          }
          endPantryScanChoreography();
        }
      }, 120);
      return;
    }

    if (pantryScanAwaitTimerRef.current) {
      clearInterval(pantryScanAwaitTimerRef.current);
      pantryScanAwaitTimerRef.current = null;
    }

    const fullList = Array.isArray(pantryPendingDetectedRef.current)
      ? pantryPendingDetectedRef.current
      : [];
    pantryIngredientsCommittedRef.current = true;

    const count = mergePantryScanResults(fullList);
    showToast(
      t(
        count === 1 ? "toast.addedPantryStaplesOne" : "toast.addedPantryStaplesOther",
        { count }
      ),
      "success"
    );
    setIsPantryScanning(false);
  }, [mergePantryScanResults, showToast, t]);

  /** Dismiss the just-scanned photo/summary and return to the idle Scan
   * Pantry prompt — does NOT touch pantryItems, matching the existing "X"
   * button's contract (it dismisses the scan summary, not the inventory). */
  const resetPantryPhoto = useCallback(() => {
    if (pantryScanAwaitTimerRef.current) {
      clearInterval(pantryScanAwaitTimerRef.current);
      pantryScanAwaitTimerRef.current = null;
    }
    setPantryPhoto(null);
    setIsPantryScanning(false);
    pantryScanSessionIdRef.current = 0;
    pantryPendingDetectedRef.current = null;
    pantryIngredientsCommittedRef.current = false;
  }, []);

  const generateRecipes = useCallback(async () => {
    // Re-entrancy guard: without this, a fast double-tap or a preference
    // switch mid-request can kick off a second overlapping Gemini call
    // before the button's `disabled` prop re-renders. The two responses
    // then race to setGeneratedRecipes/setIsGeneratingRecipes in whatever
    // order they land, which is exactly what read as a "freeze" — the
    // skeleton loader flips true/false/true as each call's finally block
    // fires out of order. Every other async handler in this app
    // (MealPlannerModal's handleAutoFillWeek, handleGenerateForDay, etc.)
    // already guards itself this way; this was the one call site missing it.
    if (isGeneratingRecipes) return;

    // Strict data pipeline: fridge scan + in-stock pantry staples only
    const scannedIngredients = ingredients;
    const activeStaples = includePantryStaples
      ? pantryItems.filter((item) => item.inStock)
      : [];

    if (scannedIngredients.length === 0 && activeStaples.length === 0) {
      showToast(t("errors.scanBeforeGenerate"), "error");
      return;
    }

    setIsGeneratingRecipes(true);
    setRecipeGenerationFailed(false);
    // Scroll to the recipes section immediately, not just after the fetch
    // resolves — otherwise the user watches the skeleton loader appear
    // below the fold and has to scroll down themselves during the wait,
    // then the real cards "jump" into a different position once the
    // second scrollToRecipesTop() call below fires after data lands.
    scrollToRecipesTop();
    try {
      // Regenerate must not just reshuffle the same dishes — tell the model
      // exactly which titles it already gave the user so it can't reach for
      // the same "best fit" answer again. Empty on a first-time generate
      // (generatedRecipes is still null then).
      const previousTitles = Array.isArray(generatedRecipes)
        ? generatedRecipes.map((r) => r?.title).filter(Boolean)
        : [];

      // Free tier gets a smaller batch per generation (see
      // FREE_RECIPES_PER_GENERATION) — PRO gets the full RECIPES_PER_SCAN
      // every time, not just more generations over the course of a day.
      const recipeCount = isPro ? RECIPES_PER_SCAN : FREE_RECIPES_PER_GENERATION;

      // Goldilocks: exactly 5 imperative steps — enforced in normalizeRecipe
      const recipes = await generateRecipesWithGemini(
        scannedIngredients,
        activeStaples,
        mealType,
        servings,
        hungerLevel,
        dietaryRestrictionsWithCustom,
        "",
        recipeCount,
        false,
        previousTitles,
        unitSystem,
        recipeLanguageName
      );

      // generateRecipesWithGemini throws rather than returning an empty
      // array now (see geminiRecipes.js) — a non-empty, real, AI-generated
      // batch is the only thing that reaches here.
      const stamped = enrichRecipes(recipes).slice(0, recipeCount);

      setGeneratedRecipes(stamped);
      showToast(
        t(
          stamped.length === 1
            ? "toast.generatedRecipesOne"
            : "toast.generatedRecipesOther",
          { count: stamped.length }
        ),
        "success"
      );

      scrollToRecipesTop();
    } catch (err) {
      console.warn("[Cook AI] Recipe generation failed:", err?.message);
      // Never disguise a failure as a real batch: if a previous real batch
      // is still on screen (this was a failed "Regenerate"), leave it
      // exactly as it was and just tell the user this attempt failed —
      // wiping working content for an error state would be worse than the
      // error itself. If this was the first-ever attempt (nothing on
      // screen yet), mark the honest failure state so RecipeFeed can show
      // a clear "couldn't generate" notice instead of silently showing
      // nothing, and instead of the old behavior of quietly swapping in
      // fake template recipes.
      if (Array.isArray(generatedRecipes) && generatedRecipes.length > 0) {
        showToast(t("errors.generateRecipesFailed"), "error");
      } else {
        setRecipeGenerationFailed(true);
        showToast(t("errors.generateRecipesFailed"), "error");
      }
    } finally {
      setIsGeneratingRecipes(false);
    }
  }, [
    isGeneratingRecipes,
    ingredients,
    pantryItems,
    includePantryStaples,
    mealType,
    servings,
    hungerLevel,
    dietaryRestrictionsWithCustom,
    generatedRecipes,
    unitSystem,
    recipeLanguageName,
    scrollToRecipesTop,
    showToast,
    isPro,
    t,
  ]);

  /**
   * Meal Planner inventory meals — real Gemini-backed generation (same
   * Executive Chef harmony rules + dietary guardrail as the main recipe
   * generator), strictly from the current fridge scan + in-stock pantry
   * staples. Async now — falls back to the local inventory heuristic
   * internally if the API key is missing or the call fails.
   */
  const getPlannerMealsFromInventory = useCallback(
    async (count = 7) => {
      const activeStaples = pantryItems.filter((item) => item.inStock);
      return generatePlannerMealsWithGemini(
        ingredients,
        activeStaples,
        count,
        servings,
        dietaryRestrictionsWithCustom,
        "",
        unitSystem,
        recipeLanguageName
      );
    },
    [
      ingredients,
      pantryItems,
      servings,
      dietaryRestrictionsWithCustom,
      unitSystem,
      recipeLanguageName,
    ]
  );

  /**
   * PRO-only AI Recipe Modifier — throws on failure; caller shows the
   * error.
   *
   * Confirmed real failure, not a hypothetical: modifying a recipe, backing
   * out of the detail screen, then reopening the same recipe reverted it to
   * the original, unmodified version. Root cause: modifyRecipeWithGemini's
   * result goes through normalizeRecipe, which always stamps a brand-new
   * `ai-${Date.now()}-...` id — the same quirk ensureRecipeLanguage right
   * above already works around (force the id back, persist by id) for its
   * own translate-reuse call to the same underlying service. This just
   * never got that same treatment. Merges over the original (so fields the
   * modify prompt doesn't touch — languageId, cardIndex, etc. — survive),
   * forces the id back, and persists into whichever list(s) actually hold
   * this recipe (saved, generated, or both) so the caller's local display
   * state isn't the only place the change lives.
   */
  const modifyRecipe = useCallback(
    async (recipe, instruction) => {
      const result = await modifyRecipeWithGemini(
        recipe,
        instruction,
        dietaryRestrictionsWithCustom,
        "",
        unitSystem,
        recipeLanguageName
      );
      const updated = { ...recipe, ...result, id: recipe.id };
      setSavedRecipes((prev) =>
        prev.map((r) => (String(r.id) === String(recipe.id) ? updated : r))
      );
      setGeneratedRecipes((prev) =>
        Array.isArray(prev)
          ? prev.map((r) => (String(r.id) === String(recipe.id) ? updated : r))
          : prev
      );
      return updated;
    },
    [dietaryRestrictionsWithCustom, unitSystem, recipeLanguageName]
  );

  /**
   * Auto-translation for a recipe left over from a previous language
   * selection — NOT the PRO "Modify with AI" feature (reuses its
   * underlying translate-capable service call, but this is basic i18n
   * correctness, so it's never gated behind PRO). Called when
   * RecipeDetailModal opens a recipe whose `languageId` no longer matches
   * the app's current language. Persists the result back into
   * savedRecipes (matched by id) so it doesn't need re-translating next
   * time it's opened, unless the language changes again. Returns the
   * original recipe unchanged on any failure — never blocks viewing it.
   */
  const ensureRecipeLanguage = useCallback(
    async (recipe) => {
      if (!recipe?.isAiGenerated) return recipe;
      if (!recipe.languageId || recipe.languageId === recipeLanguageId) return recipe;
      try {
        const translated = await modifyRecipeWithGemini(
          recipe,
          "Translate this recipe faithfully into the target language — title, ingredient names, and steps only. Do not change quantities, ingredients, step count, or anything else about the recipe.",
          dietaryRestrictionsWithCustom,
          "",
          unitSystem,
          recipeLanguageName
        );
        const updated = { ...recipe, ...translated, id: recipe.id, languageId: recipeLanguageId };
        setSavedRecipes((prev) =>
          prev.map((r) => (String(r.id) === String(recipe.id) ? updated : r))
        );
        return updated;
      } catch (err) {
        console.warn("[Cook AI] Recipe auto-translate failed:", err?.message);
        return recipe;
      }
    },
    [recipeLanguageId, recipeLanguageName, dietaryRestrictionsWithCustom, unitSystem]
  );

  // Proactively translates every stale-language recipe when the language
  // actually changes — both the persisted Saved list and whatever's
  // currently showing in the Recipe Feed — so titles update on their own
  // instead of only translating the moment someone happens to open one
  // (ensureRecipeLanguage above still handles that per-recipe case too,
  // e.g. for a recipe saved *after* this pass already ran). One recipe at a
  // time, not in parallel, to stay gentle on the API; each recipe swaps in
  // as its own translation lands rather than waiting for the whole batch.
  const recipeLangTrackerRef = useRef(null);
  useEffect(() => {
    if (!recipeLanguageHydrated || !savedHydrated) return;
    if (recipeLangTrackerRef.current === null) {
      recipeLangTrackerRef.current = recipeLanguageId;
      return;
    }
    if (recipeLangTrackerRef.current === recipeLanguageId) return;
    recipeLangTrackerRef.current = recipeLanguageId;

    let cancelled = false;
    (async () => {
      const staleSaved = savedRecipes.filter(
        (r) => r?.isAiGenerated && r.languageId && r.languageId !== recipeLanguageId
      );
      for (const recipe of staleSaved) {
        if (cancelled) return;
        await ensureRecipeLanguage(recipe);
      }

      const staleGenerated = (
        Array.isArray(generatedRecipes) ? generatedRecipes : []
      ).filter(
        (r) => r?.isAiGenerated && r.languageId && r.languageId !== recipeLanguageId
      );
      for (const recipe of staleGenerated) {
        if (cancelled) return;
        const updated = await ensureRecipeLanguage(recipe);
        if (!cancelled) {
          setGeneratedRecipes((prev) =>
            Array.isArray(prev)
              ? prev.map((r) => (String(r.id) === String(recipe.id) ? updated : r))
              : prev
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately excludes savedRecipes/generatedRecipes — read from the
    // closure at switch time, same reasoning as the inventory effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeLanguageId, recipeLanguageHydrated, savedHydrated, ensureRecipeLanguage]);

  const toggleDietaryRestriction = useCallback((key) => {
    setDietaryRestrictions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Memoized — an unmemoized value object here recreates on every render of
  // this provider and forces every useCookAI() consumer in the app (every
  // tab, every modal) to re-render too, which is what was causing tab-switch
  // lag. Almost every field below is already its own stable useCallback/
  // useMemo, so this only actually recomputes when something real changed.
  const value = useMemo(
    () => ({
      activeTab,
      setActiveTab,
      ingredients,
      /** Alias: fridge-scan inventory used by Meal Planner + recipe pipeline */
      scannedIngredients: ingredients,
      removeIngredient,
      addIngredient,
      appendIngredients,
      mealType,
      setMealType,
      servings,
      setServings,
      hungerLevel,
      setHungerLevel,
      cravingTags,
      toggleCravingTag,
      excludeThisBatch,
      setExcludeThisBatch,
      savedRecipes: savedRecipesWithImages,
      savedCount,
      favorites,
      toggleFavorite,
      toggleSaveRecipe,
      isRecipeSaved,
      // Alias used by high-contrast RecipeFeed snippet
      recipes: visibleRecipes,
      pantryItems,
      togglePantryItem,
      addPantryItem,
      removePantryItem,
      clearPantry,
      addToShoppingList,
      mergePantryScanResults,
      completePantryScan,
      endPantryScanChoreography,
      resetPantryPhoto,
      isGeneratingRecipes,
      generatedRecipes,
      recipeGenerationFailed,
      generateRecipes,
      getPlannerMealsFromInventory,
      modifyRecipe,
      ensureRecipeLanguage,
      isPro,
      activatePro,
      deactivatePro,
      dailyFridgeScanCount,
      freeDailyFridgeScans: FREE_DAILY_FRIDGE_SCANS,
      canScanFridge,
      registerFridgeScanAttempt,
      dailyPantryScanCount,
      freeDailyPantryScans: FREE_DAILY_PANTRY_SCANS,
      canScanPantry,
      registerPantryScanAttempt,
      dailyRecipeGenerationCount,
      freeDailyRecipeGenerations: FREE_DAILY_RECIPE_GENERATIONS,
      canGenerateRecipes,
      registerRecipeGenerationAttempt,
      scrollViewRef,
      setRecipesSectionY: updateRecipesSectionY,
      recipesSectionY,
      scrollToRecipesTop,
      isScanning,
      scanningLabel,
      scanStartedAt,
      cameraOpen,
      setCameraOpen,
      fridgePhoto,
      hasScanned,
      completeScan,
      endScanChoreography,
      resetScan,
      isPantryScanning,
      pantryCameraOpen,
      setPantryCameraOpen,
      pantryPhoto,
      hasPantryScanned,
      prepareScanMore,
      startScanMore,
      startPantryScanMore,
      visibleRecipes,
      scanHistory,
      restoreScan,
      dietaryRestrictions,
      toggleDietaryRestriction,
      customDietAvoid,
      setCustomDietAvoid,
      customDietPrefer,
      setCustomDietPrefer,
      includePantryStaples,
      setIncludePantryStaples,
      unitSystem,
      setUnitSystem,
      ingredientPriority,
      setIngredientPriority,
      recipeLanguageId,
      recipeLanguageHydrated,
      setRecipeLanguageId,
      t,
      onboardingComplete,
      onboardingHydrated,
      completeOnboarding,
      resetOnboarding,
      settingsDoneHintShown,
      markSettingsDoneHintShown,
      toast,
      showToast,
    }),
    [
      activeTab,
      setActiveTab,
      ingredients,
      removeIngredient,
      addIngredient,
      appendIngredients,
      mealType,
      setMealType,
      servings,
      setServings,
      hungerLevel,
      setHungerLevel,
      cravingTags,
      toggleCravingTag,
      excludeThisBatch,
      setExcludeThisBatch,
      savedRecipesWithImages,
      savedCount,
      favorites,
      toggleFavorite,
      toggleSaveRecipe,
      isRecipeSaved,
      visibleRecipes,
      pantryItems,
      togglePantryItem,
      addPantryItem,
      removePantryItem,
      clearPantry,
      addToShoppingList,
      mergePantryScanResults,
      completePantryScan,
      endPantryScanChoreography,
      resetPantryPhoto,
      isGeneratingRecipes,
      generatedRecipes,
      recipeGenerationFailed,
      generateRecipes,
      getPlannerMealsFromInventory,
      modifyRecipe,
      ensureRecipeLanguage,
      isPro,
      activatePro,
      deactivatePro,
      dailyFridgeScanCount,
      canScanFridge,
      registerFridgeScanAttempt,
      dailyPantryScanCount,
      canScanPantry,
      registerPantryScanAttempt,
      dailyRecipeGenerationCount,
      canGenerateRecipes,
      registerRecipeGenerationAttempt,
      scrollViewRef,
      updateRecipesSectionY,
      recipesSectionY,
      scrollToRecipesTop,
      isScanning,
      scanningLabel,
      scanStartedAt,
      cameraOpen,
      setCameraOpen,
      fridgePhoto,
      hasScanned,
      completeScan,
      endScanChoreography,
      resetScan,
      isPantryScanning,
      pantryCameraOpen,
      setPantryCameraOpen,
      pantryPhoto,
      hasPantryScanned,
      prepareScanMore,
      startScanMore,
      startPantryScanMore,
      scanHistory,
      restoreScan,
      dietaryRestrictions,
      toggleDietaryRestriction,
      customDietAvoid,
      setCustomDietAvoid,
      customDietPrefer,
      setCustomDietPrefer,
      includePantryStaples,
      setIncludePantryStaples,
      unitSystem,
      setUnitSystem,
      ingredientPriority,
      setIngredientPriority,
      recipeLanguageId,
      recipeLanguageHydrated,
      setRecipeLanguageId,
      t,
      onboardingComplete,
      onboardingHydrated,
      completeOnboarding,
      resetOnboarding,
      settingsDoneHintShown,
      markSettingsDoneHintShown,
      toast,
      showToast,
    ]
  );

  return (
    <CookAIContext.Provider value={value}>{children}</CookAIContext.Provider>
  );
}

export function useCookAI() {
  const ctx = useContext(CookAIContext);
  if (!ctx) throw new Error("useCookAI must be used within CookAIProvider");
  return ctx;
}
