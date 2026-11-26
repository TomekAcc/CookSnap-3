import { getDietViolation, filterItemsForDiet } from "../src/services/geminiRecipes";
import { FULL_DIETARY_OPTIONS as DIETARY_OPTIONS } from "../src/data/dietaryOptions";

// Dietary filtering is the app's safety net against the model ignoring a
// restriction (allergies, vegan, etc.), so it gets the most direct coverage.
describe("getDietViolation", () => {
  it("returns null when there are no restrictions", () => {
    expect(getDietViolation(["chicken"], undefined)).toBeNull();
    expect(getDietViolation(["chicken"], {})).toBeNull();
    expect(getDietViolation(["chicken"], { vegetarian: false })).toBeNull();
  });

  it("flags meat for vegetarian and reports which ingredient and word matched", () => {
    expect(getDietViolation(["200g chicken breast", "rice"], { vegetarian: true })).toEqual({
      dietId: "vegetarian",
      word: "chicken",
      ingredient: "200g chicken breast",
    });
  });

  it("flags honey for vegan but not plant milks", () => {
    expect(getDietViolation(["almond milk", "coconut milk"], { vegan: true })).toBeNull();
    expect(getDietViolation(["almond milk", "honey"], { vegan: true })).toMatchObject({
      dietId: "vegan",
      word: "honey",
    });
  });

  it("flags gluten sources for gluten_free and allows rice", () => {
    expect(getDietViolation(["wheat flour"], { gluten_free: true })).toMatchObject({
      dietId: "gluten_free",
    });
    expect(getDietViolation(["rice", "tomato"], { gluten_free: true })).toBeNull();
  });

  it("applies PRO custom exclusions case-insensitively", () => {
    expect(
      getDietViolation(["fresh basil", "peanut butter"], { customAvoid: ["Peanut"] })
    ).toEqual({ dietId: "custom", word: "peanut", ingredient: "peanut butter" });
  });

  it("only checks diets that are switched on", () => {
    expect(getDietViolation(["chicken"], { vegan: false, gluten_free: true })).toBeNull();
  });

  it("every selectable diet id in dietaryOptions has forbidden-term rules or is guidance-only", () => {
    // A diet can be selectable without a rule only if it is prompt-only. This
    // pins the list so adding a diet without deciding that is a visible diff.
    const ruleless = DIETARY_OPTIONS.map((d) => d.id).filter(
      (id) => getDietViolation(["chicken", "wheat flour", "milk", "peanut", "honey", "sugar", "pasta"], { [id]: true }) === null
    );
    expect(ruleless).toEqual([]);
  });
});

describe("filterItemsForDiet", () => {
  it("keeps compliant items, accepting objects and plain strings", () => {
    const items = [{ name: "Milk" }, { name: "Tomato" }, "Cheese"];
    expect(filterItemsForDiet(items, { dairy_free: true, vegan: true })).toEqual([{ name: "Tomato" }]);
  });

  it("returns the list untouched without restrictions and tolerates non-arrays", () => {
    const items = [{ name: "Milk" }];
    expect(filterItemsForDiet(items, undefined)).toBe(items);
    expect(filterItemsForDiet(null, { vegan: true })).toEqual([]);
  });
});
