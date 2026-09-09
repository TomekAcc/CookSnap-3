import React from "react";
import { View } from "react-native";

// Single source of truth for every pastel icon container in the app —
// screen headers (Pantry & Staples, Saved Recipes) and inline feature
// cards (Include Pantry Staples, Servings, ...) all render through this
// so their size/radius/border formula can never drift apart again.
const SIZE = 44;
const RADIUS = 16;

const TONES = {
  emerald: {
    light: { bg: "#ECFDF5", border: "#D1FAE5" },
    dark: { bg: "#064E3B", border: "#065F46" },
  },
  amber: {
    light: { bg: "#FFFBEB", border: "rgba(253,230,138,0.6)" },
    dark: { bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.35)" },
  },
  indigo: {
    light: { bg: "#EEF2FF", border: "#E0E7FF" },
    dark: { bg: "#312E81", border: "#4338CA" },
  },
  rose: {
    light: { bg: "#FFF1F2", border: "#FFE4E6" },
    dark: { bg: "#4C0519", border: "#881337" },
  },
};

/** Pastel Soft-UI icon container — same w/h/radius everywhere, tone picks the palette. */
export default function IconBadge({ children, tone = "emerald", isDark = false, style }) {
  const palette = TONES[tone] || TONES.emerald;
  const colors = isDark ? palette.dark : palette.light;

  return (
    <View
      style={[
        {
          width: SIZE,
          height: SIZE,
          borderRadius: RADIUS,
          borderWidth: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
