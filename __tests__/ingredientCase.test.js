import { lowercaseIngredientNames } from "../src/services/geminiRecipes";

describe("lowercaseIngredientNames", () => {
  it("lowercases ordinary English ingredient names and leaves amounts and emoji alone", () => {
    expect(
      lowercaseIngredientNames(["1 lb Chicken thighs 🍗", "4 cloves Garlic 🧄", "1/2 tsp Salt 🧂", "2 tbsp Cooking oil 🫒", "4 Eggs 🥚"])
    ).toEqual(["1 lb chicken thighs 🍗", "4 cloves garlic 🧄", "1/2 tsp salt 🧂", "2 tbsp cooking oil 🫒", "4 eggs 🥚"]);
  });

  it("keeps proper nouns capitalized", () => {
    expect(lowercaseIngredientNames(["30 g Parmesan 🧀", "1 cup Greek Yogurt 🥛", "1 tsp Dijon Mustard", "2 tbsp Worcestershire sauce"])).toEqual([
      "30 g Parmesan 🧀",
      "1 cup Greek yogurt 🥛",
      "1 tsp Dijon mustard",
      "2 tbsp Worcestershire sauce",
    ]);
  });

  it("does not touch all-caps words or entries that are not strings", () => {
    expect(lowercaseIngredientNames(["1 tbsp BBQ sauce"])).toEqual(["1 tbsp BBQ sauce"]);
    expect(lowercaseIngredientNames(["1 cup rice", 7, null])).toEqual(["1 cup rice", 7, null]);
    expect(lowercaseIngredientNames(undefined)).toEqual([]);
  });

  it("handles hyphenated and parenthesised names", () => {
    expect(lowercaseIngredientNames(["2 Bell peppers (Red)", "200 g Sun-Dried tomatoes"])).toEqual(["2 bell peppers (red)", "200 g sun-dried tomatoes"]);
  });
});
