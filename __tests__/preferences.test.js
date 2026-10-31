import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, waitFor } from "@testing-library/react-native";
import { renderApp } from "../test-utils/renderApp";

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe("preferences", () => {
  it("meal type follows the time of day and is not persisted", async () => {
    const { result } = await renderApp();
    expect(["breakfast", "lunch", "dinner", "all"]).toContain(result.current.prefs.mealType);
    act(() => result.current.prefs.setMealType("dessert"));
    await act(async () => {});
    expect(await AsyncStorage.getItem("cookai:mealType:v1")).toBeNull();
  });

  it("servings, hunger level, units, ingredient priority and diet persist and restore", async () => {
    const first = await renderApp();
    act(() => {
      first.result.current.prefs.setServings(4);
      first.result.current.prefs.setHungerLevel("hungry");
      first.result.current.prefs.setUnitSystem("metric");
      first.result.current.prefs.setIngredientPriority("pantry");
      first.result.current.prefs.toggleDietaryRestriction("vegan");
      first.result.current.prefs.setCustomDietAvoid("peanut, shrimp");
    });
    await waitFor(async () => expect(await AsyncStorage.getItem("cookai:servings:v1")).toBe("4"));
    first.unmount();
    const second = await renderApp();
    const p = second.result.current.prefs;
    expect([p.servings, p.hungerLevel, p.unitSystem, p.ingredientPriority, p.dietaryRestrictions.vegan, p.customDietAvoid]).toEqual([4, "hungry", "metric", "pantry", true, "peanut, shrimp"]);
  });

  it("coerces invalid unit / priority values to safe defaults", async () => {
    const { result } = await renderApp();
    act(() => result.current.prefs.setUnitSystem("klingon"));
    expect(result.current.prefs.unitSystem).toBe("us");
    act(() => result.current.prefs.setIngredientPriority("nonsense"));
    expect(result.current.prefs.ingredientPriority).toBe("balanced");
  });

  it("toggleCravingTag adds and removes a tag", async () => {
    const { result } = await renderApp();
    act(() => result.current.prefs.toggleCravingTag("spicy"));
    expect(result.current.prefs.cravingTags).toEqual(["spicy"]);
    act(() => result.current.prefs.toggleCravingTag("spicy"));
    expect(result.current.prefs.cravingTags).toEqual([]);
  });
});

describe("dietaryRestrictionsWithCustom (what generation actually receives)", () => {
  it("is the plain diet map when nothing extra is set", async () => {
    const { result } = await renderApp();
    expect(result.current.prefs.dietaryRestrictionsWithCustom).toBe(result.current.prefs.dietaryRestrictions);
  });

  it("applies the PRO custom diet only while the user is PRO (the typed list is kept for a lapsed user)", async () => {
    const { result } = await renderApp();
    act(() => {
      result.current.prefs.setCustomDietAvoid("Peanut, shrimp");
      result.current.prefs.setCustomDietPrefer("basil");
    });
    expect(result.current.prefs.dietaryRestrictionsWithCustom.customAvoid).toBeUndefined();
    act(() => result.current.ent.activatePro());
    expect(result.current.prefs.dietaryRestrictionsWithCustom).toMatchObject({ customAvoid: ["Peanut", "shrimp"], customPrefer: ["basil"] });
    act(() => result.current.ent.deactivatePro());
    expect(result.current.prefs.dietaryRestrictionsWithCustom.customAvoid).toBeUndefined();
    expect(result.current.prefs.customDietAvoid).toBe("Peanut, shrimp");
  });

  it("the free one-off exclusion applies to everyone and merges with the PRO list without duplicates", async () => {
    const { result } = await renderApp();
    act(() => result.current.prefs.setExcludeThisBatch("mushrooms"));
    expect(result.current.prefs.dietaryRestrictionsWithCustom.customAvoid).toEqual(["mushrooms"]);
    act(() => {
      result.current.ent.activatePro();
      result.current.prefs.setCustomDietAvoid("mushrooms, nuts");
    });
    expect(result.current.prefs.dietaryRestrictionsWithCustom.customAvoid).toEqual(["mushrooms", "nuts"]);
  });

  it("carries cravings (as prompt phrases) and a non-default ingredient priority", async () => {
    const { result } = await renderApp();
    act(() => {
      result.current.prefs.toggleCravingTag("savory");
      result.current.prefs.toggleCravingTag("not-a-tag");
      result.current.prefs.setIngredientPriority("fridge");
    });
    expect(result.current.prefs.dietaryRestrictionsWithCustom).toMatchObject({ craving: ["bold, savory"], ingredientPriority: "fridge" });
  });
});

describe("entitlements", () => {
  it("PRO is off by default, toggles, and persists", async () => {
    const first = await renderApp();
    expect(first.result.current.ent.isPro).toBe(false);
    act(() => first.result.current.ent.activatePro());
    await waitFor(async () => expect(await AsyncStorage.getItem("cookai:isPro:v1")).toBe("true"));
    first.unmount();
    const second = await renderApp();
    expect(second.result.current.ent.isPro).toBe(true);
    act(() => second.result.current.ent.deactivatePro());
    expect(second.result.current.ent.isPro).toBe(false);
  });

  it("exposes the free limits and their daily counters (limits themselves are covered by useFreeTierCap)", async () => {
    const { result } = await renderApp();
    expect(result.current.ent.canScanFridge).toBe(true);
    act(() => {
      result.current.ent.registerFridgeScanAttempt();
      result.current.ent.registerFridgeScanAttempt();
    });
    expect(result.current.ent.dailyFridgeScanCount).toBe(2);
    expect(result.current.ent.canScanFridge).toBe(false);
    expect(result.current.ent.freeDailyFridgeScans).toBe(2);
  });
});
