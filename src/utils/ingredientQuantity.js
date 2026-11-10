/**
 * Splits "120g Hummus" / "1/2 tsp Salt" / "2 Eggs" into the quantity ("120 g", "1/2 tsp", "2") and the name, so
 * the quantity can be set apart from the name. Only a leading number, a glued or following unit from a short
 * list of common ones are taken; anything else stays in the name, so an unfamiliar unit word is never lost.
 */
const QTY_NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?(?:\s?[-\u2013]\s?\d+(?:[.,]\d+)?)?|[\u00BD\u00BC\u00BE\u2153\u2154])`;
const QTY_GLUED_UNIT = String.raw`(?:kg|g|ml|dl|cl|l|oz|lbs?)`;
const QTY_WORD_UNIT = String.raw`(?:pcs?|cups?|tbsp|tsp|cloves?|pinch(?:es)?|slices?|cans?|bunch(?:es)?|quarts?|pints?|szt\.?|szklank\p{L}*|\u0142y\u017c\p{L}*|z\u0105bk\p{L}*|szczypt\p{L}*|plastr\p{L}*|puszk\p{L}*)`;
const QTY_PATTERN = new RegExp(
  `^(${QTY_NUMBER})(?:\\s?(${QTY_GLUED_UNIT})(?=\\s|$)|\\s+(${QTY_WORD_UNIT})(?=\\s))?\\s+(.+)$`,
  "iu"
);
export function splitLeadingQuantity(text) {
  const match = QTY_PATTERN.exec(String(text || "").trim());
  if (!match) return { qty: "", name: String(text || "").trim() };
  const [, num, glued, word, rest] = match;
  const unit = glued || word;
  return { qty: unit ? `${num} ${unit}` : num, name: rest };
}
