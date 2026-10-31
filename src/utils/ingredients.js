// Pure helpers for the fridge ingredient list and the pantry.

/** Case/space-insensitive identity of an ingredient: its name, lower-cased and trimmed. */
const nameKey = (item) => String(item?.name || "").toLowerCase().trim();

/**
 * Shared duplicate-check key for pantry items — trims, lowercases, and
 * collapses whitespace so "Olive Oil", " olive oil" and "olive  oil" all count
 * as the same staple.
 */
export function normalizePantryName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Smart Append — NEVER overwrite. Adds `newScannedItems` to `prevItems`,
 * skipping any whose name (case-insensitive) is already present, duplicates
 * inside the incoming batch itself (a model sometimes repeats an item), and
 * items without a name. Existing rows are kept exactly as they were; new rows
 * get a stable id if they don't have one.
 */
export function mergeUniqueIngredients(prevItems, newScannedItems) {
  const existing = Array.isArray(prevItems) ? prevItems : [];
  const incoming = Array.isArray(newScannedItems) ? newScannedItems : [];

  const seen = new Set(existing.map(nameKey));
  const added = [];
  for (const item of incoming) {
    const key = nameKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    added.push({
      ...item,
      id:
        item?.id ||
        `ing-${Date.now()}-${existing.length + added.length}-${Math.random().toString(36).slice(2, 7)}`,
    });
  }

  return [...existing, ...added];
}
