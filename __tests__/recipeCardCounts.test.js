import { translate, translateCount } from "../src/i18n";

const uses = (lang, n) =>
  n === 1
    ? translate(lang, "recipeCard.usesFridgeItemOne", { count: n })
    : translateCount(lang, n, { few: "recipeCard.usesFridgeItemsFew", many: "recipeCard.usesFridgeItemsMany", fallback: "recipeCard.usesFridgeItems" });

describe("'Uses N fridge items' on a recipe card", () => {
  it("English says 'item' for one", () => {
    expect(uses("en", 1)).toBe("Uses 1 fridge item");
    expect(uses("en", 3)).toBe("Uses 3 fridge items");
  });

  it("Polish uses the right noun form: 1 składnik, 2-4 składniki, 5+ składników", () => {
    expect(uses("pl", 1)).toBe("Wykorzystuje 1 składnik z lodówki");
    expect(uses("pl", 2)).toBe("Wykorzystuje 2 składniki z lodówki");
    expect(uses("pl", 4)).toBe("Wykorzystuje 4 składniki z lodówki");
    expect(uses("pl", 5)).toBe("Wykorzystuje 5 składników z lodówki");
    expect(uses("pl", 12)).toBe("Wykorzystuje 12 składników z lodówki");
    expect(uses("pl", 22)).toBe("Wykorzystuje 22 składniki z lodówki");
  });
});
