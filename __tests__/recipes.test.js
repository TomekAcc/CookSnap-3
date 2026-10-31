import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, waitFor } from "@testing-library/react-native";
import { renderApp } from "../test-utils/renderApp";
import { toastStore } from "../src/utils/toastStore";
import { hideToast } from "../src/utils/toast";
import { STORAGE_KEYS } from "../src/storage/keys";

jest.mock("../src/services/geminiRecipes", () => ({
  ...jest.requireActual("../src/services/geminiRecipes"),
  generateRecipesWithGemini: jest.fn(),
  modifyRecipeWithGemini: jest.fn(),
  generatePlannerMealsWithGemini: jest.fn(),
}));
const gemini = require("../src/services/geminiRecipes");

const ai = (id, extra = {}) => ({ id, title: `Dish ${id}`, category: "dinner", dishType: `type-${id}`, isAiGenerated: true, languageId: "en", ingredientsList: ["1 egg"], steps: ["Cook."], ...extra });
const batch = (n) => Array.from({ length: n }, (_, i) => ai(`g${i + 1}`));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  hideToast();
  // Several tests below make generation / translation fail on purpose, which logs a warning.
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  hideToast();
  console.warn.mockRestore();
});

const withFridge = async () => {
  const app = await renderApp();
  act(() => app.result.current.inv.appendIngredients([{ name: "Egg" }, { name: "Milk" }]));
  return app;
};

describe("generateRecipes", () => {
  it("refuses with a toast when there is nothing to cook from", async () => {
    const { result } = await renderApp();
    await act(() => result.current.rec.generateRecipes());
    expect(gemini.generateRecipesWithGemini).not.toHaveBeenCalled();
    expect(toastStore.get()).toMatchObject({ type: "error" });
    expect(result.current.rec.generatedRecipes).toBeNull();
  });

  it("free users get a smaller batch; the request carries the user's whole context", async () => {
    gemini.generateRecipesWithGemini.mockResolvedValue(batch(5));
    const { result } = await withFridge();
    act(() => {
      result.current.prefs.setServings(3);
      result.current.prefs.setUnitSystem("metric");
      result.current.inv.addPantryItem({ id: "p", name: "Salt", category: "Spices & Herbs" });
    });
    await act(() => result.current.rec.generateRecipes());
    expect(result.current.rec.generatedRecipes).toHaveLength(3);
    expect(result.current.rec.isGeneratingRecipes).toBe(false);
    expect(result.current.rec.recipeGenerationFailed).toBe(false);
    expect(toastStore.get()).toMatchObject({ type: "success" });
    const args = gemini.generateRecipesWithGemini.mock.calls[0];
    expect(args[0].map((i) => i.name)).toEqual(["Egg", "Milk"]); // fridge
    expect(args[1].map((p) => p.name)).toEqual(["Salt"]); // in-stock pantry staples
    expect(args[3]).toBe(3); // servings
    expect(args[7]).toBe(3); // free batch size
    expect(args[10]).toBe("metric");
    expect(args[11]).toBe("English");
  });

  describe("sample pantry (onboarding sample fridge)", () => {
    const sampleNames = ["Pasta", "Sugar", "Honey", "Soy sauce", "Cinnamon", "Oregano", "Paprika", "Salt", "Black pepper", "Flour", "Rice", "Rolled oats"];

    it("is used for the sample fridge when the user has stocked nothing, and is never saved", async () => {
      gemini.generateRecipesWithGemini.mockResolvedValue(batch(5));
      const { result } = await withFridge();
      act(() => result.current.inv.markScanDemo(true));
      await act(() => result.current.rec.generateRecipes());
      expect(gemini.generateRecipesWithGemini.mock.calls[0][1].map((p) => p.name)).toEqual(sampleNames);
      expect(gemini.generateRecipesWithGemini.mock.calls[0][12]).toEqual({ sampleKitchen: true });
      expect(result.current.inv.pantryItems).toEqual([]);
      expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.pantryItems)) || "[]")).toEqual([]);
    });

    it("gives way to the user's own pantry, and to a real scan", async () => {
      gemini.generateRecipesWithGemini.mockResolvedValue(batch(5));
      const { result } = await withFridge();
      act(() => {
        result.current.inv.markScanDemo(true);
        result.current.inv.addPantryItem({ id: "p", name: "Salt", category: "Spices & Herbs" });
      });
      await act(() => result.current.rec.generateRecipes());
      expect(gemini.generateRecipesWithGemini.mock.calls[0][1].map((p) => p.name)).toEqual(["Salt"]);
      expect(gemini.generateRecipesWithGemini.mock.calls[0][12]).toEqual({ sampleKitchen: false });
    });

    it("is not used for a real fridge, or when pantry staples are switched off", async () => {
      gemini.generateRecipesWithGemini.mockResolvedValue(batch(5));
      const { result } = await withFridge();
      await act(() => result.current.rec.generateRecipes());
      expect(gemini.generateRecipesWithGemini.mock.calls[0][1]).toEqual([]);
      expect(gemini.generateRecipesWithGemini.mock.calls[0][12]).toEqual({ sampleKitchen: false });

      act(() => {
        result.current.inv.markScanDemo(true);
        result.current.prefs.setIncludePantryStaples(false);
      });
      await act(() => result.current.rec.generateRecipes());
      expect(gemini.generateRecipesWithGemini.mock.calls[1][1]).toEqual([]);
      expect(gemini.generateRecipesWithGemini.mock.calls[1][12]).toEqual({ sampleKitchen: false });
    });
  });

  it("PRO gets the full batch of five", async () => {
    gemini.generateRecipesWithGemini.mockResolvedValue(batch(5));
    const { result } = await withFridge();
    act(() => result.current.ent.activatePro());
    await act(() => result.current.rec.generateRecipes());
    expect(result.current.rec.generatedRecipes).toHaveLength(5);
    expect(gemini.generateRecipesWithGemini.mock.calls[0][7]).toBe(5);
  });

  it("leaves pantry staples out when the user turned them off", async () => {
    gemini.generateRecipesWithGemini.mockResolvedValue(batch(3));
    const { result } = await withFridge();
    act(() => {
      result.current.inv.addPantryItem({ id: "p", name: "Salt", category: "Spices & Herbs" });
      result.current.prefs.setIncludePantryStaples(false);
    });
    await act(() => result.current.rec.generateRecipes());
    expect(gemini.generateRecipesWithGemini.mock.calls[0][1]).toEqual([]);
  });

  it("regenerate passes the titles already shown so the model avoids repeating them", async () => {
    gemini.generateRecipesWithGemini.mockResolvedValue(batch(3));
    const { result } = await withFridge();
    await act(() => result.current.rec.generateRecipes());
    await act(() => result.current.rec.generateRecipes());
    expect(gemini.generateRecipesWithGemini.mock.calls[1][9]).toEqual(["Dish g1", "Dish g2", "Dish g3"]);
  });

  it("a failed first attempt shows the honest failure state, never fake recipes", async () => {
    gemini.generateRecipesWithGemini.mockRejectedValue(new Error("boom"));
    const { result } = await withFridge();
    await act(() => result.current.rec.generateRecipes());
    expect(result.current.rec.recipeGenerationFailed).toBe(true);
    expect(result.current.rec.generatedRecipes).toBeNull();
    expect(result.current.rec.visibleRecipes).toEqual([]);
    expect(result.current.rec.isGeneratingRecipes).toBe(false);
    expect(toastStore.get()).toMatchObject({ type: "error" });
  });

  it("a failed regenerate keeps the batch that is already on screen", async () => {
    gemini.generateRecipesWithGemini.mockResolvedValueOnce(batch(3)).mockRejectedValueOnce(new Error("boom"));
    const { result } = await withFridge();
    await act(() => result.current.rec.generateRecipes());
    await act(() => result.current.rec.generateRecipes());
    expect(result.current.rec.generatedRecipes).toHaveLength(3);
    expect(result.current.rec.recipeGenerationFailed).toBe(false);
    expect(toastStore.get()).toMatchObject({ type: "error" });
  });

  it("two taps in the same instant start only one request", async () => {
    let finish;
    gemini.generateRecipesWithGemini.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const { result } = await withFridge();
    let first, second;
    act(() => {
      first = result.current.rec.generateRecipes();
      second = result.current.rec.generateRecipes();
    });
    await act(async () => {
      finish(batch(3));
      await Promise.all([first, second]);
    });
    expect(gemini.generateRecipesWithGemini).toHaveBeenCalledTimes(1);
  });

  it("visibleRecipes is empty until something was generated, then follows the batch size", async () => {
    gemini.generateRecipesWithGemini.mockResolvedValue(batch(3));
    const { result } = await withFridge();
    expect(result.current.rec.visibleRecipes).toEqual([]);
    await act(() => result.current.rec.generateRecipes());
    expect(result.current.rec.visibleRecipes).toHaveLength(3);
    expect(result.current.rec.visibleRecipes.map((r) => r.cardIndex)).toEqual([0, 1, 2]);
    expect(result.current.rec.recipes).toBe(result.current.rec.visibleRecipes);
  });

  it("clearRecipes forgets the batch", async () => {
    gemini.generateRecipesWithGemini.mockResolvedValue(batch(3));
    const { result } = await withFridge();
    await act(() => result.current.rec.generateRecipes());
    act(() => result.current.rec.clearRecipes());
    expect(result.current.rec.generatedRecipes).toBeNull();
    expect(result.current.rec.isGeneratingRecipes).toBe(false);
  });
});

describe("modifyRecipe", () => {
  it("applies the AI edit, keeps the id, and updates every list that holds the recipe", async () => {
    gemini.generateRecipesWithGemini.mockResolvedValue(batch(3));
    const { result } = await withFridge();
    await act(() => result.current.rec.generateRecipes());
    const target = result.current.rec.generatedRecipes[0];
    act(() => result.current.lib.toggleSaveRecipe(target));
    gemini.modifyRecipeWithGemini.mockResolvedValue({ id: "ai-new-id", title: "Vegan " + target.title });
    let updated;
    await act(async () => {
      updated = await result.current.rec.modifyRecipe(target, "make it vegan");
    });
    expect(updated).toMatchObject({ id: target.id, title: "Vegan Dish g1", steps: target.steps });
    expect(result.current.rec.generatedRecipes[0].title).toBe("Vegan Dish g1");
    expect(result.current.lib.savedRecipes.find((r) => r.id === target.id).title).toBe("Vegan Dish g1");
    expect(gemini.modifyRecipeWithGemini.mock.calls[0][1]).toBe("make it vegan");
  });

  it("lets the error through so the caller can tell the user", async () => {
    gemini.modifyRecipeWithGemini.mockRejectedValue(new Error("nope"));
    const { result } = await renderApp();
    await expect(result.current.rec.modifyRecipe(ai("x"), "anything")).rejects.toThrow("nope");
  });
});

describe("recipe language", () => {
  it("ensureRecipeLanguage leaves recipes alone unless they are AI-made in another language", async () => {
    const { result } = await renderApp();
    const manual = { id: "m", title: "Manual" };
    expect(await result.current.rec.ensureRecipeLanguage(manual)).toBe(manual);
    const current = ai("c", { languageId: "en" });
    expect(await result.current.rec.ensureRecipeLanguage(current)).toBe(current);
    expect(gemini.modifyRecipeWithGemini).not.toHaveBeenCalled();
  });

  it("translates a stale recipe, keeps its id, stamps the language and updates the saved copy", async () => {
    gemini.modifyRecipeWithGemini.mockResolvedValue({ id: "other", title: "Danie" });
    const { result } = await renderApp();
    const stale = ai("s1", { languageId: "pl" });
    act(() => result.current.lib.toggleSaveRecipe(stale));
    let out;
    await act(async () => {
      out = await result.current.rec.ensureRecipeLanguage(stale);
    });
    expect(out).toMatchObject({ id: "s1", title: "Danie", languageId: "en" });
    expect(result.current.lib.savedRecipes.find((r) => r.id === "s1").title).toBe("Danie");
  });

  it("returns the original recipe when translating fails", async () => {
    gemini.modifyRecipeWithGemini.mockRejectedValue(new Error("down"));
    const { result } = await renderApp();
    const stale = ai("s2", { languageId: "pl" });
    await expect(result.current.rec.ensureRecipeLanguage(stale)).resolves.toBe(stale);
  });

  it("switching the language re-translates the saved recipes written in the old one", async () => {
    gemini.modifyRecipeWithGemini.mockImplementation(async (r) => ({ title: `${r.title} (pl)` }));
    await AsyncStorage.setItem("cookai:savedRecipes:v1", JSON.stringify([ai("a"), ai("b", { languageId: "pl" })]));
    const { result } = await renderApp();
    await act(async () => {});
    expect(gemini.modifyRecipeWithGemini).not.toHaveBeenCalled(); // not on startup
    act(() => result.current.language.setRecipeLanguageId("pl"));
    await waitFor(() => expect(result.current.lib.savedRecipes.find((r) => r.id === "a").title).toBe("Dish a (pl)"));
    expect(result.current.lib.savedRecipes.find((r) => r.id === "b").title).toBe("Dish b"); // already Polish
    expect(gemini.modifyRecipeWithGemini).toHaveBeenCalledTimes(1);
  });
});

describe("getPlannerMealsFromInventory", () => {
  it("asks for meals from the fridge plus in-stock pantry, with the user's servings and units", async () => {
    gemini.generatePlannerMealsWithGemini.mockResolvedValue([{ title: "Meal" }]);
    const { result } = await withFridge();
    act(() => {
      result.current.prefs.setServings(2);
      result.current.inv.addPantryItem({ id: "p", name: "Salt", category: "Spices & Herbs" });
    });
    await expect(result.current.rec.getPlannerMealsFromInventory(5)).resolves.toEqual([{ title: "Meal" }]);
    const args = gemini.generatePlannerMealsWithGemini.mock.calls[0];
    expect(args[0].map((i) => i.name)).toEqual(["Egg", "Milk"]);
    expect(args[1].map((p) => p.name)).toEqual(["Salt"]);
    expect(args[2]).toBe(5);
  });
});
