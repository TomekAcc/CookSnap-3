import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";

/**
 * Absolute chrome kill — use on Header AND any host wrapper above content
 * so no hairline / elevation can bleed under CookSnap through a dim overlay.
 */
export const HEADER_SHADOW_KILL = Object.freeze({
  elevation: 0,
  shadowOpacity: 0,
  shadowColor: "transparent",
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  borderBottomWidth: 0,
  borderBottomColor: "transparent",
  borderTopWidth: 0,
  borderWidth: 0,
  borderColor: "transparent",
});

/**
 * Header — flat, matches the page background exactly (no frosted/blurred
 * idle state). A translucent BlurView tint here used to read as a visibly
 * different "white" than the flat page body below it — iOS blur lightens
 * whatever's behind it even when the base color matches exactly, and this
 * app's screens are flat pastel/white layouts with nothing rich enough
 * behind the header to make a frosted-glass effect worth that seam. Also
 * removes another always-on BlurView cost, same reasoning as BottomNav's.
 *
 * Renders INLINE as the first item inside each tab's own scrollable
 * content (Scanner/Pantry/Saved/Profile), not as a permanently pinned
 * shell above it — it carries no functionality (no menu, no icons, the
 * old hamburger drawer is long gone), so it doesn't earn permanently
 * reserved screen space on every screen. It used to compute its own
 * safe-area top inset because it sat directly under the notch; now the
 * app shell's own SafeAreaView handles that (edges includes "top"), so
 * this is just a normal top-of-list block with ordinary padding.
 */
export default function Header() {
  const { colors, isDark } = useTheme();

  const headerStyle = [
    styles.base,
    {
      backgroundColor: colors.bg || "#FFFFFF",
    },
  ];

  return (
    <View
      style={headerStyle}
      pointerEvents="box-none"
      collapsable={false}
    >
      {/* Left-aligned, not centered: centering only made sense when a
          hamburger button and a spacer bracketed the wordmark on both
          sides. The hamburger drawer is gone now — everything it held
          (Meal Planner, Scan History, Saved, PRO, Settings, Help) already
          has a home on the Profile tab or the bottom nav — so this is the
          only thing left in the header, and a left-aligned brand mark
          reads as placed rather than centered for lack of anything else. */}
      <View style={styles.brandChrome}>
        <Text style={styles.wordmark}>
          <Text
            style={[
              styles.brandText,
              { color: isDark ? colors.textPrimary : "#0F172A" },
            ]}
          >
            Cook
          </Text>
          <Text style={[styles.brandText, styles.brandTextAccent]}>Snap</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Flat, borderless, shadowless header in both idle and flattened states —
  // no separator line under the brand chrome in either theme. A hairline
  // here used to flash as a harsh grey/white stripe switching themes; the
  // header now merges straight into the canvas, edge to edge.
  base: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0,
    borderBottomColor: "transparent",
    elevation: 0,
    shadowOpacity: 0,
    shadowColor: "transparent",
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  brandChrome: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  // Single unified wordmark — "Cook" + emerald "Snap", no icon box, no pill.
  wordmark: {
    fontSize: 21,
  },
  brandText: {
    fontWeight: "800",
    fontSize: 21,
    letterSpacing: -0.6,
  },
  brandTextAccent: {
    color: "#10B981",
  },
});
