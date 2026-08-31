/**
 * Soft UI emoji badges — deterministic pastel engine.
 * No AI images, pollinations, or network fetches.
 */

import {
  getIngredientEmoji as classifyIngredientEmoji,
  getIngredientMeta,
} from "./ingredientEmoji";

/**
 * CENTRAL EMOJI → PASTEL MAP (single source of truth).
 * Color-locked: every valid dish emoji gets a vivid, unique Soft UI tile.
 */
export const EMOJI_STYLE_MAP = {
  // Pasta — soft golden yellow
  "🍝": {
    bg: "bg-yellow-100",
    border: "border-yellow-200",
    text: "text-yellow-900",
    bgColor: "#FEF9C3",
    borderColor: "#FDE68A",
    bgColorDark: "rgba(113, 63, 18, 0.4)",
    borderColorDark: "rgba(161, 98, 7, 0.5)",
  },
  "🍜": {
    bg: "bg-yellow-100",
    border: "border-yellow-200",
    text: "text-yellow-900",
    bgColor: "#FEF9C3",
    borderColor: "#FDE68A",
    bgColorDark: "rgba(113, 63, 18, 0.4)",
    borderColorDark: "rgba(161, 98, 7, 0.5)",
  },
  // Breakfast/eggs — warm sunny amber
  "🍳": {
    bg: "bg-amber-100",
    border: "border-amber-200",
    text: "text-amber-900",
    bgColor: "#FEF3C7",
    borderColor: "#FDE68A",
    bgColorDark: "rgba(120, 53, 15, 0.4)",
    borderColorDark: "rgba(146, 64, 14, 0.5)",
  },
  "🥞": {
    bg: "bg-amber-100",
    border: "border-amber-200",
    text: "text-amber-900",
    bgColor: "#FEF3C7",
    borderColor: "#FDE68A",
    bgColorDark: "rgba(120, 53, 15, 0.4)",
    borderColorDark: "rgba(146, 64, 14, 0.5)",
  },
  // Plain eggs — the classifier already set emoji="🥚" for bare "egg"/
  // "breakfast" titles below, but this entry was never added here, so
  // styleFromEmoji() silently swapped it to the generic 🥘 fallback for
  // every one of those dishes (confirmed: same bug class as the oatmeal
  // fallback). Shares breakfast's amber tone.
  "🥚": {
    bg: "bg-amber-100",
    border: "border-amber-200",
    text: "text-amber-900",
    bgColor: "#FEF3C7",
    borderColor: "#FDE68A",
    bgColorDark: "rgba(120, 53, 15, 0.4)",
    borderColorDark: "rgba(146, 64, 14, 0.5)",
  },
  "🍞": {
    bg: "bg-amber-100",
    border: "border-amber-200",
    text: "text-amber-900",
    bgColor: "#FEF3C7",
    borderColor: "#FDE68A",
    bgColorDark: "rgba(120, 53, 15, 0.4)",
    borderColorDark: "rgba(146, 64, 14, 0.5)",
  },
  // Desserts/bowls — rich soft rose
  "🥣": {
    bg: "bg-rose-100",
    border: "border-rose-200",
    text: "text-rose-900",
    bgColor: "#FFE4E6",
    borderColor: "#FECDD3",
    bgColorDark: "rgba(136, 19, 55, 0.4)",
    borderColorDark: "rgba(159, 18, 57, 0.5)",
  },
  "🍰": {
    bg: "bg-rose-100",
    border: "border-rose-200",
    text: "text-rose-900",
    bgColor: "#FFE4E6",
    borderColor: "#FECDD3",
    bgColorDark: "rgba(136, 19, 55, 0.4)",
    borderColorDark: "rgba(159, 18, 57, 0.5)",
  },
  // Pudding/custard family — shares dessert's rose so it reads as the same
  // "sweet dish" group while still getting its own accurate glyph.
  "🍮": {
    bg: "bg-rose-100",
    border: "border-rose-200",
    text: "text-rose-900",
    bgColor: "#FFE4E6",
    borderColor: "#FECDD3",
    bgColorDark: "rgba(136, 19, 55, 0.4)",
    borderColorDark: "rgba(159, 18, 57, 0.5)",
  },
  // Coffee/chocolate/cocoa — distinct warm mocha tone, so it never collides
  // with breakfast's amber or dessert's rose.
  "🍫": {
    bg: "bg-stone-200",
    border: "border-stone-300",
    text: "text-stone-900",
    bgColor: "#E7E5E4",
    borderColor: "#D6D3D1",
    bgColorDark: "rgba(41, 37, 36, 0.5)",
    borderColorDark: "rgba(68, 64, 60, 0.6)",
  },
  "☕": {
    bg: "bg-stone-200",
    border: "border-stone-300",
    text: "text-stone-900",
    bgColor: "#E7E5E4",
    borderColor: "#D6D3D1",
    bgColorDark: "rgba(41, 37, 36, 0.5)",
    borderColorDark: "rgba(68, 64, 60, 0.6)",
  },
  // Soups/stews — warm terracotta
  "🍲": {
    bg: "bg-orange-100",
    border: "border-orange-200",
    text: "text-orange-900",
    bgColor: "#FFEDD5",
    borderColor: "#FED7AA",
    bgColorDark: "rgba(124, 45, 18, 0.4)",
    borderColorDark: "rgba(154, 52, 18, 0.5)",
  },
  // Rice/grain dishes — distinct violet, so risotto/paella never collides
  // with pasta's yellow or breakfast's amber
  "🍚": {
    bg: "bg-violet-100",
    border: "border-violet-200",
    text: "text-violet-900",
    bgColor: "#EDE9FE",
    borderColor: "#DDD6FE",
    bgColorDark: "rgba(76, 29, 149, 0.4)",
    borderColorDark: "rgba(91, 33, 182, 0.5)",
  },
  // Salads/greens — fresh mint green.
  //
  // NOTE: this map is a CATEGORICAL dish palette (12 families, each a
  // bg + a one-step-darker border), which is a different system from the
  // accent green in src/theme/tokens.js. Don't fold its greens into the
  // accent tokens — a pass that did exactly that flattened this border to
  // match its own background and the tile silently lost its edge.
  "🥗": {
    bg: "bg-emerald-100",
    border: "border-emerald-200",
    text: "text-emerald-900",
    bgColor: "#D1FAE5",
    borderColor: "#A7F3D0",
    bgColorDark: "rgba(6, 78, 59, 0.4)",
    borderColorDark: "rgba(6, 95, 70, 0.5)",
  },
  // Sandwiches/snacks — distinct sky blue, so it never collides with soup's terracotta
  "🥪": {
    bg: "bg-sky-100",
    border: "border-sky-200",
    text: "text-sky-900",
    bgColor: "#E0F2FE",
    borderColor: "#BAE6FD",
    bgColorDark: "rgba(12, 74, 110, 0.4)",
    borderColorDark: "rgba(7, 89, 133, 0.5)",
  },
  // Meat — distinct red, so it never collides with breakfast's amber or dessert's rose
  "🍗": {
    bg: "bg-red-100",
    border: "border-red-200",
    text: "text-red-900",
    bgColor: "#FEE2E2",
    borderColor: "#FECACA",
    bgColorDark: "rgba(127, 29, 29, 0.4)",
    borderColorDark: "rgba(153, 27, 27, 0.5)",
  },
  "🥩": {
    bg: "bg-red-100",
    border: "border-red-200",
    text: "text-red-900",
    bgColor: "#FEE2E2",
    borderColor: "#FECACA",
    bgColorDark: "rgba(127, 29, 29, 0.4)",
    borderColorDark: "rgba(153, 27, 27, 0.5)",
  },
  // Fallback/unknown dish — neutral, deliberately never competes with a real category color
  // "other" is the generic catch-all dishType (anything that isn't a
  // pasta/salad/sandwich/etc.-shaped dish — most stir-fries and sautés
  // land here since neither is its own category) — meaning this is
  // realistically one of the MOST common tiles in a real feed, not a rare
  // edge case. It was flat cool slate-gray, the only tile in this whole
  // map with no actual color, which read as washed-out/unfinished next to
  // every warm pastel category next to it in the same list. Warm
  // terracotta instead — appetizing, and distinct from breakfast/eggs'
  // amber so the two don't collide.
  "🥘": {
    bg: "bg-orange-100",
    border: "border-orange-200",
    text: "text-orange-900",
    bgColor: "#FFEDD5",
    borderColor: "#FED7AA",
    bgColorDark: "rgba(124, 45, 18, 0.4)",
    borderColorDark: "rgba(194, 65, 12, 0.5)",
  },
};

/** @deprecated Prefer EMOJI_STYLE_MAP — kept for legacy category class lookups. */
export const CATEGORY_COLORS = {
  breakfast: "bg-amber-100 border-amber-200",
  pasta: "bg-yellow-100 border-yellow-200",
  salad: "bg-emerald-100 border-emerald-200",
  soup: "bg-red-100 border-red-200",
  dessert: "bg-rose-100 border-rose-200",
  meat: "bg-amber-100 border-amber-200",
  snack: "bg-orange-100 border-orange-200",
};

export const EMOJI_MAP = {
  breakfast: "🍳",
  pasta: "🍝",
  salad: "🥗",
  soup: "🍲",
  dessert: "🥣",
  meat: "🍗",
  snack: "🥪",
};

function styleFromEmoji(emoji) {
  const key = emoji && EMOJI_STYLE_MAP[emoji] ? emoji : "🥘";
  const s = EMOJI_STYLE_MAP[key];
  return {
    emoji: key,
    style: s,
    bgClass: `${s.bg} ${s.border} ${s.text || ""}`.trim(),
    bg: s.bg,
    border: s.border,
    text: s.text,
    bgColor: s.bgColor,
    borderColor: s.borderColor,
    bgColorDark: s.bgColorDark,
    borderColorDark: s.borderColorDark,
    category:
      key === "🍝" || key === "🍜"
        ? "pasta"
        : key === "🍳" || key === "🥞" || key === "🍞" || key === "🥚"
          ? "breakfast"
          : key === "🥣" || key === "🍰" || key === "🍮"
            ? "dessert"
            : key === "🍫" || key === "☕"
              ? "coffee"
              : key === "🍲"
                ? "soup"
                : key === "🍚"
                  ? "grain"
                  : key === "🥗"
                    ? "salad"
                    : key === "🍗" || key === "🥩"
                      ? "meat"
                      : key === "🥪"
                      ? "snack"
                      : "snack",
  };
}

/**
 * Language-independent dish→emoji lookup. Gemini returns this alongside
 * every recipe (see GEMINI_RECIPE_SYSTEM_PROMPT's REQUIRED FIELDS) so the
 * icon stays correct even when the title/ingredients are localized —
 * the title-keyword matching below only works on English text and breaks
 * the moment recipes generate in another language (the exact class of bug
 * already confirmed once for oatmeal/porridge — this makes the whole
 * category of bug impossible instead of patching titles one at a time).
 */
const DISH_TYPE_TO_EMOJI = {
  pasta: "🍝",
  noodles: "🍜",
  bread: "🍞",
  pancake: "🥞",
  oatmeal: "🥣",
  salad: "🥗",
  omelet: "🍳",
  // A bare 🥚 (whole raw egg) reads as a grocery-list ingredient icon, not
  // an appetizing dish thumbnail — every recipe is a COOKED egg dish by
  // definition, so 🍳 (an egg actually being cooked) is the right glyph
  // here too, same as omelet above. 🥚 stays valid in EMOJI_STYLE_MAP below
  // purely so already-saved recipes stamped with it before this fix don't
  // silently fall back to the generic 🥘 — it's just never chosen for a
  // NEW dish classification anymore.
  eggs: "🍳",
  coffee: "☕",
  chocolate: "🍫",
  pudding: "🍮",
  cake: "🍰",
  sweet_bowl: "🥣",
  soup: "🍲",
  rice: "🍚",
  chicken: "🍗",
  meat: "🥩",
  sandwich: "🥪",
  other: "🥘",
};

/**
 * Deterministic Soft UI classifier — emoji + matching pastel from EMOJI_STYLE_MAP.
 * Pasta → 🍝 yellow · Eggs/toast → 🍳 amber · Yogurt/bowl → 🥣 rose · etc.
 *
 * `dishType` (optional) is the language-independent field above — when
 * present and recognized, it's used directly and title-keyword matching is
 * skipped entirely. Falls back to keyword matching on `dishTitle` when
 * `dishType` is missing/unrecognized (legacy saved recipes, local
 * fallback templates that don't set it, or an "other"/unmapped value).
 */
export function getDishEmojiAndStyle(dishTitle, dishType) {
  const mappedEmoji = dishType && DISH_TYPE_TO_EMOJI[dishType];
  if (mappedEmoji && mappedEmoji !== "🥘") {
    return styleFromEmoji(mappedEmoji);
  }

  if (dishTitle == null || dishTitle === "") {
    return styleFromEmoji("🥘");
  }

  const t = String(dishTitle).toLowerCase();
  let emoji = "🥘";

  if (
    t.includes("pasta") ||
    t.includes("fettuccine") ||
    t.includes("spaghetti") ||
    t.includes("penne") ||
    t.includes("lasagna") ||
    t.includes("lasagne") ||
    t.includes("macaroni") ||
    t.includes("linguine") ||
    t.includes("carbonara") ||
    t.includes("bolognese") ||
    t.includes("makaron") ||
    t.includes("noodle") ||
    t.includes("ramen") ||
    t.includes("cannelloni") ||
    t.includes("ravioli") ||
    t.includes("gnocchi") ||
    t.includes("tortellini") ||
    t.includes("rigatoni") ||
    t.includes("tagliatelle") ||
    t.includes("farfalle") ||
    t.includes("ziti") ||
    t.includes("orzo")
  ) {
    emoji = t.includes("noodle") || t.includes("ramen") ? "🍜" : "🍝";
  } else if (
    t.includes("bread") ||
    t.includes("crispbread") ||
    t.includes("toast") ||
    t.includes("baguette") ||
    t.includes("sourdough") ||
    t.includes("bagel") ||
    t.includes("bruschetta") ||
    t.includes("panini") ||
    t.includes("flatbread") ||
    t.includes("chleb") ||
    t.includes("bułk") ||
    t.includes("bulk")
  ) {
    emoji = "🍞";
  } else if (
    t.includes("pancake") ||
    t.includes("naleśnik") ||
    t.includes("nalesnik")
  ) {
    emoji = "🥞";
  } else if (
    // Word-boundary match on "oat"/"oats" — a plain .includes() would also
    // fire inside "goat", "float", "coat", "boat".
    /\bporridge\b/.test(t) ||
    /\boatmeal\b/.test(t) ||
    /\boats?\b/.test(t) ||
    t.includes("muesli") ||
    t.includes("granola") ||
    t.includes("congee")
  ) {
    emoji = "🥣";
  } else if (
    // Salad checked ahead of the egg rules below — "Egg Salad" is
    // fundamentally a salad, not a fried-egg dish, but it contains "egg"
    // and would otherwise always match that rule first.
    t.includes("salad") ||
    t.includes("sałatk") ||
    t.includes("caprese") ||
    t.includes("caesar") ||
    t.includes("slaw") ||
    t.includes("tabbouleh") ||
    t.includes("tabouli")
  ) {
    emoji = "🥗";
  } else if (
    t.includes("omelet") ||
    t.includes("omelette") ||
    t.includes("frittata")
  ) {
    emoji = "🍳";
  } else if (
    // Scrambled eggs and any other bare egg/breakfast mention are cooked
    // dishes, not a raw ingredient — 🍳 (egg actually cooking), never the
    // bare 🥚, same reasoning as the omelet/frittata branch above.
    t.includes("scramble") ||
    t.includes("scrambled") ||
    t.includes("egg") ||
    t.includes("breakfast") ||
    t.includes("jajk") ||
    t.includes("śniadan")
  ) {
    emoji = "🍳";
  } else if (
    t.includes("chocolate") ||
    t.includes("cocoa") ||
    t.includes("mocha") ||
    t.includes("coffee") ||
    t.includes("espresso") ||
    t.includes("cappuccino") ||
    t.includes("latte") ||
    t.includes("kawa")
  ) {
    emoji =
      t.includes("chocolate") || t.includes("cocoa") || t.includes("mocha")
        ? "🍫"
        : "☕";
  } else if (
    t.includes("pudding") ||
    t.includes("custard") ||
    t.includes("flan") ||
    t.includes("panna cotta") ||
    t.includes("creme brulee") ||
    t.includes("crème brûlée")
  ) {
    emoji = "🍮";
  } else if (
    t.includes("cake") ||
    t.includes("cheesecake") ||
    t.includes("brownie") ||
    t.includes("tiramisu")
  ) {
    emoji = "🍰";
  } else if (
    // Deliberately no bare "bowl" here — buddha bowls, stir-fry bowls, and
    // grain bowls are savory, not dessert. Only specific sweet-dish words
    // route here.
    t.includes("yogurt") ||
    t.includes("jogurt") ||
    t.includes("parfait") ||
    t.includes("dessert") ||
    t.includes("smoothie") ||
    t.includes("mousse")
  ) {
    emoji = "🥣";
  } else if (
    t.includes("soup") ||
    t.includes("stew") ||
    t.includes("broth") ||
    t.includes("chowder") ||
    t.includes("bisque") ||
    t.includes("curry") ||
    t.includes("gulasz") ||
    t.includes("zupa")
  ) {
    emoji = "🍲";
  } else if (
    t.includes("rice") ||
    t.includes("risotto") ||
    t.includes("quinoa") ||
    t.includes("couscous") ||
    t.includes("pilaf") ||
    t.includes("paella") ||
    t.includes("ryż") ||
    t.includes("ryz")
  ) {
    emoji = "🍚";
  } else if (
    t.includes("chicken") ||
    t.includes("kurczak") ||
    t.includes("poultry") ||
    t.includes("turkey")
  ) {
    emoji = "🍗";
  } else if (
    t.includes("steak") ||
    t.includes("beef") ||
    t.includes("wołowina") ||
    t.includes("pork") ||
    t.includes("chop") ||
    t.includes("lamb") ||
    t.includes("ribs") ||
    t.includes("wieprzow") ||
    t.includes("schnitzel") ||
    t.includes("meatball") ||
    t.includes("kebab") ||
    t.includes("roast")
  ) {
    emoji = "🥩";
  } else if (
    t.includes("sandwich") ||
    t.includes("wrap") ||
    t.includes("burger") ||
    t.includes("kanapka") ||
    t.includes("toastie")
  ) {
    emoji = "🥪";
  }

  return styleFromEmoji(emoji);
}

/**
 * Resolve badge colors for ThemeContext isDark.
 */
export function resolveCategoryBadgeColors(style, isDark = false) {
  const s = style?.bgColor
    ? style
    : styleFromEmoji(style?.emoji || "🥘");
  return {
    backgroundColor: isDark ? s.bgColorDark || s.bgColor : s.bgColor,
    borderColor: isDark
      ? s.borderColorDark || s.borderColor
      : s.borderColor || "#E2E8F0",
    color: isDark ? s.textColorDark || s.textColor : s.textColor,
  };
}

/** Soft UI class for emoji box. */
export function categoryToBgClass(category) {
  const key = String(category || "snack").toLowerCase();
  return CATEGORY_COLORS[key] || CATEGORY_COLORS.snack;
}

/** @deprecated Prefer getDishEmojiAndStyle */
export const EMOJI_STYLES = {
  breakfast: styleFromEmoji("🍳"),
  pasta: styleFromEmoji("🍝"),
  salad: styleFromEmoji("🥗"),
  soup: styleFromEmoji("🍲"),
  dessert: styleFromEmoji("🥣"),
  meat: styleFromEmoji("🍗"),
  snack: styleFromEmoji("🥘"),
  default: styleFromEmoji("🥘"),
};

export const CATEGORY_STYLES = EMOJI_STYLES;

export const CATEGORY_EMOJI = {
  breakfast: "🥐",
  lunch: "🍲",
  dinner: "🌙",
  snack: "🥗",
  dessert: "🍰",
};

/**
 * Precision culinary classifier — delegates to Soft UI mapper.
 */
export function getBestDishEmoji(dishTitle) {
  return getDishEmojiAndStyle(dishTitle)?.emoji || "🥘";
}

/**
 * Resolve pastel Soft UI style object for a known dish emoji.
 */
export function getStyleForEmoji(emoji) {
  return styleFromEmoji(emoji || "🥘");
}

/**
 * Deterministic helper: precise emoji + Soft UI pastel for cards / modals.
 */
export function getDishEmojiAndColor(dishTitle, dishType) {
  const style = getDishEmojiAndStyle(dishTitle, dishType);
  return {
    emoji: style.emoji,
    bgClass: style.bgClass,
    category: style.category,
    bgColor: style.bgColor,
    borderColor: style.borderColor,
    bgColorDark: style.bgColorDark,
    borderColorDark: style.borderColorDark,
    style: style.style,
    ...style,
  };
}

/** Prefer getDishEmojiAndColor — category meal-type emoji fallback. */
export function getDishEmoji(dishTitle, category) {
  try {
    const matched = getDishEmojiAndStyle(dishTitle);
    if (matched?.emoji) return matched.emoji;
    return CATEGORY_EMOJI[category] || "🥘";
  } catch {
    return "🥘";
  }
}

/** @deprecated Prefer getDishEmojiAndColor */
export function getFallbackEmoji(dishTitle, category) {
  return getDishEmoji(dishTitle, category);
}

// CODE-LEVEL DISHTYPE SANITY CHECK — confirmed real failure, not a
// hypothetical: a live "Kidney Bean Skillet" (no meat anywhere in its
// ingredientsList) came back from Gemini tagged dishType "meat", which
// DISH_TYPE_TO_EMOJI maps straight to a raw-steak 🥩 — an unappetizing,
// flatly wrong icon on a vegetarian dish. Same "prompt wording alone isn't
// reliable enough" lesson as the diet/allergy guardrail in geminiRecipes.js:
// the model appears to reach for "meat" as a catch-all for "savory
// protein-forward dish" even when the protein is beans, not literal meat.
// Since dishType only unlocks the "trust it directly" branch above when it
// maps to a real ingredient-specific icon (🥩/🍗), this check only needs to
// cover the ones that claim a specific animal protein is present — a false
// "meat"/"chicken" reads as actively wrong, unlike "other" which is
// honestly generic.
const REAL_MEAT_KEYWORDS = [
  "beef", "steak", "pork", "lamb", "veal", "bacon", "ham", "sausage",
  "meatball", "ground meat", "mince", "ribs", "prosciutto",
];
const REAL_POULTRY_KEYWORDS = ["chicken", "turkey", "duck", "poultry"];

function textContainsWholeWord(lowerText, word) {
  const idx = lowerText.indexOf(word);
  if (idx === -1) return false;
  const before = idx > 0 ? lowerText[idx - 1] : " ";
  const after =
    idx + word.length < lowerText.length ? lowerText[idx + word.length] : " ";
  return !/[a-z]/i.test(before) && !/[a-z]/i.test(after);
}

/**
 * Returns a corrected dishType when "meat"/"chicken" doesn't actually match
 * anything in the recipe's own ingredients or title — otherwise returns
 * dishType unchanged. Never touches any other dishType value.
 */
function sanityCheckDishType(recipe) {
  const dishType = recipe?.dishType;
  if (dishType !== "meat" && dishType !== "chicken") return dishType;

  const keywords = dishType === "chicken" ? REAL_POULTRY_KEYWORDS : REAL_MEAT_KEYWORDS;
  const haystack = [
    recipe?.title,
    ...(Array.isArray(recipe?.ingredientsList) ? recipe.ingredientsList : []),
  ]
    .map((s) => String(s || "").toLowerCase())
    .join(" | ");

  const confirmed = keywords.some((word) => textContainsWholeWord(haystack, word));
  return confirmed ? dishType : "other";
}

/**
 * Stamp recipes with Soft UI emoji metadata only.
 * Strips any AI / CDN / stock image fields — cards render emoji exclusively.
 */
export function stampRecipeEmojis(recipes) {
  try {
    if (!Array.isArray(recipes)) return [];
    return recipes
      .filter((recipe) => recipe && typeof recipe === "object")
      .map((recipe, idx) => {
        try {
          const title = recipe?.title;
          const correctedDishType = sanityCheckDishType(recipe);
          const dishStyle = getDishEmojiAndStyle(title, correctedDishType);
          const next = {
            ...recipe,
            dishType: correctedDishType,
            emoji: dishStyle.emoji,
            emojiBgClass: dishStyle.bgClass,
            dishCategory: dishStyle.category,
            cardIndex: idx,
          };
          // Absolute purge — never feed network/SVG images to cards
          delete next.aiImageUrl;
          delete next.imageUrl;
          delete next.image;
          delete next.photoUrl;
          delete next.thumbnail;
          delete next.vectorType;
          return next;
        } catch {
          return {
            ...recipe,
            emoji: "🥘",
            emojiBgClass: CATEGORY_COLORS.snack,
            dishCategory: "snack",
            cardIndex: idx,
          };
        }
      });
  } catch (err) {
    console.warn("[Cook AI] stampRecipeEmojis failed:", err?.message);
    return Array.isArray(recipes) ? recipes.filter(Boolean) : [];
  }
}

/** @deprecated Prefer stampRecipeEmojis — Soft UI emoji only, no CDN. */
export function stampRecipeImages(recipes) {
  return stampRecipeEmojis(recipes);
}

/** Alias — Soft UI emoji stamp (never fetches pollinations / flux / CDN). */
export function assignUniqueRecipeImages(recipes) {
  return stampRecipeEmojis(recipes);
}

export async function assignUniqueRecipeImagesAsync(recipes) {
  return stampRecipeEmojis(recipes);
}

/**
 * Unified clean styling for all ingredient pills (Apple HIG minimalist).
 * Unique emoji per item — shared slate chrome for every chip.
 */
export const UNIFIED_PILL_STYLE = {
  bg: "bg-white",
  text: "text-slate-800",
  border: "border-gray-200",
  bgColor: "#FFFFFF",
  textColor: "#1E293B",
  borderColor: "#E5E7EB",
};

/** @deprecated Category pastel map retired — pills use UNIFIED_PILL_STYLE. */
export const INGREDIENT_CATEGORY_MAP = {
  Default: { emoji: "🛒", ...UNIFIED_PILL_STYLE },
};
export const CATEGORY_MAP = INGREDIENT_CATEGORY_MAP;

/** Exact fridge staples → unique emoji (string values). */
export const INGREDIENT_LOOKUP = {
  "natural yogurt": "🥣",
  "greek yogurt": "🥣",
  yogurt: "🥣",
  "cottage cheese": "🧀",
  "serek wiejski": "🧀",
  mascarpone: "🧀",
  "sour cream": "🥛",
  "cream cheese": "🧀",
  hummus: "🫙",
  mayonnaise: "🧴",
  mayo: "🧴",
  "olive oil": "🫒",
  "sesame oil": "🍾",
  "soy sauce": "🍾",
  mustard: "🟡",
  pesto: "🫙",
  jam: "🍯",
  broth: "🍲",
  soup: "🍲",
  eggs: "🥚",
  egg: "🥚",
  chicken: "🍗",
  beef: "🥩",
  salmon: "🐟",
  tuna: "🐟",
  tofu: "🧊",
  apple: "🍎",
  melon: "🍈",
  lemon: "🍋",
  lime: "🍋",
  avocado: "🥑",
  banana: "🍌",
  berries: "🫐",
  berry: "🫐",
  "red bell pepper": "🫑",
  "bell pepper": "🫑",
  "spring onions": "🧅",
  "spring onion": "🧅",
  chives: "🌿",
  onion: "🧅",
  garlic: "🧄",
  tomato: "🍅",
  cucumber: "🥒",
  lettuce: "🥬",
  spinach: "🥬",
  broccoli: "🥦",
  carrot: "🥕",
  "oat milk": "🌾",
  milk: "🥛",
  butter: "🧈",
  cheese: "🧀",
};

function resolveLookupEmoji(key = "") {
  if (!key) return "🛒";
  if (INGREDIENT_LOOKUP[key]) return INGREDIENT_LOOKUP[key];

  let best = null;
  let bestLen = 0;
  for (const [k, emoji] of Object.entries(INGREDIENT_LOOKUP)) {
    if (key.includes(k) || k.includes(key)) {
      if (k.length > bestLen) {
        best = emoji;
        bestLen = k.length;
      }
    }
  }
  if (best) return best;

  // Lightweight keyword fallback (emoji only — chrome stays unified)
  if (/yogurt|jogurt/.test(key)) return "🥣";
  if (/twar[oó]g|cottage|serek|mascarpone|cheese|ser/.test(key)) return "🧀";
  if (/mayo/.test(key)) return "🧴";
  if (/mustard/.test(key)) return "🟡";
  if (/hummus|pesto/.test(key)) return "🫙";
  if (/olive\s*oil|oliwa/.test(key)) return "🫒";
  if (/soy|sesame\s*oil|sauce/.test(key)) return "🍾";
  if (/egg|jajk/.test(key)) return "🥚";
  if (/apple|jabł/.test(key)) return "🍎";
  if (/peach|nectarine|brzoskwinia/.test(key)) return "🍑";
  if (/melon/.test(key)) return "🍈";
  if (/lemon|lime|citrus/.test(key)) return "🍋";
  if (/pepper|papryk/.test(key)) return "🫑";
  if (/onion|cebula|spring\s*onion/.test(key)) return "🧅";
  if (/garlic|czosnek/.test(key)) return "🧄";
  if (/oat\s*milk/.test(key)) return "🌾";
  if (/milk|mleko|cream|śmietan/.test(key)) return "🥛";
  if (/chicken|kurczak/.test(key)) return "🍗";
  if (/broth|soup|stock/.test(key)) return "🍲";
  return "🫙";
}

/**
 * Unique emoji + unified white/slate pill chrome (no dynamic petal tinting).
 */
export function getIngredientStyle(name = "") {
  const key = String(name || "")
    .toLowerCase()
    .trim();
  const emoji =
    classifyIngredientEmoji(name) || resolveLookupEmoji(key) || "🫙";
  return {
    emoji,
    ...UNIFIED_PILL_STYLE,
  };
}

/** Re-export ingredient classifier (Mascarpone, dairy, produce, meats). */
export { classifyIngredientEmoji as getIngredientEmoji, getIngredientMeta };
