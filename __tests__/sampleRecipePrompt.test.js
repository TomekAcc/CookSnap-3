import { generateContent } from "../src/services/geminiClient";
import { generateRecipesWithGemini, hasEnglishTitleIngredientMismatch, isUpgradeAlreadyOwned, modifyRecipeWithGemini } from "../src/services/geminiRecipes";

jest.mock("../src/services/geminiClient", () => ({
  ...jest.requireActual("../src/services/geminiClient"),
  generateContent: jest.fn(),
}));

const fridge = [{ name: "Eggs" }, { name: "Spinach" }];
const pantry = [{ name: "Rice", inStock: true }];

async function firstPrompt(options) {
  generateContent.mockReset();
  generateContent.mockResolvedValue({ ok: true, text: "[]" });
  await generateRecipesWithGemini(fridge, pantry, "dinner", 2, "normal", null, "key", 3, false, [], "us", "English", options).catch(() => {});
  return generateContent.mock.calls[0][0].body.contents[0].parts[0].text;
}

describe("sample kitchen recipe prompt", () => {
  it("adds the showcase block only for the onboarding sample", async () => {
    expect(await firstPrompt({ sampleKitchen: true })).toContain("SAMPLE KITCHEN SHOWCASE");
    expect(await firstPrompt({ sampleKitchen: false })).not.toContain("SAMPLE KITCHEN SHOWCASE");
    expect(await firstPrompt(undefined)).not.toContain("SAMPLE KITCHEN SHOWCASE");
  });
});

describe("hasEnglishTitleIngredientMismatch", () => {
  const recipe = (title, ingredientsList) => ({ title, ingredientsList });

  it("flags a flavor word in the title that no ingredient backs up", () => {
    expect(hasEnglishTitleIngredientMismatch(recipe("Garlic Spinach Pasta", ["2 cups Pasta", "2 cups Spinach", "3 tbsp Butter"]))).toBe(true);
    expect(hasEnglishTitleIngredientMismatch(recipe("Creamy Rice", ["1 cup Rice", "2 cups Water"]))).toBe(true);
  });

  it("passes when the ingredient is there, or the title has no flavor word", () => {
    expect(hasEnglishTitleIngredientMismatch(recipe("Garlic Spinach Pasta", ["2 cups Pasta", "2 cloves Garlic"]))).toBe(false);
    expect(hasEnglishTitleIngredientMismatch(recipe("Honey Cinnamon Oatmeal", ["1 cup Rolled oats", "1 tbsp Honey"]))).toBe(false);
    expect(hasEnglishTitleIngredientMismatch(recipe("Tomato Pepper Rice", ["1 cup Rice", "1 Bell Pepper"]))).toBe(false);
  });
});

describe("isUpgradeAlreadyOwned", () => {
  const inventory = ["Milk", "Cheese", "Tomatoes", "Soy sauce", "Black pepper", "Rolled oats"];

  it("recognises an upgrade the person already has, whatever the plural or case", () => {
    expect(isUpgradeAlreadyOwned("Soy sauce", inventory)).toBe(true);
    expect(isUpgradeAlreadyOwned("cheese", inventory)).toBe(true);
    expect(isUpgradeAlreadyOwned("Tomato", inventory)).toBe(true);
    expect(isUpgradeAlreadyOwned("Oats", inventory)).toBe(true);
  });

  it("keeps a real suggestion, and an empty one", () => {
    expect(isUpgradeAlreadyOwned("Fresh Basil", inventory)).toBe(false);
    expect(isUpgradeAlreadyOwned("Feta Cheese", inventory)).toBe(false);
    expect(isUpgradeAlreadyOwned("", inventory)).toBe(false);
    expect(isUpgradeAlreadyOwned("Basil", [])).toBe(false);
  });
});

describe("salt rules in the recipe editor prompt", () => {
  const { RECIPE_QA_SYSTEM_PROMPT } = require("../src/services/geminiRecipes");

  it("separates water boiled in a big pot from grains cooked by absorption, and caps the salt", () => {
    expect(RECIPE_QA_SYSTEM_PROMPT).toMatch(/absorption method/);
    expect(RECIPE_QA_SYSTEM_PROMPT).toMatch(/3 g of salt \(1\/2 teaspoon\) per 100 g of dry grain/);
    expect(RECIPE_QA_SYSTEM_PROMPT).toMatch(/salt for the cooking water/);
  });

  it("no longer tells the editor to salt rice like pasta water, or to fold water salt into the single salt line", () => {
    expect(RECIPE_QA_SYSTEM_PROMPT).not.toMatch(/\(pasta, rice, potatoes, vegetables, eggs\)/);
    expect(RECIPE_QA_SYSTEM_PROMPT).not.toMatch(/water salt included/);
  });
});

describe("modify with AI: what the person has", () => {
  const recipe = { title: "Creamy Pasta", servings: "2", ingredientsList: ["160 g pasta", "50 ml milk"], steps: ["Boil.", "Mix.", "Serve."] };
  async function modifyPrompt(available) {
    generateContent.mockReset();
    generateContent.mockResolvedValue({ ok: true, text: "{}" });
    await modifyRecipeWithGemini(recipe, "make it dairy-free", null, "key", "metric", "English", available).catch(() => {});
    return generateContent.mock.calls[0][0].body.contents[0].parts[0].text;
  }

  it("lists the fridge and pantry and tells the model to use them before bringing in anything new", async () => {
    const text = await modifyPrompt(["Oat milk", "Pasta", "Oat milk", ""]);
    expect(text).toContain("WHAT THE USER HAS AT HOME: Oat milk, Pasta.");
    expect(text).toContain("AVAILABILITY RULE");
  });

  it("adds nothing when no list is given (the translate-only call)", async () => {
    expect(await modifyPrompt(undefined)).not.toContain("AVAILABILITY RULE");
    expect(await modifyPrompt([])).not.toContain("AVAILABILITY RULE");
  });
});
