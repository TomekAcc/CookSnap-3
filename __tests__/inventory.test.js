import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, waitFor } from "@testing-library/react-native";
import { renderApp } from "../test-utils/renderApp";

jest.mock("../src/services/geminiVision", () => ({
  ...jest.requireActual("../src/services/geminiVision"),
  translateIngredientNames: jest.fn(async (items, language) => items.map((i) => ({ ...i, name: `${i.name}-${language}` }))),
}));
const { translateIngredientNames } = require("../src/services/geminiVision");

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

const names = (list) => list.map((i) => i.name);

describe("fridge ingredients", () => {
  it("addIngredient adds a manual item (deduped by name) and closes the add sheet", async () => {
    const { result } = await renderApp();
    act(() => result.current.modal.setAddIngredientOpen(true));
    expect(result.current.modal.addIngredientOpen).toBe(true);
    act(() => result.current.inv.addIngredient({ name: "Egg", icon: "🥚" }));
    act(() => result.current.inv.addIngredient({ name: "  egg " }));
    expect(names(result.current.inv.ingredients)).toEqual(["Egg"]);
    expect(result.current.inv.ingredients[0].source).toBe("manual");
    expect(result.current.modal.addIngredientOpen).toBe(false);
  });

  it("appendIngredients merges scan results and marks them as scanned", async () => {
    const { result } = await renderApp();
    act(() => result.current.inv.addIngredient({ name: "Milk" }));
    act(() => result.current.inv.appendIngredients([{ name: "milk" }, { name: "Cheese" }, { name: "Cheese" }]));
    expect(names(result.current.inv.ingredients)).toEqual(["Milk", "Cheese"]);
    expect(result.current.inv.ingredients[1].source).toBe("scan");
    act(() => result.current.inv.appendIngredients([]));
    expect(result.current.inv.ingredients).toHaveLength(2);
  });

  it("removing a scanned item is logged as feedback; removing a manual one is not", async () => {
    const { result } = await renderApp();
    act(() => result.current.inv.addIngredient({ name: "Manual" }));
    act(() => result.current.inv.appendIngredients([{ name: "Scanned" }]));
    const [manual, scanned] = result.current.inv.ingredients;
    act(() => result.current.inv.removeIngredient(manual.id));
    await act(async () => {});
    expect(await AsyncStorage.getItem("cookai:feedbackLog:v1")).toBeNull();
    act(() => result.current.inv.removeIngredient(scanned.id));
    await waitFor(async () => {
      const log = JSON.parse(await AsyncStorage.getItem("cookai:feedbackLog:v1"));
      expect(log[0]).toMatchObject({ type: "scanIngredientFlagged", name: "Scanned" });
    });
    expect(result.current.inv.ingredients).toEqual([]);
  });

  it("never saves the onboarding sample list over the user's real ingredients", async () => {
    await AsyncStorage.setItem("cookai:ingredients:v1", JSON.stringify([{ id: "real", name: "Real", source: "scan" }]));
    const { result } = await renderApp();
    expect(names(result.current.inv.ingredients)).toEqual(["Real"]);
    act(() => {
      result.current.inv.markScanDemo(true);
      result.current.inv.setIngredients([{ id: "s1", name: "Sample", source: "demo" }]);
    });
    await act(async () => {});
    expect(JSON.parse(await AsyncStorage.getItem("cookai:ingredients:v1"))).toEqual([{ id: "real", name: "Real", source: "scan" }]);
    act(() => {
      result.current.inv.markScanDemo(false);
      result.current.inv.setIngredients([{ id: "r2", name: "Real two", source: "scan" }]);
    });
    await waitFor(async () => expect(names(JSON.parse(await AsyncStorage.getItem("cookai:ingredients:v1")))).toEqual(["Real two"]));
  });

  it("re-translates stored names when the language changes after startup (not on startup)", async () => {
    await AsyncStorage.setItem("cookai:ingredients:v1", JSON.stringify([{ id: "1", name: "Milk" }]));
    const { result } = await renderApp();
    await act(async () => {});
    expect(translateIngredientNames).not.toHaveBeenCalled();
    act(() => result.current.language.setRecipeLanguageId("pl"));
    await waitFor(() => expect(names(result.current.inv.ingredients)).toEqual(["Milk-Polish"]));
    expect(translateIngredientNames).toHaveBeenCalledWith(expect.any(Array), "Polish");
  });
});

describe("pantry", () => {
  const salt = { id: "p1", name: "Salt", emoji: "🧂", category: "Spices & Herbs" };

  it("starts empty", async () => {
    const { result } = await renderApp();
    expect(result.current.inv.pantryItems).toEqual([]);
  });

  it("addPantryItem adds an in-stock item, and re-adding an existing name restocks it instead of duplicating", async () => {
    const { result } = await renderApp();
    act(() => result.current.inv.addPantryItem(salt));
    act(() => result.current.inv.togglePantryItem("p1"));
    expect(result.current.inv.pantryItems[0].inStock).toBe(false);
    act(() => result.current.inv.addPantryItem({ ...salt, id: "other", name: " salt " }));
    expect(result.current.inv.pantryItems).toHaveLength(1);
    expect(result.current.inv.pantryItems[0].inStock).toBe(true);
  });

  it("addPantryItem accepts a plain name and classifies it locally; ignores empty input", async () => {
    const { result } = await renderApp();
    act(() => {
      expect(result.current.inv.addPantryItem("olive oil")).toMatchObject({ category: "Oils & Sauces" });
      expect(result.current.inv.addPantryItem("")).toBeNull();
    });
    expect(result.current.inv.pantryItems).toHaveLength(1);
  });

  it("remove and clear", async () => {
    const { result } = await renderApp();
    act(() => result.current.inv.addPantryItem(salt));
    act(() => result.current.inv.addPantryItem({ ...salt, id: "p2", name: "Pepper" }));
    act(() => result.current.inv.removePantryItem("p1"));
    expect(names(result.current.inv.pantryItems)).toEqual(["Pepper"]);
    act(() => result.current.inv.clearPantry());
    expect(result.current.inv.pantryItems).toEqual([]);
  });

  it("markPantryItemOutOfStock flips an existing item or creates one that is already out of stock", async () => {
    const { result } = await renderApp();
    act(() => result.current.inv.addPantryItem(salt));
    act(() => result.current.inv.markPantryItemOutOfStock("SALT"));
    expect(result.current.inv.pantryItems).toHaveLength(1);
    expect(result.current.inv.pantryItems[0].inStock).toBe(false);
    act(() => result.current.inv.markPantryItemOutOfStock("flour"));
    expect(result.current.inv.pantryItems.find((p) => p.name.toLowerCase() === "flour").inStock).toBe(false);
  });

  it("addToShoppingList returns how many it added and skips what is already on the list", async () => {
    const { result } = await renderApp();
    act(() => result.current.inv.addPantryItem(salt)); // in stock -> will move to the list
    let added;
    act(() => {
      added = result.current.inv.addToShoppingList(["Salt", "Flour", "flour ", ""]);
    });
    expect(added).toBe(2);
    expect(result.current.inv.pantryItems.every((p) => p.inStock === false)).toBe(true);
    act(() => {
      added = result.current.inv.addToShoppingList(["salt", "Flour"]);
    });
    expect(added).toBe(0);
  });

  it("mergePantryScanResults restocks known items (refreshing the icon), adds new ones, returns the detected count", async () => {
    const { result } = await renderApp();
    act(() => result.current.inv.addPantryItem({ ...salt, inStock: false }));
    act(() => result.current.inv.togglePantryItem("p1")); // out of stock
    let count;
    act(() => {
      count = result.current.inv.mergePantryScanResults([{ name: "salt", icon: "🧂" }, { name: "Rice", icon: "🍚" }, {}]);
    });
    expect(count).toBe(3);
    const rice = result.current.inv.pantryItems.find((p) => p.name === "Rice");
    expect(rice).toMatchObject({ inStock: true, icon: "🍚" });
    expect(result.current.inv.pantryItems.find((p) => p.id === "p1").inStock).toBe(true);
    expect(result.current.inv.mergePantryScanResults([])).toBe(0);
  });
});
