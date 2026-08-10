import { Ingredient, Recipe } from "@/types";
import { accentPalette } from "@/constants/theme";

/**
 * Smart Recipe Engine. With EXPO_PUBLIC_OPENAI_API_KEY set, recipes are
 * generated live from the pantry + scanned items. Otherwise a curated demo
 * generator composes 5 recipes from a template bank, tailored to whichever
 * ingredients are actually in stock.
 */

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const TEXT_MODEL = "gpt-4o-mini";
const RECIPE_COUNT = 5;
const STEP_LIMIT = 5;

const SYSTEM_PROMPT = `You are a professional chef writing ultra-concise recipes for a mobile app.
Rules:
- Return EXACTLY ${RECIPE_COUNT} recipes as strict JSON: {"recipes":[...]}.
- Each recipe has: title, description (max 12 words), steps (EXACTLY ${STEP_LIMIT} imperative, professional, concise steps), cookTimeMinutes, difficulty ("Easy"|"Medium"|"Hard"), servings (a realistic integer, usually 1-4), usedIngredients (array of ingredient names from the provided list), missingIngredients (array of 0-3 items not provided but needed).
- Prioritize using the ingredients provided. Never invent ingredients that contradict what's on hand.
- Output must be valid JSON only, no markdown.`;

function attachPresentation(raw: any[]): Recipe[] {
  return raw.slice(0, RECIPE_COUNT).map((r, index) => ({
    id: `recipe-${Date.now()}-${index}`,
    title: r.title,
    description: r.description ?? "",
    steps: (r.steps ?? []).slice(0, STEP_LIMIT),
    usedIngredients: r.usedIngredients ?? [],
    missingIngredients: r.missingIngredients ?? [],
    cookTimeMinutes: r.cookTimeMinutes ?? 20,
    difficulty: r.difficulty ?? "Easy",
    servings: r.servings ?? 2,
    accentColor: accentPalette[index % accentPalette.length],
  }));
}

async function generateWithOpenAI(ingredientNames: string[]): Promise<Recipe[]> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Available ingredients: ${ingredientNames.join(", ")}` },
      ],
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    throw new Error(`Recipe request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  return attachPresentation(Array.isArray(parsed.recipes) ? parsed.recipes : []);
}

interface RecipeTemplate {
  title: string;
  description: string;
  steps: string[];
  requires: string[];
  cookTimeMinutes: number;
  difficulty: Recipe["difficulty"];
  servings: number;
}

const TEMPLATE_BANK: RecipeTemplate[] = [
  {
    title: "Garlic Herb Skillet Eggs",
    description: "Fluffy eggs with garlic and fresh herbs.",
    steps: [
      "Heat olive oil in a skillet over medium heat.",
      "Sauté minced garlic until fragrant, about 30 seconds.",
      "Crack eggs into the skillet and season with salt and pepper.",
      "Cook until whites set, 3–4 minutes.",
      "Plate and finish with a drizzle of olive oil.",
    ],
    requires: ["Eggs", "Garlic"],
    cookTimeMinutes: 10,
    difficulty: "Easy",
    servings: 1,
  },
  {
    title: "Charred Broccoli & Chicken Bowl",
    description: "Seared chicken over charred broccoli and rice.",
    steps: [
      "Season chicken breast with salt and pepper.",
      "Sear chicken in a hot pan, 5 minutes per side.",
      "Rest chicken, then slice.",
      "Char broccoli in the same pan until edges blacken.",
      "Serve chicken and broccoli over steamed rice.",
    ],
    requires: ["Chicken Breast", "Broccoli", "Rice"],
    cookTimeMinutes: 25,
    difficulty: "Medium",
    servings: 2,
  },
  {
    title: "Creamy Spinach & Yogurt Toss",
    description: "Wilted spinach in a cool, tangy yogurt sauce.",
    steps: [
      "Wilt spinach in a hot pan for 2 minutes.",
      "Remove from heat and let cool slightly.",
      "Whisk Greek yogurt with a pinch of salt and lemon juice.",
      "Fold wilted spinach into the yogurt sauce.",
      "Serve chilled or at room temperature.",
    ],
    requires: ["Spinach", "Greek Yogurt", "Lemon"],
    cookTimeMinutes: 8,
    difficulty: "Easy",
    servings: 2,
  },
  {
    title: "Tomato Cheddar Melt",
    description: "Cherry tomatoes bubbling under melted cheddar.",
    steps: [
      "Preheat broiler to high.",
      "Halve cherry tomatoes and arrange in a baking dish.",
      "Season with salt, pepper, and a splash of olive oil.",
      "Top generously with shredded cheddar cheese.",
      "Broil until cheese is bubbling and golden, 3–5 minutes.",
    ],
    requires: ["Cherry Tomatoes", "Cheddar Cheese"],
    cookTimeMinutes: 12,
    difficulty: "Easy",
    servings: 2,
  },
  {
    title: "Avocado Lemon Grain Bowl",
    description: "Bright avocado and lemon over warm rice.",
    steps: [
      "Cook rice according to package instructions.",
      "Slice avocado and squeeze lemon juice over it.",
      "Season avocado with salt and pepper.",
      "Spoon warm rice into a bowl.",
      "Top with avocado, lemon zest, and a drizzle of olive oil.",
    ],
    requires: ["Avocado", "Lemon", "Rice"],
    cookTimeMinutes: 15,
    difficulty: "Easy",
    servings: 1,
  },
  {
    title: "Carrot Ginger Sheet Roast",
    description: "Caramelized carrots roasted until tender-sweet.",
    steps: [
      "Preheat oven to 425°F (220°C).",
      "Toss carrots with olive oil, salt, and pepper.",
      "Spread carrots on a sheet pan in a single layer.",
      "Roast for 20 minutes, tossing halfway.",
      "Finish with a squeeze of lemon before serving.",
    ],
    requires: ["Carrots", "Lemon"],
    cookTimeMinutes: 25,
    difficulty: "Easy",
    servings: 4,
  },
  {
    title: "Pantry Garlic Butter Pasta",
    description: "Silky pasta tossed in garlic butter sauce.",
    steps: [
      "Boil pasta in salted water until al dente.",
      "Melt butter in a pan with minced garlic.",
      "Reserve a splash of pasta water, then drain pasta.",
      "Toss pasta into the garlic butter with reserved water.",
      "Season with salt, pepper, and serve immediately.",
    ],
    requires: ["Pasta", "Butter", "Garlic"],
    cookTimeMinutes: 15,
    difficulty: "Easy",
    servings: 2,
  },
];

function scoreTemplate(template: RecipeTemplate, available: Set<string>): number {
  const matched = template.requires.filter((r) => available.has(r.toLowerCase())).length;
  return matched / template.requires.length;
}

async function generateDemo(ingredientNames: string[]): Promise<Recipe[]> {
  await new Promise((resolve) => setTimeout(resolve, 700));
  const available = new Set(ingredientNames.map((n) => n.toLowerCase()));

  const ranked = [...TEMPLATE_BANK].sort(
    (a, b) => scoreTemplate(b, available) - scoreTemplate(a, available)
  );

  const chosen = ranked.slice(0, RECIPE_COUNT);

  const raw = chosen.map((t) => ({
    title: t.title,
    description: t.description,
    steps: t.steps,
    cookTimeMinutes: t.cookTimeMinutes,
    difficulty: t.difficulty,
    servings: t.servings,
    usedIngredients: t.requires.filter((r) => available.has(r.toLowerCase())),
    missingIngredients: t.requires.filter((r) => !available.has(r.toLowerCase())),
  }));

  return attachPresentation(raw);
}

export async function generateRecipes(ingredients: Ingredient[]): Promise<Recipe[]> {
  const names = ingredients.filter((i) => i.status === "in_stock").map((i) => i.name);
  return OPENAI_API_KEY ? generateWithOpenAI(names) : generateDemo(names);
}

export const isRecipeEngineLive = Boolean(OPENAI_API_KEY);
