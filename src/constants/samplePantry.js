import { PANTRY_STAPLES } from "../data/recipes";

/**
 * The onboarding "sample pantry": a handful of staples that go with what is in the sample fridge
 * (tomatoes + onion + cheese + pasta + garlic + oregano, eggs + milk + flour, rice + peppers +
 * carrots + paprika ...) so the very first recipes are real dishes instead of "whatever the
 * fridge holds on its own". They are NOT saved to the user's pantry: they are only handed to the
 * recipe generator while the sample fridge is on screen (see pantryForGeneration), and the
 * moment the user scans their own fridge or stocks their own pantry they are gone.
 *
 * Ids are PANTRY_STAPLES ids, so names, emoji and categories come from the same place (and the
 * same pantryStaple.<id> translations) as the "add to pantry" suggestions.
 */
export const SAMPLE_PANTRY_IDS = ["pasta", "rice", "flour", "olive-oil", "garlic", "oregano", "paprika"];

export function buildSamplePantry(t) {
  return SAMPLE_PANTRY_IDS.map((id) => {
    const staple = PANTRY_STAPLES.find((s) => s.id === id);
    return {
      id: `sample-pantry-${id}`,
      name: t(`pantryStaple.${id}`),
      emoji: staple.emoji,
      icon: staple.emoji,
      category: staple.category,
      role: "Essential pantry staple for recipes",
      inStock: true,
    };
  });
}

/**
 * The pantry list a recipe request should use: the user's in-stock items, or — only while the
 * sample fridge is showing and they have stocked nothing themselves — the sample pantry.
 */
export function pantryForGeneration(pantryItems, scanIsDemo, t) {
  const inStock = (pantryItems || []).filter((item) => item.inStock);
  if (scanIsDemo && inStock.length === 0) return buildSamplePantry(t);
  return inStock;
}
