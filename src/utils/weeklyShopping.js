/**
 * Builds "what to buy this week" from the planned meals: every ingredient line
 * of every planned recipe that is NOT already covered by an in-stock pantry
 * item, a scanned fridge item, or an always-available basic (salt, pepper,
 * oils, butter, sugar, water).
 *
 * Ingredient lines are free text in the user's language ("2 large eggs",
 * "200 g ryżu"), so matching is deliberately forgiving and language-neutral:
 * words are compared by their first four letters (so "pomidor"/"pomidory" or
 * "egg"/"eggs" count as the same word), and an owned item covers a line when
 * ALL of its words appear in the line. Each remaining line is kept as written
 * (with its quantity, tagged with the day it is for) instead of being merged
 * into totals it could get wrong.
 */

const WORD = /[\p{L}]+/gu;

function words(text) {
  return (String(text || "").toLowerCase().match(WORD) || []).filter((w) => w.length >= 3);
}

function sameWord(a, b) {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  // A short word matches a close inflection of itself ("ryż"/"ryżu", "egg"/
  // "eggs") but not an unrelated longer word that merely starts with it
  // ("tea"/"teaspoon").
  if (long.startsWith(short) && long.length - short.length <= 2) return true;
  if (a.length < 4 || b.length < 4) return false;
  return a.slice(0, 4) === b.slice(0, 4);
}

function lineHasAll(lineWords, itemWords) {
  return itemWords.length > 0 && itemWords.every((iw) => lineWords.some((lw) => sameWord(lw, iw)));
}

// "2 large eggs" -> "large eggs": what to store in the pantry once bought.
export function ingredientBaseName(line) {
  return String(line || "")
    .replace(/^[\d\s.,/½¼¾⅓⅔-]+/u, "")
    .replace(/^\s*\(.*?\)\s*/, "")
    .trim();
}

/**
 * @param {object} args
 * @param {object} args.plan        weeklyPlan: { mon: meal|null, ... }
 * @param {Array}  args.days        [{ id, label }] in display order
 * @param {string[]} args.ownedNames in-stock pantry + fridge item names
 * @param {string[]} args.basicNames always-available basics in the user's language
 */
export function buildWeeklyShoppingList({ plan, days, ownedNames = [], basicNames = [] }) {
  const owned = [...ownedNames, ...basicNames].map(words).filter((w) => w.length > 0);
  const seen = new Set();
  const out = [];
  days.forEach((day) => {
    const meal = plan?.[day.id];
    if (!meal) return;
    const lines = Array.isArray(meal.ingredients)
      ? meal.ingredients
      : Array.isArray(meal.recipe?.ingredientsList)
        ? meal.recipe.ingredientsList
        : [];
    lines.forEach((raw) => {
      const line = typeof raw === "string" ? raw : raw?.name || "";
      const lw = words(line);
      if (!lw.length) return;
      if (owned.some((ow) => lineHasAll(lw, ow))) return;
      const key = `${day.id}|${line.toLowerCase().trim()}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        id: `weekly-${day.id}-${out.length}`,
        name: ingredientBaseName(line) || line,
        label: `${line.trim()} · ${day.label}`,
        inStock: false,
      });
    });
  });
  return out;
}

export const PLANNER_STORAGE_KEY = "cookai:weeklyPlan:v1";

const DAY_KEYS = [
  ["mon", "dayShort.mon"],
  ["tue", "dayShort.tue"],
  ["wed", "dayShort.wed"],
  ["thu", "dayShort.thu"],
  ["fri", "dayShort.fri"],
  ["sat", "dayShort.sat"],
  ["sun", "dayShort.sun"],
];
const BASIC_STAPLE_IDS = ["salt", "pepper", "olive-oil", "vegetable-oil", "butter", "sugar"];
const WATER_WORDS = ["water", "woda", "wasser", "eau", "agua", "acqua", "água", "вода"];

/** Shopping items for a saved weekly plan, using the app's pantry, fridge scan and translations. */
export function weeklyShoppingItemsFor({ plan, pantryItems, scannedIngredients, t, emojiFor }) {
  const owned = [
    ...(pantryItems || []).filter((p) => p.inStock).map((p) => p.name),
    ...(scannedIngredients || []).map((i) => i.name),
  ];
  const basics = [...BASIC_STAPLE_IDS.map((id) => t(`pantryStaple.${id}`)), ...WATER_WORDS];
  const days = DAY_KEYS.map(([id, key]) => ({ id, label: t(key) }));
  return buildWeeklyShoppingList({ plan, days, ownedNames: owned, basicNames: basics }).map(
    (item) => ({ ...item, emoji: (emojiFor && emojiFor(item.name)) || "🫙" })
  );
}
