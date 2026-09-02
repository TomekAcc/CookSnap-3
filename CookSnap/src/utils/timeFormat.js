/**
 * Cook/prep/total time values come back from Gemini as raw "X min" strings —
 * deliberately in a fixed English format regardless of the recipe's
 * language (see the LANGUAGE block in geminiRecipes.js's buildPrompt), so
 * the app can re-render the unit word in the user's selected language
 * consistently instead of trusting the model to translate an abbreviation
 * on every field. This is that re-render step — swap in the translated
 * minute unit, keep the number.
 */
export function formatTimeLabel(value, minUnit, fallback = "—") {
  if (value == null || value === "") return fallback;
  if (typeof value === "number") return `${value} ${minUnit}`;
  // Match just the leading number, not an English "min"/"m" suffix — a
  // stale meal-planner entry generated while the app was in another
  // language can have its unit word in that language (e.g. "17 分钟"),
  // and requiring an English suffix here meant that text leaked straight
  // through to the UI untranslated instead of being re-rendered in the
  // current language like every other time label.
  const match = String(value).trim().match(/^(\d+)/);
  return match ? `${match[1]} ${minUnit}` : fallback;
}

/** Sums prep + cook minutes when no explicit total is given. */
export function sumTimeLabel(prepTime, cookTime, minUnit, fallback = "—") {
  const prepMinutes = extractMinutes(prepTime);
  const cookMinutes = extractMinutes(cookTime);
  if (prepMinutes == null && cookMinutes == null) return fallback;
  return `${(prepMinutes || 0) + (cookMinutes || 0)} ${minUnit}`;
}

function extractMinutes(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  const match = String(value).trim().match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * True only when a time value actually carries a number. normalizeRecipe
 * stamps a literal "—" into prepTime/cookTime/totalTime whenever a recipe
 * didn't supply one, and "—" is a truthy string — so a plain `if (value)`
 * test treats a missing time as present.
 */
export function hasRealMinutes(value) {
  return extractMinutes(value) != null;
}

/** totalTime → prep+cook sum → cookTime → prepTime cascade, for display. */
export function cookTimeLabel(recipe, minUnit) {
  // Confirmed real failure, not a hypothetical: this cascade used plain
  // truthiness, so the "—" placeholder matched the totalTime branch and
  // returned the dash instead of falling through. Every curated fallback
  // recipe in src/data/recipes.js stores numeric prepTime/cookTime and no
  // totalTime at all, so all five rendered "—" as their headline time on
  // both the feed card and the detail modal — directly above a
  // "Prep 10 min · Cook 12 min" line already showing the numbers needed to
  // add up to 22. Checking for a real number instead fixes both surfaces.
  if (hasRealMinutes(recipe?.totalTime)) {
    return formatTimeLabel(recipe.totalTime, minUnit);
  }
  // Prefer the honest prep+cook total over either half alone — a dish with
  // 10 min prep and 12 min cook is a 22-minute recipe, not a 12-minute one.
  const summed = sumTimeLabel(recipe?.prepTime, recipe?.cookTime, minUnit, null);
  if (summed) return summed;
  if (hasRealMinutes(recipe?.cookTime)) return formatTimeLabel(recipe.cookTime, minUnit);
  if (hasRealMinutes(recipe?.prepTime)) return formatTimeLabel(recipe.prepTime, minUnit);
  return `15 ${minUnit}`;
}
