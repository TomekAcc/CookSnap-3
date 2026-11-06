/**
 * Maps ingredient names → accurate emojis.
 * Falls back to a category emoji (veg / meat / dairy / …) — never 📦.
 */

const EXACT_MAP = [
  // Produce
  { keys: ["peach", "nectarine", "brzoskwinia"], emoji: "🍑", category: "veg" },
  { keys: ["melon", "watermelon", "cantaloupe", "honeydew"], emoji: "🍈", category: "veg" },
  { keys: ["avocado", "awokado"], emoji: "🥑", category: "veg" },
  { keys: ["apple", "jabłko", "jablko"], emoji: "🍎", category: "veg" },
  { keys: ["banana"], emoji: "🍌", category: "veg" },
  { keys: ["berry", "berries", "strawberry", "blueberry", "raspberry"], emoji: "🫐", category: "veg" },
  { keys: ["broccoli"], emoji: "🥦", category: "veg" },
  { keys: ["cabbage", "lettuce", "spinach", "szpinak", "kale", "greens", "arugula", "sałata", "salata"], emoji: "🥬", category: "veg" },
  { keys: ["carrot"], emoji: "🥕", category: "veg" },
  // No radish emoji exists. The vision model reached for 🪴 (a potted plant) for "Radishes"; a root vegetable
  // reads as the right kind of food.
  { keys: ["radish", "rzodkiew"], emoji: "🥕", category: "veg" },
  { keys: ["celery"], emoji: "🥬", category: "veg" },
  { keys: ["corn"], emoji: "🌽", category: "veg" },
  { keys: ["cucumber"], emoji: "🥒", category: "veg" },
  { keys: ["eggplant", "aubergine"], emoji: "🍆", category: "veg" },
  { keys: ["garlic", "czosnek"], emoji: "🧄", category: "veg" },
  { keys: ["ginger"], emoji: "🫚", category: "veg" },
  { keys: ["lemon", "lime", "citrus"], emoji: "🍋", category: "veg" },
  // Confirmed real feedback: a Polish recipe showed the plain 🍄 — which
  // renders as a red-spotted toadstool (visually a fly agaric / Amanita
  // muscaria, i.e. a poisonous mushroom) in most emoji sets — instead of
  // the neutral 🍄‍🟫 below. This table only had the English "mushroom"
  // keyword, so a Polish ingredient name ("pieczarki", "grzyby") never
  // matched it and fell through to the model's own emoji choice, which
  // isn't guarded against picking the toxic-looking glyph. Same
  // English-only-keyword-table gap already found and worked around in
  // geminiRecipes.js's flavor check — adding the Polish terms here closes
  // it for this specific case; see also the "NEVER 🍄" prompt rule.
  { keys: ["mushroom", "pieczarka", "pieczarki", "grzyb", "grzyby"], emoji: "🍄‍🟫", category: "veg" },
  { keys: ["onion", "shallot", "leek", "cebula"], emoji: "🧅", category: "veg" },
  { keys: ["bell pepper", "papryka", "capsicum", "chili", "chilli"], emoji: "🫑", category: "veg" },
  { keys: ["potato", "sweet potato"], emoji: "🥔", category: "veg" },
  { keys: ["tomato", "cherry tomato", "pomidor"], emoji: "🍅", category: "veg" },
  { keys: ["zucchini", "courgette"], emoji: "🥒", category: "veg" },
  { keys: ["pesto"], emoji: "🌿", category: "pantry" },
  { keys: ["herb", "basil", "parsley", "cilantro", "coriander", "mint", "dill", "thyme", "rosemary"], emoji: "🌿", category: "veg" },

  // Protein
  { keys: ["bacon", "ham", "prosciutto"], emoji: "🥓", category: "meat" },
  { keys: ["beef", "steak", "ground beef", "mince", "wołowina", "wolowina"], emoji: "🥩", category: "meat" },
  { keys: ["chicken", "poultry", "turkey", "kurczak"], emoji: "🍗", category: "meat" },
  { keys: ["egg", "jajk"], emoji: "🥚", category: "dairy" },
  { keys: ["fish", "salmon", "tuna", "cod", "tilapia", "ryba"], emoji: "🐟", category: "meat" },
  { keys: ["shrimp", "prawn", "seafood", "crab", "lobster"], emoji: "🦐", category: "meat" },
  { keys: ["pork", "sausage"], emoji: "🥩", category: "meat" },
  // Confirmed real feedback: 🧊 (ice cube) was picked purely for the white
  // cube shape — it reads as literal ice, not food, and drew a tester's
  // attention for exactly that reason. No dedicated unicode glyph exists
  // for tofu/tempeh/seitan, so these split by what they're actually made
  // from instead of sharing one wrong-but-cube-shaped icon: tofu/tempeh
  // are soybean products (🫘, already used nowhere else in this file),
  // seitan is wheat gluten (🌾, matching flour/wheat below).
  { keys: ["tofu", "tempeh"], emoji: "🫘", category: "veg" },
  { keys: ["seitan"], emoji: "🌾", category: "veg" },

  // Dairy
  { keys: ["mascarpone", "cream cheese", "twaróg", "twarog"], emoji: "🧀", category: "dairy" },
  { keys: ["butter", "ghee", "masło", "maslo"], emoji: "🧈", category: "dairy" },
  // NOTE: bare "ser" (Polish for cheese) was removed — as a raw substring it
  // matched inside unrelated words like "horSERadish", forcing a wrong 🧀.
  // "serek"/"twaróg" below are long enough to stay collision-safe.
  { keys: ["parmesan", "parmezan", "mozzarella", "cheddar", "feta", "cottage", "cheese", "serek"], emoji: "🧀", category: "dairy" },
  { keys: ["sour cream", "śmietana", "smietana", "heavy cream", "cream"], emoji: "🥛", category: "dairy" },
  { keys: ["milk", "mleko"], emoji: "🥛", category: "dairy" },
  { keys: ["greek yogurt", "yogurt", "yoghurt", "jogurt"], emoji: "🥣", category: "dairy" },

  // Grains & carbs
  { keys: ["bread", "toast", "baguette", "sourdough", "chleb", "bułka", "bulka"], emoji: "🍞", category: "grain" },
  { keys: ["flour", "wheat"], emoji: "🌾", category: "grain" },
  { keys: ["oat", "oatmeal"], emoji: "🥣", category: "grain" },
  { keys: ["pasta", "penne", "spaghetti", "noodle", "macaroni", "linguine", "fettuccine", "makaron"], emoji: "🍝", category: "grain" },
  { keys: ["rice", "risotto", "quinoa", "couscous", "ryż", "ryz"], emoji: "🍚", category: "grain" },
  { keys: ["tortilla", "wrap"], emoji: "🫓", category: "grain" },

  // Oils, sauces, pantry
  { keys: ["pesto"], emoji: "🫙", category: "pantry" },
  { keys: ["mayo", "mayonnaise", "majonez"], emoji: "🥣", category: "pantry" },
  { keys: ["jam", "dżem", "dzem", "honey", "miód", "miod", "maple syrup", "agave"], emoji: "🍯", category: "pantry" },
  { keys: ["olive oil", "oliwa", "olive", "olives", "oliwka", "oliwki"], emoji: "🫒", category: "pantry" },
  { keys: ["oil", "sesame oil", "vegetable oil", "canola"], emoji: "🫒", category: "pantry" },
  { keys: ["soy sauce", "tamari", "teriyaki"], emoji: "🍾", category: "pantry" },
  { keys: ["vinegar", "balsamic"], emoji: "🍾", category: "pantry" },
  // "pepper" alone after produce — black pepper / seasoning
  { keys: ["salt", "black pepper", "seasoning", "spice", "paprika", "cumin", "cinnamon"], emoji: "🧂", category: "pantry" },
  { keys: ["pepper"], emoji: "🫑", category: "veg" },
  { keys: ["sugar", "brown sugar"], emoji: "🍬", category: "pantry" },
  { keys: ["broth", "stock", "bouillon"], emoji: "🥣", category: "pantry" },
  { keys: ["bean", "lentil", "chickpea", "hummus"], emoji: "🫘", category: "pantry" },
  { keys: ["nut", "almond", "walnut", "peanut", "cashew"], emoji: "🥜", category: "pantry" },
  { keys: ["juice"], emoji: "🧃", category: "pantry" },
  { keys: ["wine"], emoji: "🍷", category: "pantry" },
  { keys: ["coconut"], emoji: "🥥", category: "pantry" },
  { keys: ["chocolate", "cocoa"], emoji: "🍫", category: "pantry" },
  { keys: ["water", "woda", "sparkling water", "soda water"], emoji: "💧", category: "pantry" },
  { keys: ["ketchup", "bbq sauce", "hot sauce", "chili sauce"], emoji: "🍅", category: "pantry" },
  { keys: ["mustard"], emoji: "🟡", category: "pantry" },
  // Placed before the generic "tin"/"can" fallback below so "Coffee Tin" /
  // "Tea Tin" resolve to their own emoji instead of a plain canned-food icon.
  { keys: ["coffee", "espresso", "kawa", "cappuccino"], emoji: "☕", category: "pantry" },
  { keys: ["tea bag", "teabag", "green tea", "black tea", "herbal tea", "chamomile", "herbata", "chai tea", "iced tea", "tea tin", "tea box"], emoji: "🍵", category: "pantry" },
  { keys: ["can", "canned", "tin", "tinned"], emoji: "🥫", category: "pantry" },
];

const CATEGORY_FALLBACK = {
  veg: "🥦",
  meat: "🥩",
  dairy: "🥛",
  grain: "🌾",
  pantry: "🫙",
};

const CATEGORY_KEYWORDS = [
  {
    category: "meat",
    keys: ["meat", "protein", "fillet", "cutlet", "rib", "wing", "thigh", "breast"],
  },
  {
    category: "dairy",
    keys: ["dairy", "whey", "curd"],
  },
  {
    category: "grain",
    keys: ["grain", "cereal", "dough", "crust", "batter"],
  },
  {
    category: "veg",
    keys: [
      "vegetable",
      "veggie",
      "salad",
      "fruit",
      "leaf",
      "root",
      "squash",
      "pea",
      "bean sprout",
    ],
  },
  {
    category: "pantry",
    keys: ["sauce", "paste", "dressing", "marinade", "condiment", "extract", "powder"],
  },
];

/**
 * @param {string} name
 * @returns {string} emoji
 */
/**
 * Emoji that are plants, flowers, packaging or "unknown item" placeholders rather than food. The vision model sometimes picks one when no
 * food emoji matches exactly (🪴 for radishes); it is replaced by our own match for the name.
 */
const NON_FOOD_EMOJI = /[🪴🌳🌲🌴🌵🪵🌸🌹🌺🌻🌼🌷🪻🪷💐🏵📦🛒🛍🧺🪣🧴🧪🫙🍽❓]/u;

/** The model's icon if it is a food emoji, otherwise the one from our own table for this name. */
export function foodEmojiOrFallback(icon, name = "") {
  const raw = typeof icon === "string" ? icon.trim() : "";
  if (raw && !NON_FOOD_EMOJI.test(raw)) return raw;
  return getIngredientEmoji(name);
}

export function getIngredientEmoji(name = "") {
  const clean = String(name || "")
    .toLowerCase()
    .trim();
  if (!clean) return "🫙";

  for (const entry of EXACT_MAP) {
    if (entry.keys.some((k) => clean.includes(k))) {
      return entry.emoji;
    }
  }

  for (const group of CATEGORY_KEYWORDS) {
    if (group.keys.some((k) => clean.includes(k))) {
      return CATEGORY_FALLBACK[group.category] || "🫙";
    }
  }

  // Unknown item — never force a wrong/random emoji, fall back to a
  // universal jar/container instead.
  return "🫙";
}

/**
 * Full meta used by RecipeDetailModal quantity scaling.
 * @param {string} name
 * @returns {{ emoji: string, unit: string, baseQty: number }}
 */
export function getIngredientMeta(name = "") {
  const clean = String(name || "")
    .toLowerCase()
    .trim();
  const emoji = getIngredientEmoji(clean);

  // Sensible default quantities by matched emoji / keywords
  if (/egg/.test(clean)) return { emoji, unit: "pcs", baseQty: 2 };
  if (/milk|cream|juice|broth|stock|wine/.test(clean))
    return { emoji, unit: "ml", baseQty: 200 };
  if (/oil|butter|honey|soy|vinegar|sauce/.test(clean))
    return { emoji, unit: "tbsp", baseQty: 1 };
  if (/garlic/.test(clean)) return { emoji, unit: "cloves", baseQty: 2 };
  if (/salt|pepper|spice|seasoning/.test(clean))
    return { emoji, unit: "pinch", baseQty: 1 };
  if (/herb|basil|parsley|cilantro|mint/.test(clean))
    return { emoji, unit: "handful", baseQty: 1 };
  if (
    /onion|tomato|potato|pepper|apple|lemon|lime|avocado|carrot/.test(clean)
  ) {
    return { emoji, unit: "pcs", baseQty: 1 };
  }
  if (/pasta|rice|flour|cheese|chicken|beef|tofu|yogurt/.test(clean))
    return { emoji, unit: "g", baseQty: 100 };

  return { emoji, unit: "portion", baseQty: 1 };
}
