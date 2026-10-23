import { FALLBACK_RECIPES } from "../data/recipes";
import { stampRecipeEmojis } from "./imageUtils";
import { log } from "./log";

/**
 * Optional persisted state hydration hook-point.
 * Wrap any future AsyncStorage reads here so storage failures never red-screen.
 */
export function safeStorageRead(reader, fallback) {
  try {
    const value = typeof reader === "function" ? reader() : fallback;
    return value == null ? fallback : value;
  } catch (err) {
    log.warn("[Cook AI] storage read failed, using fallback:", err?.message);
    return fallback;
  }
}

/** Sync emoji + vectorType stamp for recipe cards. */
export function enrichRecipes(rawRecipes) {
  try {
    return stampRecipeEmojis(
      Array.isArray(rawRecipes) ? rawRecipes.filter(Boolean) : []
    );
  } catch (err) {
    log.warn("[Cook AI] enrichRecipes failed:", err?.message);
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

export function safeVisibleRecipes(
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
    log.warn("[Cook AI] visibleRecipes failed:", err?.message);
  }

  try {
    return enrichRecipes(FALLBACK_RECIPES || []).slice(0, maxCount);
  } catch {
    return [];
  }
}
