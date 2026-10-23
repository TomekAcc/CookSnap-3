import React from "react";
import { AccessibilityInfo, Animated } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
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

  describe("animation", () => {
    const layout = { cardWidth: 350, cardHeight: 360, imageHeight: 467, imageTop: -10 };
    const t = (key) => translate("en", key);
    const opacityOf = (name) => {
      let node = screen.getByText(name, { includeHiddenElements: true });
      while (node && !(node.props.style && [].concat(node.props.style).flat().some((st) => st && st.opacity !== undefined && st.position === "absolute"))) node = node.parent;
      return [].concat(node.props.style).flat().find((st) => st && st.opacity !== undefined).opacity;
    };
    const names = SAMPLE_FRIDGE_TAGS.map(({ id }) => translate("en", `sampleFridge.${id}`));

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it("starts with every label hidden and schedules one reveal per label plus the sweep", async () => {
      jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
      const spring = jest.spyOn(Animated, "spring");
      const timing = jest.spyOn(Animated, "timing");
      render(<SampleFridgeTags t={t} {...layout} />);
      await act(async () => {});
      for (const name of names) expect(opacityOf(name)).toBe(0);
      expect(spring).toHaveBeenCalledTimes(SAMPLE_FRIDGE_TAGS.length);
      expect(spring.mock.calls.every(([, config]) => config.toValue === 1)).toBe(true);
      expect(timing).toHaveBeenCalledTimes(1); // the scan line
    });

    it("shows all labels at once, with no sweep, when the system asks for reduced motion", async () => {
      jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
      const spring = jest.spyOn(Animated, "spring");
      const timing = jest.spyOn(Animated, "timing");
      render(<SampleFridgeTags t={t} {...layout} />);
      await act(async () => {});
      for (const name of names) expect(opacityOf(name)).toBe(1);
      expect(spring).not.toHaveBeenCalled();
      expect(timing).not.toHaveBeenCalled();
    });

    it("plays again when the play key changes, and not otherwise", async () => {
      jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
      const spring = jest.spyOn(Animated, "spring");
      const view = render(<SampleFridgeTags t={t} {...layout} playKey={0} />);
      await act(async () => {});
      expect(spring).toHaveBeenCalledTimes(SAMPLE_FRIDGE_TAGS.length);
      view.rerender(<SampleFridgeTags t={t} {...layout} playKey={0} />);
      await act(async () => {});
      expect(spring).toHaveBeenCalledTimes(SAMPLE_FRIDGE_TAGS.length);
      view.rerender(<SampleFridgeTags t={t} {...layout} playKey={1} />);
      await act(async () => {});
      expect(spring).toHaveBeenCalledTimes(SAMPLE_FRIDGE_TAGS.length * 2);
    });

    it("reveals each label when the line reaches it: higher items first", async () => {
      jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
      const delay = jest.spyOn(Animated, "delay");
      render(<SampleFridgeTags t={t} {...layout} />);
      await act(async () => {});
      const byHeight = [...SAMPLE_FRIDGE_TAGS].sort((a, b) => a.y - b.y);
      const delays = delay.mock.calls.map(([ms]) => ms).slice(1); // [0] is the sweep's start delay
      expect(delays).toHaveLength(SAMPLE_FRIDGE_TAGS.length);
      const shownOrder = SAMPLE_FRIDGE_TAGS.map((tag, i) => ({ tag, ms: delays[i] })).sort((a, b) => a.ms - b.ms).map((x) => x.tag.id);
      expect(shownOrder).toEqual(byHeight.map((tag) => tag.id));
    });
  });
});

describe("sampleCardHeight", () => {
  const { sampleCardHeight, ONBOARDING_CHROME_HEIGHT } = require("../src/constants/sampleFridge");
  const IPHONE = { top: 59, bottom: 34 };

  it("leaves room for the language row and buttons on a modern iPhone", () => {
    // 393x852: the card plus 420 of other content (the pantry strip included) plus both insets must fit the window.
    expect(sampleCardHeight(852, 421, IPHONE)).toBe(339);
    expect(sampleCardHeight(852, 421, IPHONE) + ONBOARDING_CHROME_HEIGHT + IPHONE.top + IPHONE.bottom).toBeLessThanOrEqual(852);
    expect(sampleCardHeight(932, 469, IPHONE)).toBe(419);
  });

  it("uses smaller insets (older iPhones, Android) to give the card more room", () => {
    expect(sampleCardHeight(667, 421, { top: 20, bottom: 0 })).toBe(227);
    expect(sampleCardHeight(800, 421, { top: 24, bottom: 0 })).toBe(356);
  });

  it("has a floor on tiny screens and never exceeds the picture", () => {
    expect(sampleCardHeight(480, 421, IPHONE)).toBe(220);
    expect(sampleCardHeight(1400, 469, IPHONE)).toBe(469);
  });

  it("works without insets (browser)", () => {
    expect(sampleCardHeight(844, 421)).toBe(421);
  });
});
