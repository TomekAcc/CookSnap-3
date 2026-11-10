import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DIETARY_OPTIONS_DEFAULT } from "../data/dietaryOptions";
import { STORAGE_KEYS } from "../storage/keys";
import { enumCodec, objectCodec, positiveIntCodec, textCodec } from "../storage/codecs";
import { usePersistedState } from "../hooks/usePersistedState";
import { detectUnitSystem } from "../utils/units";
import { useEntitlements } from "./EntitlementsContext";

const PreferencesContext = createContext(null);

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

/**
 * Everything the user chooses that shapes what gets generated: meal type, servings,
 * hunger, cravings, ingredient priority, diet (and the PRO custom diet) and units.
 */
export function PreferencesProvider({ children }) {
  const { isPro } = useEntitlements();
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
  // Servings and hunger level are remembered between launches (like the diet
  // toggles below); meal type is not — it follows the time of day.
  const [servings, setServings] = usePersistedState(STORAGE_KEYS.servings, {
    initial: 2,
    codec: positiveIntCodec,
  });
  const [hungerLevel, setHungerLevel] = usePersistedState(STORAGE_KEYS.hungerLevel, {
    initial: "normal",
    codec: enumCodec("light", "normal", "hungry"),
  });
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

  // Ingredient Source Priority — persisted standing preference:
  // "balanced" (default, current behavior, never added to the
  // prompt) | "fridge" | "pantry". Soft steering only (see buildPrompt's
  // INVENTORY LOCK section in geminiRecipes.js) — it changes which list a
  // recipe leans on more, never what's allowed at all, so unlike Custom
  // Diet this needs no code-level safety net.
  const [ingredientPriority, setIngredientPriorityState] = usePersistedState(
    STORAGE_KEYS.ingredientPriority,
    { initial: "balanced", codec: enumCodec("fridge", "pantry", "balanced") }
  );

  const setIngredientPriority = useCallback((next) => {
    setIngredientPriorityState(
      next === "fridge" || next === "pantry" ? next : "balanced"
    );
  }, [setIngredientPriorityState]);

  // Confirmed real failure, not a hypothetical: this and servings/hungerLevel
  // below were plain useState with no AsyncStorage read/write at all — every
  // one of them (dietary restrictions included, the single most safety-
  // relevant setting in the app) silently reset to its default the moment
  // the app restarted. A user who set "Vegan" once would see it vanish on
  // the next launch and get non-vegan recipes with no warning. Same
  // hydrate-once-then-persist-on-change pattern as unitSystem below.
  const [dietaryRestrictions, setDietaryRestrictions] = usePersistedState(
    STORAGE_KEYS.dietaryRestrictions,
    { initial: DIETARY_OPTIONS_DEFAULT, codec: objectCodec(DIETARY_OPTIONS_DEFAULT) }
  );

  // PRO-only Custom Diet — raw comma-separated text, same hydrate-once-
  // then-persist-on-change pattern as dietaryRestrictions above. Stored
  // under their own keys (plain strings, not the boolean map) so they
  // don't interfere with FULL_DIETARY_OPTIONS' fixed id set. Kept even if
  // the user's PRO status later lapses — dietaryRestrictionsWithCustom
  // below is what actually gates whether they reach generation, so a
  // lapsed-then-renewed PRO user gets their list back instead of having
  // to retype it.
  const [customDietAvoid, setCustomDietAvoid] = usePersistedState(STORAGE_KEYS.customDietAvoid, {
    initial: "",
    codec: textCodec(),
  });
  const [customDietPrefer, setCustomDietPrefer] = usePersistedState(STORAGE_KEYS.customDietPrefer, {
    initial: "",
    codec: textCodec(),
  });

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

  // Recipe measurement system — "us" (cups/tbsp/°F) or "metric" (g/ml/°C).
  // User explicitly asked NOT to show both units at once (a prior fix had
  // shown dual units inline everywhere); this is a persisted single choice
  // that's threaded into every Gemini recipe prompt so generated recipes
  // come back in exactly one system, never mixed.
  const [unitSystem, setUnitSystemState] = usePersistedState(STORAGE_KEYS.unitSystem, {
    initial: "us",
    codec: enumCodec("us", "metric"),
    // Nothing (valid) saved yet: guess from the device's region.
    fallback: detectUnitSystem,
  });

  const setUnitSystem = useCallback((next) => {
    setUnitSystemState(next === "metric" ? "metric" : "us");
  }, [setUnitSystemState]);

  const toggleDietaryRestriction = useCallback((key) => {
    setDietaryRestrictions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, [setDietaryRestrictions]);
  const value = useMemo(
    () => ({
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
      includePantryStaples,
      setIncludePantryStaples,
      ingredientPriority,
      setIngredientPriority,
      dietaryRestrictions,
      toggleDietaryRestriction,
      dietaryRestrictionsWithCustom,
      customDietAvoid,
      setCustomDietAvoid,
      customDietPrefer,
      setCustomDietPrefer,
      unitSystem,
      setUnitSystem,
    }),
    [mealType, setMealType, servings, setServings, hungerLevel, setHungerLevel, cravingTags, toggleCravingTag, excludeThisBatch, setExcludeThisBatch, includePantryStaples, setIncludePantryStaples, ingredientPriority, setIngredientPriority, dietaryRestrictions, toggleDietaryRestriction, dietaryRestrictionsWithCustom, customDietAvoid, setCustomDietAvoid, customDietPrefer, setCustomDietPrefer, unitSystem, setUnitSystem]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
