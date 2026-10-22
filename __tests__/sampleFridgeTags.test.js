import React from "react";
import { render, screen } from "@testing-library/react-native";
import SampleFridgeTags from "../src/components/SampleFridgeTags";
import { SAMPLE_FRIDGE_ITEMS, SAMPLE_FRIDGE_TAGS } from "../src/constants/sampleFridge";
import { translate } from "../src/i18n";

describe("sample fridge tags", () => {
  it("only label items that are on the fridge's list, inside the picture", () => {
    expect(SAMPLE_FRIDGE_TAGS.length).toBeGreaterThan(0);
    const ids = new Set(SAMPLE_FRIDGE_ITEMS.map((item) => item.id));
    for (const { id, x, y } of SAMPLE_FRIDGE_TAGS) {
      expect(ids.has(id)).toBe(true);
      expect(x).toBeGreaterThan(0.1);
      expect(x).toBeLessThan(0.9);
      expect(y).toBeGreaterThan(0.1);
      expect(y).toBeLessThan(0.8); // below that the card crops the drawers
    }
    expect(new Set(SAMPLE_FRIDGE_TAGS.map((tag) => tag.id)).size).toBe(SAMPLE_FRIDGE_TAGS.length);
  });

  it("shows each item's name in the chosen language", () => {
    const layout = { cardWidth: 350, imageHeight: 467, imageTop: -10 };
    render(<SampleFridgeTags t={(key) => translate("es", key)} {...layout} />);
    for (const { id } of SAMPLE_FRIDGE_TAGS) {
      expect(screen.getByText(translate("es", `sampleFridge.${id}`), { includeHiddenElements: true })).toBeTruthy();
    }
    expect(translate("es", "sampleFridge.eggs")).not.toBe(translate("en", "sampleFridge.eggs"));
  });
});
