import {
  formatCalories,
  formatMacroGrams,
  formatIngredientsList,
  collectInventoryNames,
} from "../src/services/geminiRecipes";
import { formatTimeLabel, sumTimeLabel, hasRealMinutes } from "../src/utils/timeFormat";
import { breakLigatures } from "../src/utils/textLigatures";
import { isAssumedStapleIngredient } from "../src/utils/assumedStaples";
import { getIngredientEmoji } from "../src/utils/ingredientEmoji";
import {
  stripQuantityFromName,
  prettyPantryName,
  classifyPantryCategoryLocal,
} from "../src/services/geminiVision";

describe("time labels", () => {
  it("re-renders the unit in the app language and keeps the number", () => {
    expect(formatTimeLabel("17 min", "min")).toBe("17 min");
    expect(formatTimeLabel("17 分钟", "分钟")).toBe("17 分钟");
    expect(formatTimeLabel(8, "min")).toBe("8 min");
  });

  it("falls back for missing or non-numeric values", () => {
    expect(formatTimeLabel(null, "min")).toBe("—");
    expect(formatTimeLabel("", "min")).toBe("—");
    expect(formatTimeLabel("—", "min")).toBe("—");
    expect(formatTimeLabel("soon", "min", "n/a")).toBe("n/a");
  });

  it("sums prep and cook when only parts are known", () => {
    expect(sumTimeLabel("5 min", "10 min", "min")).toBe("15 min");
    expect(sumTimeLabel(null, "10 min", "min")).toBe("10 min");
    expect(sumTimeLabel(null, null, "min")).toBe("—");
  });

  it("treats the literal '—' placeholder as no minutes", () => {
    expect(hasRealMinutes("—")).toBe(false);
    expect(hasRealMinutes("0 min")).toBe(true);
  });
});

describe("recipe field formatting", () => {
  it("normalizes calories and macros from numbers or strings", () => {
    expect(formatCalories(420)).toBe("420 kcal");
    expect(formatCalories("420 kcal")).toBe("420 kcal");
    expect(formatCalories(null)).toBe("—");
    expect(formatMacroGrams(12)).toBe("12 g");
    expect(formatMacroGrams("12g")).toBe("12 g");
    expect(formatMacroGrams(undefined)).toBeNull();
  });

  it("decorates ingredient lines with an emoji", () => {
    expect(formatIngredientsList(["2 eggs", "salt"])).toEqual(["2 eggs 🥚", "salt 🧂"]);
  });

  it("lists fridge items plus only in-stock pantry items", () => {
    expect(
      collectInventoryNames(
        [{ name: "Eggs" }, { name: "milk" }],
        [
          { name: "Salt", inStock: true },
          { name: "Pepper", inStock: false },
        ]
      )
    ).toEqual(["Eggs", "milk", "Salt"]);
  });
});

describe("pantry text helpers", () => {
  it("strips only language-neutral metric/imperial amounts, never to empty", () => {
    expect(stripQuantityFromName("500g chicken")).toBe("chicken");
    expect(stripQuantityFromName("olive oil 15ml")).toBe("olive oil");
    expect(stripQuantityFromName("g")).toBe("g");
  });

  it("capitalizes the first letter for display", () => {
    expect(prettyPantryName("15ml olive oil")).toBe("Olive oil");
  });

  it("buckets common staples into the expected pantry categories", () => {
    expect(classifyPantryCategoryLocal("olive oil")).toBe("Oils & Sauces");
    expect(classifyPantryCategoryLocal("cumin")).toBe("Spices & Herbs");
    expect(classifyPantryCategoryLocal("flour")).toBe("Grains & Baking");
  });

  it("recognises assumed kitchen staples in recipe lines", () => {
    expect(isAssumedStapleIngredient("1 tsp salt")).toBe(true);
    expect(isAssumedStapleIngredient("200g chicken")).toBe(false);
  });

  it("maps known ingredients to emoji with a jar fallback", () => {
    expect(getIngredientEmoji("tomato")).toBe("🍅");
    expect(getIngredientEmoji("zzzz")).toBe("🫙");
  });
});

describe("breakLigatures", () => {
  it("inserts a zero-width non-joiner so 'fi' does not render as a ligature", () => {
    expect(breakLigatures("Profile")).toBe("Prof‌ile");
    expect(breakLigatures("Pantry")).toBe("Pantry");
  });
});
