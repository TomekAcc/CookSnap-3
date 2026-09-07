import { StyleSheet } from "react-native";

/**
 * Unified modal chrome — every sheet/drawer backdrop MUST use staticBackdrop.
 * Edge-to-edge (covers status bar). Zero top padding/margin. Zero shadow/border
 * so the Header never bleeds a dark band through a translucent overlay.
 * Shadows belong ONLY on the sliding sheetCard — never here.
 */
export const modalStyles = StyleSheet.create({
  staticBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    elevation: 0,
    shadowOpacity: 0,
    shadowColor: "transparent",
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    borderWidth: 0,
    borderColor: "transparent",
    borderTopWidth: 0,
    borderBottomWidth: 0,
    margin: 0,
    padding: 0,
  },
});

/**
 * Absolute shadow purge for Header + near-header elevated cards.
 */
export const SHADOW_KILL = Object.freeze({
  elevation: 0,
  shadowOpacity: 0,
  shadowColor: "transparent",
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  borderBottomWidth: 0,
  borderBottomColor: "transparent",
});

export default modalStyles;
