/**
 * Cook AI Design System — Ultimate Premium Native.
 * Spatial canvas #F5F5F7, pure white cards, 24px continuous curves, airy type.
 */

export const DS = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 14,
    md: 18,
    lg: 24,
    xl: 24,
    xxl: 28,
  },
  typography: {
    title: "text-2xl font-bold text-neutral-900",
    subtitle: "text-sm font-medium text-gray-500",
    itemLabel: "text-sm font-semibold text-neutral-900",
    sheetTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: "#1D1D1F",
      letterSpacing: -0.5,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: "#1D1D1F",
      letterSpacing: -0.4,
    },
    body: { fontSize: 15, fontWeight: "400", color: "#6E6E73", lineHeight: 22 },
    itemName: { fontSize: 16, fontWeight: "600", color: "#1D1D1F" },
    caption: { fontSize: 13, fontWeight: "400", color: "#86868B" },
    hint: {
      fontSize: 11,
      fontWeight: "600",
      color: "#86868B",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
  },
  colors: {
    white: "#FFFFFF",
    spatial: "#F5F5F7",
    ink: "#1D1D1F",
    label: "#6E6E73",
    muted: "#86868B",
    border: "rgba(0, 0, 0, 0.06)",
    borderSoft: "rgba(0, 0, 0, 0.04)",
    surface: "#FFFFFF",
    surfaceMuted: "#F5F5F7",
    backdrop: "rgba(0, 0, 0, 0.36)",
    blue: "#007AFF",
    blueSoft: "#EAF2FF",
    orange: "#FF9F0A",
    green: "#10B981",
    greenSoft: "#ECFDF5",
    red: "#FF3B30",
    redSoft: "#FFECEA",
  },
  shadow: {
    card: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 1,
    },
    cardHover: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 2,
    },
    sheet: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 14,
    },
  },
};

export default DS;
