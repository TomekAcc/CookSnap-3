import { generateContent } from "../src/services/geminiClient";
import { generateRecipesWithGemini, hasEnglishTitleIngredientMismatch, isUpgradeAlreadyOwned } from "../src/services/geminiRecipes";

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
