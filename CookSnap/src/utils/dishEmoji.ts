import { accentPalette } from "@/constants/theme";

/**
 * Keyword → emoji lookup for recipe titles/descriptions. Order matters —
 * more specific keywords are checked before generic ones (e.g. "chicken
 * bowl" should match "chicken" not the generic "bowl").
 */
const DISH_KEYWORDS: Array<[string, string]> = [
  ["pasta", "🍝"],
  ["spaghetti", "🍝"],
  ["noodle", "🍜"],
  ["ramen", "🍜"],
  ["pizza", "🍕"],
  ["taco", "🌮"],
  ["burrito", "🌯"],
  ["sushi", "🍣"],
  ["egg", "🍳"],
  ["omelet", "🍳"],
  ["pancake", "🥞"],
  ["waffle", "🧇"],
  ["toast", "🍞"],
  ["sandwich", "🥪"],
  ["burger", "🍔"],
  ["chicken", "🍗"],
  ["turkey", "🦃"],
  ["beef", "🥩"],
  ["steak", "🥩"],
  ["pork", "🥓"],
  ["bacon", "🥓"],
  ["fish", "🐟"],
  ["salmon", "🐟"],
  ["shrimp", "🍤"],
  ["prawn", "🍤"],
  ["tofu", "🧈"],
  ["soup", "🍲"],
  ["stew", "🍲"],
  ["curry", "🍛"],
  ["rice", "🍚"],
  ["risotto", "🍚"],
  ["salad", "🥗"],
  ["broccoli", "🥦"],
  ["spinach", "🥬"],
  ["lettuce", "🥬"],
  ["avocado", "🥑"],
  ["tomato", "🍅"],
  ["carrot", "🥕"],
  ["potato", "🥔"],
  ["pepper", "🫑"],
  ["mushroom", "🍄"],
  ["corn", "🌽"],
  ["garlic", "🧄"],
  ["onion", "🧅"],
  ["cheese", "🧀"],
  ["yogurt", "🥣"],
  ["smoothie", "🥤"],
  ["soup bowl", "🍲"],
  ["bowl", "🥣"],
  ["wrap", "🌯"],
  ["bread", "🍞"],
  ["muffin", "🧁"],
  ["cookie", "🍪"],
  ["cake", "🍰"],
  ["pie", "🥧"],
  ["chocolate", "🍫"],
  ["lemon", "🍋"],
  ["citrus", "🍋"],
  ["fruit", "🍓"],
  ["berry", "🫐"],
  ["grill", "🔥"],
  ["roast", "🔥"],
  ["skillet", "🍳"],
  ["stir fry", "🥘"],
  ["stir-fry", "🥘"],
];

const FALLBACK_EMOJI = "🍽️";

/**
 * Deterministic hash so the same dish title always resolves to the same
 * fallback color when no accent is supplied.
 */
function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getDishEmoji(title: string): string {
  const lower = title.toLowerCase();
  for (const [keyword, emoji] of DISH_KEYWORDS) {
    if (lower.includes(keyword)) return emoji;
  }
  return FALLBACK_EMOJI;
}

/**
 * Resolves both the emoji and a tile background color for a dish title.
 * Pass `accentColor` to reuse a color already assigned elsewhere (e.g. the
 * card's sequential palette slot); omit it to get a deterministic
 * hash-based color for standalone use.
 */
export function getDishEmojiAndStyle(
  title: string,
  accentColor?: string
): { emoji: string; backgroundColor: string } {
  return {
    emoji: getDishEmoji(title),
    backgroundColor: accentColor ?? accentPalette[hash(title) % accentPalette.length],
  };
}
