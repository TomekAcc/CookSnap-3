import { ViewStyle } from "react-native";

/**
 * Shared with the Scanner screen so it can restore the exact same style
 * when handing the tab bar back after an immersive full-screen scan —
 * toggling to `{ display: "none" }` and back to a bare `{ display: "flex" }`
 * would drop the custom height/colors and flash an unstyled bar.
 */
export function getTabBarStyle(insetsBottom: number): ViewStyle {
  return {
    backgroundColor: "#F8FAFC",
    borderTopWidth: 0,
    height: 64 + insetsBottom,
    paddingTop: 8,
    paddingBottom: insetsBottom + 8,
    elevation: 0,
    shadowOpacity: 0,
  };
}
