import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, waitFor } from "@testing-library/react-native";
import { renderApp } from "../test-utils/renderApp";

const recipe = (id, extra = {}) => ({ id, title: `Recipe ${id}`, category: "lunch", dishType: "salad", ingredientsList: ["1 egg"], steps: ["Cook."], ...extra });

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe("library (saved recipes + favorites)", () => {
  it("starts with the seeded recipe #1 saved and liked", async () => {
    const { result } = await renderApp();
    expect(result.current.lib.favorites).toEqual([1]);
    expect(result.current.lib.savedRecipes.map((r) => String(r.id))).toEqual(["1"]);
    expect(result.current.lib.savedCount).toBe(1);
  });

  it("toggleSaveRecipe saves, then removes, keeping favorites and the saved list in sync", async () => {
    const { result } = await renderApp();
    act(() => result.current.lib.toggleSaveRecipe(recipe("a")));
    expect(result.current.lib.isRecipeSaved("a")).toBe(true);
    expect(result.current.lib.favorites).toContain("a");
    expect(result.current.lib.savedRecipes.map((r) => r.id)).toContain("a");
    act(() => result.current.lib.toggleSaveRecipe(recipe("a")));
    expect(result.current.lib.isRecipeSaved("a")).toBe(false);
    expect(result.current.lib.favorites).not.toContain("a");
  });

  it("matches ids across number/string forms", async () => {
    const { result } = await renderApp();
    act(() => result.current.lib.toggleSaveRecipe(recipe(7)));
    expect(result.current.lib.isRecipeSaved("7")).toBe(true);
    act(() => result.current.lib.toggleSaveRecipe(recipe("7")));
    expect(result.current.lib.isRecipeSaved(7)).toBe(false);
  });

  it("ignores a recipe without an id", async () => {
    const { result } = await renderApp();
    const before = result.current.lib.savedCount;
    act(() => result.current.lib.toggleSaveRecipe({ title: "no id" }));
    act(() => result.current.lib.toggleSaveRecipe(null));
    expect(result.current.lib.savedCount).toBe(before);
  });

  it("toggleFavorite saves the recipe the caller passes (a card from the feed)", async () => {
    const { result } = await renderApp();
    act(() => result.current.lib.toggleFavorite("gen-1", recipe("gen-1", { title: "Generated" })));
    expect(result.current.lib.savedRecipes.find((r) => r.id === "gen-1")?.title).toBe("Generated");
    act(() => result.current.lib.toggleFavorite("gen-1"));
    expect(result.current.lib.isRecipeSaved("gen-1")).toBe(false);
  });

  it("toggleFavorite for an unknown id only records the like (nothing to save)", async () => {
    const { result } = await renderApp();
    act(() => result.current.lib.toggleFavorite("ghost"));
    expect(result.current.lib.favorites).toContain("ghost");
    expect(result.current.lib.savedRecipes.find((r) => r.id === "ghost")).toBeUndefined();
  });

  it("replaceSavedRecipe swaps in the new version by id and leaves the rest alone", async () => {
    const { result } = await renderApp();
    act(() => result.current.lib.toggleSaveRecipe(recipe("a")));
    act(() => result.current.lib.toggleSaveRecipe(recipe("b")));
    act(() => result.current.lib.replaceSavedRecipe(recipe("a", { title: "Updated" })));
    expect(result.current.lib.savedRecipes.find((r) => r.id === "a").title).toBe("Updated");
    expect(result.current.lib.savedRecipes.find((r) => r.id === "b").title).toBe("Recipe b");
  });

  it("savedCount is the larger of the likes and the saved recipes", async () => {
    const { result } = await renderApp();
    act(() => result.current.lib.toggleFavorite("x"));
    act(() => result.current.lib.toggleFavorite("y"));
    expect(result.current.lib.savedCount).toBe(3); // [1, x, y] vs one saved recipe
  });

  it("persists across a restart", async () => {
    const first = await renderApp();
    act(() => first.result.current.lib.toggleSaveRecipe(recipe("keep")));
    await waitFor(async () => expect(JSON.parse(await AsyncStorage.getItem("cookai:savedRecipes:v1")).map((r) => r.id)).toContain("keep"));
    first.unmount();
    const second = await renderApp();
    expect(second.result.current.lib.isRecipeSaved("keep")).toBe(true);
  });
});
