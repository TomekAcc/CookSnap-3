import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  generateRecipesWithGemini,
  generatePlannerMealsWithGemini,
  modifyRecipeWithGemini,
  RECIPES_PER_SCAN,
} from "../services/geminiRecipes";
import { FREE_RECIPES_PER_GENERATION } from "../constants/limits";
import { enrichRecipes, safeVisibleRecipes } from "../utils/recipeLists";
import { showToast } from "../utils/toast";
import { log } from "../utils/log";
import { useNavigation } from "./NavigationContext";
import { useLanguage } from "./LanguageContext";
import { useEntitlements } from "./EntitlementsContext";
import { usePreferences } from "./PreferencesContext";
import { useLibrary } from "./LibraryContext";
import { useInventory } from "./InventoryContext";

const RecipesContext = createContext(null);

/**
 * The generated recipe batch and everything that creates or changes it: generating,
 * regenerating, the AI modifier, translating a recipe into the current language, and
 * the list the feed shows. Failures never produce a fabricated batch.
 */
export function RecipesProvider({ children }) {
  const { scrollToRecipesTop } = useNavigation();
  const { t, recipeLanguageId, recipeLanguageName, recipeLanguageHydrated } = useLanguage();
  const { isPro } = useEntitlements();
  const {
    mealType,
    servings,
    hungerLevel,
    includePantryStaples,
    dietaryRestrictionsWithCustom,
    unitSystem,
  } = usePreferences();
  const { savedHydrated, savedRecipesRaw: savedRecipes, replaceSavedRecipe } = useLibrary();
  const { ingredients, pantryItems } = useInventory();
  const [isGeneratingRecipes, setIsGeneratingRecipes] = useState(false);
  const [generatedRecipes, setGeneratedRecipes] = useState(null);
  // True only when a generate/regenerate call failed AND there was no
  // previous real batch on screen to fall back to — RecipeFeed uses this to
  // show an honest "couldn't generate" state instead of nothing at all.
  // Never paired with fake/template recipes: on failure we either keep
  // showing the last real batch (this stays false) or show no cards at all
  // (this becomes true) — never a fabricated batch dressed up as real.
  const [recipeGenerationFailed, setRecipeGenerationFailed] = useState(false);

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
  /** Forget the current batch — a new scan, restoring an old one, or resetting. */
  const clearRecipes = useCallback(() => {
    setGeneratedRecipes(null);
    setIsGeneratingRecipes(false);
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
      log.warn("[Cook AI] Recipe generation failed:", err?.message);
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
      replaceSavedRecipe(updated);
      setGeneratedRecipes((prev) =>
        Array.isArray(prev)
          ? prev.map((r) => (String(r.id) === String(recipe.id) ? updated : r))
          : prev
      );
      return updated;
    },
    [dietaryRestrictionsWithCustom, unitSystem, recipeLanguageName, replaceSavedRecipe]
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
        replaceSavedRecipe(updated);
        return updated;
      } catch (err) {
        log.warn("[Cook AI] Recipe auto-translate failed:", err?.message);
        return recipe;
      }
    },
    [recipeLanguageId, recipeLanguageName, dietaryRestrictionsWithCustom, unitSystem, replaceSavedRecipe]
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
  const value = useMemo(
    () => ({
      generatedRecipes,
      isGeneratingRecipes,
      recipeGenerationFailed,
      visibleRecipes,
      recipes: visibleRecipes,
      generateRecipes,
      getPlannerMealsFromInventory,
      modifyRecipe,
      ensureRecipeLanguage,
      clearRecipes,
    }),
    [generatedRecipes, isGeneratingRecipes, recipeGenerationFailed, visibleRecipes, generateRecipes, getPlannerMealsFromInventory, modifyRecipe, ensureRecipeLanguage, clearRecipes]
  );

  return <RecipesContext.Provider value={value}>{children}</RecipesContext.Provider>;
}

export function useRecipes() {
  const ctx = useContext(RecipesContext);
  if (!ctx) throw new Error("useRecipes must be used within RecipesProvider");
  return ctx;
}
