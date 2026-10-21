// Live checks of every Gemini call path against the real API. NOT part of
// `npm test` / CI (it needs a key, the network, and spends a few requests):
//
//   npm run test:live
//
// Run it after touching src/services/gemini*.js, a prompt, or the model lists
// — it is the "pretest against the real dependency" step before an `eas update`.
// The key is read from EXPO_PUBLIC_GEMINI_API_KEY and is never printed.
import fs from "fs";
import path from "path";
import {
  analyzeFridgeImage,
  analyzePantryImage,
  classifyPantryItemWithGemini,
  translateIngredientNames,
} from "../src/services/geminiVision";
import {
  generateRecipesWithGemini,
  modifyRecipeWithGemini,
} from "../src/services/geminiRecipes";

const hasKey = !!process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const run = hasKey ? describe : describe.skip;
jest.setTimeout(120000);

const sampleFridgeBase64 = () =>
  fs.readFileSync(path.join(__dirname, "../assets/sample-fridge.jpg")).toString("base64");

// Several of these paths fall back silently on failure, so a passing
// assertion alone doesn't prove the API answered. Record every request.
const calls = [];
const realFetch = global.fetch;
global.fetch = async (url, init) => {
  const response = await realFetch(url, init);
  calls.push({ url: String(url), status: response.status });
  return response;
};

/** Runs `fn`, then asserts it made >= `min` requests, all answered 200, none with the key in the URL. */
async function expectLiveCalls(fn, min = 1) {
  const before = calls.length;
  const value = await fn();
  const made = calls.slice(before);
  expect(made.length).toBeGreaterThanOrEqual(min);
  expect(made.map((c) => c.status)).toEqual(made.map(() => 200));
  expect(made.every((c) => !c.url.includes("key="))).toBe(true);
  return value;
}

run("live Gemini", () => {
  let fridgeItems = [];

  it("analyzeFridgeImage reads the sample fridge", async () => {
    fridgeItems = await expectLiveCalls(() => analyzeFridgeImage(sampleFridgeBase64()));
    expect(Array.isArray(fridgeItems)).toBe(true);
    expect(fridgeItems.length).toBeGreaterThan(3);
    expect(fridgeItems[0]).toEqual(expect.objectContaining({ name: expect.any(String), icon: expect.any(String) }));
  });

  it("analyzePantryImage returns a (possibly empty) array", async () => {
    const items = await expectLiveCalls(() => analyzePantryImage(sampleFridgeBase64()));
    expect(Array.isArray(items)).toBe(true);
  });

  it("classifyPantryItemWithGemini picks a known category", async () => {
    const item = await expectLiveCalls(() => classifyPantryItemWithGemini("balsamic vinegar"));
    expect(["Spices & Herbs", "Oils & Sauces", "Grains & Baking", "Condiments & Jars"]).toContain(item.category);
    expect(item.name).toBe("Balsamic vinegar");
  });

  it("translateIngredientNames keeps count and order", async () => {
    const input = [
      { id: "1", name: "Milk", icon: "🥛" },
      { id: "2", name: "Cheese", icon: "🧀" },
    ];
    const out = await expectLiveCalls(() => translateIngredientNames(input, "Spanish"));
    expect(out).toHaveLength(2);
    expect(out.map((i) => i.id)).toEqual(["1", "2"]);
    expect(out[0].name).not.toBe("Milk"); // actually translated, not the silent no-op
  });

  let recipes = [];
  it("generateRecipesWithGemini (generation + editor pass) returns normalized recipes", async () => {
    const scanned = (fridgeItems.length ? fridgeItems : [{ name: "Eggs" }, { name: "Milk" }, { name: "Tomato" }]).slice(0, 8);
    // >= 2 requests: the generation itself plus the editor (QA) pass.
    recipes = await expectLiveCalls(
      () =>
        generateRecipesWithGemini(
          scanned,
          [{ name: "Salt", inStock: true }, { name: "Olive oil", inStock: true }],
          "dinner",
          2,
          "normal",
          null,
          "",
          3
        ),
      2
    );
    expect(recipes.length).toBeGreaterThan(0);
    for (const r of recipes) {
      expect(r.title).toEqual(expect.any(String));
      expect(r.steps.length).toBeGreaterThan(0);
      expect(r.ingredientsList.length).toBeGreaterThan(0);
    }
  });

  it("modifyRecipeWithGemini applies an instruction", async () => {
    const base = recipes[0];
    expect(base).toBeTruthy();
    const modified = await expectLiveCalls(() =>
      modifyRecipeWithGemini(base, "make it vegetarian", { vegetarian: true })
    );
    expect(modified.title).toEqual(expect.any(String));
    expect(modified.steps.length).toBeGreaterThan(0);
  });
});
