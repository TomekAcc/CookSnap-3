import { mergeUniqueIngredients, normalizePantryName } from "../src/utils/ingredients";

describe("normalizePantryName", () => {
  it("trims, lower-cases and collapses inner whitespace", () => {
    expect(normalizePantryName("  Olive   OIL ")).toBe("olive oil");
    expect(normalizePantryName("Olive Oil")).toBe(normalizePantryName(" olive oil"));
  });

  it("tolerates missing input", () => {
    expect(normalizePantryName(undefined)).toBe("");
    expect(normalizePantryName(null)).toBe("");
    expect(normalizePantryName(42)).toBe("42");
  });
});

describe("mergeUniqueIngredients (Smart Append)", () => {
  const egg = { id: "1", name: "Egg", icon: "🥚", source: "scan" };

  it("appends new items after the existing ones, never reordering or rewriting them", () => {
    const merged = mergeUniqueIngredients([egg], [{ id: "2", name: "Milk" }]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toBe(egg);
    expect(merged[1]).toMatchObject({ id: "2", name: "Milk" });
  });

  it("skips names that already exist, ignoring case and surrounding spaces", () => {
    const merged = mergeUniqueIngredients([egg], [{ name: "  egg " }, { name: "EGG" }, { name: "Milk" }]);
    expect(merged.map((i) => i.name)).toEqual(["Egg", "Milk"]);
  });

  it("drops repeats inside the incoming batch (a model sometimes lists an item twice)", () => {
    const merged = mergeUniqueIngredients([], [{ name: "Milk" }, { name: "milk" }, { name: "Cheese" }]);
    expect(merged.map((i) => i.name)).toEqual(["Milk", "Cheese"]);
  });

  it("drops items without a usable name", () => {
    const merged = mergeUniqueIngredients([], [{ name: "" }, { name: "   " }, {}, null, { name: "Milk" }]);
    expect(merged.map((i) => i.name)).toEqual(["Milk"]);
  });

  it("keeps a provided id and invents a unique one otherwise", () => {
    const merged = mergeUniqueIngredients([], [{ id: "keep", name: "A" }, { name: "B" }, { name: "C" }]);
    expect(merged[0].id).toBe("keep");
    expect(merged[1].id).toMatch(/^ing-\d+-\d+-[a-z0-9]+$/);
    expect(merged[2].id).toMatch(/^ing-/);
    expect(new Set(merged.map((i) => i.id)).size).toBe(3);
  });

  it("carries the rest of each incoming item through (icon, source, ...)", () => {
    const [item] = mergeUniqueIngredients([], [{ name: "Milk", icon: "🥛", source: "manual" }]);
    expect(item).toMatchObject({ name: "Milk", icon: "🥛", source: "manual" });
  });

  it("treats non-array input as empty instead of throwing", () => {
    expect(mergeUniqueIngredients(undefined, undefined)).toEqual([]);
    expect(mergeUniqueIngredients(null, [{ name: "Milk" }])).toHaveLength(1);
    expect(mergeUniqueIngredients([egg], "nope")).toEqual([egg]);
  });

  it("does not mutate its inputs", () => {
    const prev = [egg];
    const incoming = [{ name: "Milk" }];
    mergeUniqueIngredients(prev, incoming);
    expect(prev).toEqual([egg]);
    expect(incoming).toEqual([{ name: "Milk" }]);
  });
});
