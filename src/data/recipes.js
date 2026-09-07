import {
  getDishEmojiAndStyle,
} from "../utils/imageUtils";

export const CATEGORY_STYLE = {
  breakfast: { emoji: "🥐", colors: ["#F59E0B", "#EA580C"] },
  lunch: { emoji: "🍲", colors: ["#10B981", "#059669"] },
  dinner: { emoji: "🌙", colors: ["#0F172A", "#1E293B"] },
  snack: { emoji: "🥗", colors: ["#22C55E", "#16A34A"] },
  dessert: { emoji: "🍰", colors: ["#EC4899", "#BE185D"] },
};

export const MEAL_TYPES = [
  { id: "all", label: "All", emoji: "🥘" },
  { id: "breakfast", label: "Breakfast", emoji: "🥐" },
  { id: "lunch", label: "Lunch", emoji: "🍲" },
  { id: "dinner", label: "Dinner", emoji: "🌙" },
  { id: "snack", label: "Snack", emoji: "🥗" },
  { id: "dessert", label: "Dessert", emoji: "🍰" },
];

export const HUNGER_LEVELS = [
  { id: "light", label: "Light", emoji: "🥗", description: "Snack / Light portion" },
  { id: "normal", label: "Normal", emoji: "🍝", description: "Standard portion" },
  { id: "hungry", label: "Hearty", emoji: "🥩", description: "Filling / Hearty portion" },
];

export const POPULAR_PANTRY = [
  { id: "rice", name: "Rice", emoji: "🍚" },
  { id: "onion", name: "Onion", emoji: "🧅" },
  { id: "cheese", name: "Cheese", emoji: "🧀" },
  { id: "canned-tomatoes", name: "Canned Tomatoes", emoji: "🥫" },
];

export const PANTRY_STAPLES = [
  {
    id: "olive-oil",
    name: "Olive Oil",
    emoji: "🫒",
    category: "Oils & Sauces",
    inStock: true,
  },
  {
    id: "salt",
    name: "Salt",
    emoji: "🧂",
    category: "Spices & Herbs",
    inStock: true,
  },
  {
    id: "pepper",
    name: "Pepper",
    emoji: "🧂",
    category: "Spices & Herbs",
    inStock: true,
  },
  {
    id: "garlic",
    name: "Garlic",
    emoji: "🧄",
    category: "Spices & Herbs",
    inStock: true,
  },
  {
    id: "pasta",
    name: "Pasta",
    emoji: "🍝",
    category: "Grains & Baking",
    inStock: true,
  },
  {
    id: "soy-sauce",
    name: "Soy Sauce",
    emoji: "🍾",
    category: "Oils & Sauces",
    inStock: true,
  },
  {
    id: "butter",
    name: "Butter",
    emoji: "🧈",
    category: "Oils & Sauces",
    inStock: true,
  },
  {
    id: "flour",
    name: "Flour",
    emoji: "🌾",
    category: "Grains & Baking",
    inStock: false,
  },
  {
    id: "honey",
    name: "Honey",
    emoji: "🍯",
    category: "Condiments",
    inStock: false,
  },
  {
    id: "oregano",
    name: "Oregano",
    emoji: "🌿",
    category: "Spices & Herbs",
    inStock: false,
  },
];

export const PANTRY_CATEGORIES = [
  "All",
  "Spices & Herbs",
  "Oils & Sauces",
  "Grains & Baking",
  "Condiments",
];

// Exactly 5 default recipes — dish-matched emoji badges (🍳 🥘 🍞 🍨 🍝)
const RAW_RECIPES = [
  {
    id: "1",
    title: "Zesty Lemon Yogurt Poached Egg Bowl",
    category: "breakfast",
    vectorType: "egg_bowl",
    prepTime: 8,
    cookTime: 10,
    baseServings: 2,
    isPro: false,
    matchBadge: "✨ Uses 4 items from fridge",
    matchCount: 4,
    ingredients: [
      { name: "Eggs", amount: 2, unit: "pcs" },
      { name: "Yogurt", amount: 150, unit: "g" },
      { name: "Lemon", amount: 1, unit: "pcs" },
      { name: "Fresh Herbs", amount: 1, unit: "handful" },
    ],
    steps: [
      "Warm yogurt gently and season with lemon zest.",
      "Poach eggs in simmering water for about 3 minutes.",
      "Spoon yogurt into bowls and nestle a poached egg on top.",
      "Finish with herbs, lemon juice, and black pepper.",
    ],
  },
  {
    id: "2",
    title: "Red Bell Pepper and Tofu Stir-Fry",
    category: "dinner",
    vectorType: "stir_fry",
    prepTime: 10,
    cookTime: 12,
    baseServings: 2,
    isPro: false,
    matchBadge: "✨ Uses 3 items from fridge",
    matchCount: 3,
    ingredients: [
      { name: "Tofu", amount: 200, unit: "g" },
      { name: "Red Bell Pepper", amount: 1, unit: "pcs" },
      { name: "Garlic", amount: 2, unit: "cloves" },
      { name: "Soy Sauce", amount: 30, unit: "ml" },
    ],
    steps: [
      "Cube tofu and slice red bell pepper into strips.",
      "Sear tofu in a hot pan until golden on the edges.",
      "Add pepper and garlic; stir-fry 4–5 minutes.",
      "Finish with soy sauce and serve hot from the pan.",
    ],
  },
  {
    id: "3",
    title: "Sweet Jam and Butter Toast Snack",
    category: "breakfast",
    vectorType: "toast",
    prepTime: 3,
    cookTime: 5,
    baseServings: 2,
    isPro: false,
    matchBadge: "✨ Uses 3 items from fridge",
    matchCount: 3,
    ingredients: [
      { name: "Bread", amount: 4, unit: "slices" },
      { name: "Butter", amount: 20, unit: "g" },
      { name: "Jam", amount: 40, unit: "g" },
    ],
    steps: [
      "Toast bread until crisp and golden.",
      "Spread a thin layer of soft butter.",
      "Add a generous spoon of jam.",
      "Serve immediately while warm.",
    ],
  },
  {
    id: "4",
    title: "Apple Yogurt Dessert Parfait",
    category: "dessert",
    vectorType: "parfait",
    prepTime: 8,
    cookTime: 5,
    baseServings: 2,
    isPro: false,
    matchBadge: "✨ Uses 3 items from fridge",
    matchCount: 3,
    ingredients: [
      { name: "Apple", amount: 2, unit: "pcs" },
      { name: "Yogurt", amount: 200, unit: "g" },
      { name: "Honey", amount: 20, unit: "g" },
    ],
    steps: [
      "Dice apples and soften briefly with a drizzle of honey.",
      "Cool the apples slightly.",
      "Layer yogurt, apples, and a crunchy sprinkle in glasses.",
      "Finish with honey and serve chilled or room temp.",
    ],
  },
  {
    id: "5",
    title: "Garlic Butter Fettuccine Pasta",
    category: "dinner",
    vectorType: "pasta",
    prepTime: 5,
    cookTime: 12,
    baseServings: 2,
    isPro: false,
    matchBadge: "✨ Uses 3 items from fridge",
    matchCount: 3,
    ingredients: [
      { name: "Fettuccine", amount: 200, unit: "g" },
      { name: "Garlic", amount: 3, unit: "cloves" },
      { name: "Butter", amount: 40, unit: "g" },
      { name: "Salt & Pepper", amount: 1, unit: "pinch" },
    ],
    steps: [
      "Boil fettuccine in salted water until al dente, then drain.",
      "Melt butter and sauté minced garlic until fragrant.",
      "Toss pasta in the garlic butter until glossy.",
      "Season and finish with fresh herbs if available.",
    ],
  },
];

/** Safe module-level init — Soft UI emoji + pastel badge metadata (no photos). */
function buildRecipesWithEmojiBadges(raw) {
  try {
    return (raw || []).map((recipe, idx) => {
      try {
        const style = getDishEmojiAndStyle(recipe?.title);
        return {
          ...recipe,
          emoji: style.emoji,
          emojiBgClass: style.bgClass,
          dishCategory: style.category,
          cardIndex: idx,
        };
      } catch {
        return {
          ...recipe,
          emoji: "🥘",
          emojiBgClass: "bg-stone-100/60 border-stone-200/50",
          dishCategory: "default",
          cardIndex: idx,
        };
      }
    });
  } catch (err) {
    console.warn("[Cook AI] Failed to stamp recipe emoji badges on boot:", err?.message);
    return (raw || []).map((recipe, idx) => ({
      ...recipe,
      emoji: "🥘",
      emojiBgClass: "bg-stone-100/60 border-stone-200/50",
      dishCategory: "default",
      cardIndex: idx,
    }));
  }
}

export const RECIPES = buildRecipesWithEmojiBadges(RAW_RECIPES);

/** Guaranteed 5-recipe fallback used by context if filtering / network fails. */
export const FALLBACK_RECIPES = RECIPES.slice(0, 5);

export function scaleAmount(amount, baseServings, targetServings) {
  const scaled = (amount * targetServings) / baseServings;
  if (Number.isInteger(scaled)) return scaled;
  return Math.round(scaled * 10) / 10;
}

/** Always return up to 5 free recipes for the default feed. Never throws. */
export function filterRecipes(recipes, mealType, hungerLevel) {
  try {
    const list = Array.isArray(recipes) ? recipes : [];
    let filtered = list.filter((r) => r && !r.isPro);

    if (mealType !== "all") {
      filtered = filtered.filter((r) => r.category === mealType);
    }

    if (hungerLevel === "light") {
      filtered = filtered.filter(
        (r) =>
          r.category === "snack" ||
          r.category === "dessert" ||
          (Number(r.prepTime) || 0) + (Number(r.cookTime) || 0) <= 20
      );
    } else if (hungerLevel === "hungry") {
      filtered = filtered.filter(
        (r) => (r.baseServings || 0) >= 2 || (Number(r.cookTime) || 0) >= 10
      );
    }

    if (filtered.length === 0) {
      filtered = list.filter((r) => r && !r.isPro);
    }

    return filtered.slice(0, 5);
  } catch (err) {
    console.warn("[Cook AI] filterRecipes failed:", err?.message);
    return Array.isArray(recipes) ? recipes.filter(Boolean).slice(0, 5) : [];
  }
}
