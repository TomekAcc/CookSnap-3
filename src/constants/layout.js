// Where a floating action button ("Generate Recipes", "Regenerate AI Recipes", Settings' "Done") sits above the
// bottom tab bar. The bar is TAB_BAR_BODY tall plus the bottom safe area (at least 8, see BottomNav), and the
// button floats FLOATING_CTA_GAP above that. (The old code assumed a 56 body, so the button ended about 1px above
// the bar, not the 10px intended; measured with the bar at 73px tall on a phone with no bottom inset.)
export const TAB_BAR_BODY = 65;
export const FLOATING_CTA_GAP = 14;
export const FLOATING_CTA_HEIGHT = 56;

/** `bottom` offset for the absolutely positioned wrapper of a floating button. */
export function floatingCtaBottom(insetBottom) {
  return Math.max(insetBottom, 8) + TAB_BAR_BODY + FLOATING_CTA_GAP;
}

/** Bottom padding a scroll view needs so its last row ends above a floating button with some air. */
export function floatingCtaClearance(insetBottom, air = 16) {
  return floatingCtaBottom(insetBottom) + FLOATING_CTA_HEIGHT + air;
}
