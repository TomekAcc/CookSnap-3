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
});
