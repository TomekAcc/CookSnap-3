import { Ingredient } from "@/types";

/**
 * Merges freshly-detected ingredients into an existing session list,
 * deduplicating by name so scanning different shelves of the same fridge
 * never produces duplicate entries. An item already present (by name, case
 * insensitive) is left untouched — this preserves any manual in/out-of-stock
 * toggle the user already made before scanning again.
 */
export function mergeIngredients(existing: Ingredient[], incoming: Ingredient[]): Ingredient[] {
  const seen = new Set(existing.map((item) => item.name.toLowerCase()));
  const fresh = incoming.filter((item) => {
    const key = item.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...existing, ...fresh];
}
