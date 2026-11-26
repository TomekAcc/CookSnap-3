import { LayoutAnimation, Platform, UIManager } from "react-native";

/** Enable Android layout animations once (no-op on iOS / web). */
let androidEnabled = false;

export function enableLayoutAnimations() {
  if (androidEnabled) return;
  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
  androidEnabled = true;
}

/**
 * Soft ease-in-out before the next React state-driven layout change.
 * Call immediately before setState that affects visible layout (tabs, drawer chrome).
 */
export function animateLayout(
  preset = LayoutAnimation.Presets.easeInEaseOut
) {
  try {
    enableLayoutAnimations();
    LayoutAnimation.configureNext(preset);
  } catch {
    // LayoutAnimation can throw on some hermes/web builds — ignore.
  }
}

export { LayoutAnimation };
