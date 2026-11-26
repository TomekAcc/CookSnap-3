import { isNearDuplicateOfExcluded as dup } from "../src/services/geminiRecipes";

describe("isNearDuplicateOfExcluded", () => {
  it("catches a title that is the other plus one word", () => {
    expect(dup("Tuna Pasta Salad", ["Classic Tuna Pasta"])).toBe(true);
    expect(dup("Tuna Pasta", ["Tuna Pasta Bake"])).toBe(true);
  });

  it("catches a near-copy sharing most of its words", () => {
    expect(dup("Creamy Garlic Chicken Skillet", ["Creamy Garlic Chicken Bake"])).toBe(true);
  });

  it("lets different dishes through even when they share two ingredient words", () => {
    expect(dup("Creamy Potato Bake", ["Creamy Potato Soup"])).toBe(false);
    expect(dup("Cheesy Tomato Skillet", ["Cheesy Tomato Bake"])).toBe(false);
    expect(dup("Garlic Rice with Peppers", ["Pepper and Onion Rice Bowl"])).toBe(false);
  });

  it("does not treat a short title inside a much longer one as a copy", () => {
    expect(dup("Tuna Tomato Salad", ["Tuna Tomato Rice Salad Bowl"])).toBe(false);
  });

  it("ignores filler words and singular/plural", () => {
    expect(dup("Classic Tuna and Tomato Pasta", ["Quick Tuna Tomatoes Pasta"])).toBe(true);
    expect(dup("Pancakes", [])).toBe(false);
  });
});
