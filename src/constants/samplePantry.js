import { PANTRY_STAPLES } from "../data/recipes";

/**
 * The onboarding "sample pantry": the dry goods drawn on the second onboarding picture
 * (assets/sample-pantry.jpg), chosen to go with what is in the sample fridge (pasta + tomatoes +
 * cheese, eggs + milk + flour + sugar, rice + peppers + carrots + paprika ...) so the very first
 * recipes are real dishes instead of "whatever the fridge holds on its own". They are NOT saved
 * to the user's pantry: they are only handed to the recipe generator while the sample fridge is
 * on screen (see pantryForGeneration), and the moment the user scans their own fridge or stocks
 * their own pantry they are gone.
 *
 * Ids are PANTRY_STAPLES ids, so names, emoji and categories come from the same place (and the
 * same pantryStaple.<id> translations) as the "add to pantry" suggestions. Everything here is
 * drawn in the picture, in shelf order, and nothing that is in the sample fridge picture is.
 */
export const SAMPLE_PANTRY_IDS = [
  "pasta",
  "sugar",
  "honey",
  "soy-sauce",
  "cinnamon",
  "oregano",
  "paprika",
  "salt",
  "pepper",
  "flour",
  "rice",
  "oats",
];

export const SAMPLE_PANTRY_IMAGE = require("../../assets/sample-pantry.jpg");

/**
 * Where to pin a label on the picture, as fractions of the image (x across, y down) at the
 * top-centre of the item. Only items with clear wall above them. Names come from the
 * pantryStaple.<id> translations. Measured on assets/sample-pantry.jpg (1600 x 1550).
 */
export const SAMPLE_PANTRY_TAGS = [
  { id: "soy-sauce", x: 0.744, y: 0.126 },
  { id: "sugar", x: 0.425, y: 0.135 },
  { id: "paprika", x: 0.5, y: 0.4535 },
  { id: "flour", x: 0.292, y: 0.703 },
];

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
