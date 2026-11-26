import { floatingCtaBottom, floatingCtaClearance, TAB_BAR_BODY, FLOATING_CTA_GAP, FLOATING_CTA_HEIGHT } from "../src/constants/layout";

describe("floating button placement", () => {
  it("sits a clear gap above the tab bar, which is its body plus the bottom safe area (at least 8)", () => {
    expect(floatingCtaBottom(0)).toBe(8 + TAB_BAR_BODY + FLOATING_CTA_GAP);
    expect(floatingCtaBottom(34)).toBe(34 + TAB_BAR_BODY + FLOATING_CTA_GAP);
    expect(FLOATING_CTA_GAP).toBeGreaterThanOrEqual(12);
  });

  it("asks scroll views for room for the button plus some air", () => {
    expect(floatingCtaClearance(34)).toBe(floatingCtaBottom(34) + FLOATING_CTA_HEIGHT + 16);
    expect(floatingCtaClearance(34, 30)).toBe(floatingCtaBottom(34) + FLOATING_CTA_HEIGHT + 30);
  });
});
