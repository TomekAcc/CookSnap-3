import { summaryNeedsStacking } from "../src/utils/mealSummaryLayout";

const fields = (label, value) => [
  { label: "Meal type", value: "Breakfast" },
  { label: "Servings", value: "2 people" },
  { label, value },
];

describe("summaryNeedsStacking", () => {
  it("keeps three columns for English on a 393pt phone (card inner width ~335)", () => {
    expect(summaryNeedsStacking(fields("Hunger Level", "Normal"), 335)).toBe(false);
  });

  it("stacks German on a 360pt phone (inner width ~302), where 'Mittagessen' cannot fit", () => {
    const de = [
      { label: "Mahlzeit", value: "Mittagessen" },
      { label: "Portionen", value: "2 Personen" },
      { label: "Hungergefühl", value: "Normal" },
    ];
    expect(summaryNeedsStacking(de, 302)).toBe(true);
  });

  it("stacks long Russian values", () => {
    const ru = [
      { label: "Тип приёма пищи", value: "Нормальный" },
      { label: "Порции", value: "2 человека" },
      { label: "Уровень аппетита", value: "Нормальный" },
    ];
    expect(summaryNeedsStacking(ru, 335)).toBe(true);
  });

  it("does nothing before the card has been measured", () => {
    expect(summaryNeedsStacking(fields("x", "y"), 0)).toBe(false);
  });

  const pl = [
    { label: "Typ posiłku", value: "Kolacja" },
    { label: "Porcje", value: "2 osoby" },
    { label: "Poziom głodu", value: "Normalny" },
  ];
  it("Polish: three columns on a 375pt phone (card inner ~321), stacked on a 360pt and a 320pt phone", () => {
    expect(summaryNeedsStacking(pl, 321)).toBe(false);
    expect(summaryNeedsStacking(pl, 306)).toBe(true);
    expect(summaryNeedsStacking(pl, 266)).toBe(true);
  });

  it("long German and Ukrainian values stack even on a 393pt phone, where they need a font below the allowed minimum", () => {
    expect(summaryNeedsStacking([{ label: "Mahlzeit", value: "Abendessen" }], 339)).toBe(true);
    expect(summaryNeedsStacking([{ label: "Тип", value: "Нормальний" }], 339)).toBe(true);
  });
});
