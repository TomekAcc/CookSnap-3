/**
 * Cook AI Design System — Ultimate Premium Native.
 * Spatial canvas #F5F5F7, pure white cards, 24px continuous curves, airy type.
 */
import { APPLE, BLACK, EMERALD, WHITE } from "../theme/palette";

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
      color: APPLE.label,
      letterSpacing: -0.5,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: APPLE.label,
      letterSpacing: -0.4,
    },
    body: { fontSize: 15, fontWeight: "400", color: APPLE.secondary, lineHeight: 22 },
    itemName: { fontSize: 16, fontWeight: "600", color: APPLE.label },
    caption: { fontSize: 13, fontWeight: "400", color: APPLE.tertiary },
    hint: {
      fontSize: 11,
      fontWeight: "600",
      color: APPLE.tertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
  },
  colors: {
    white: WHITE,
    spatial: APPLE.canvas,
    ink: APPLE.label,
    label: APPLE.secondary,
    muted: APPLE.tertiary,
    border: "rgba(0, 0, 0, 0.06)",
    borderSoft: "rgba(0, 0, 0, 0.04)",
    surface: WHITE,
    surfaceMuted: APPLE.canvas,
    backdrop: "rgba(0, 0, 0, 0.36)",
    blue: APPLE.blue,
    blueSoft: APPLE.blueSoft,
    orange: APPLE.orange,
    green: EMERALD[500],
    greenSoft: EMERALD[50],
    red: APPLE.red,
    redSoft: APPLE.redSoft,
  },
  shadow: {
    card: {
      shadowColor: BLACK,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 1,
    },
    cardHover: {
      shadowColor: BLACK,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 2,
    },
    sheet: {
      shadowColor: BLACK,
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 14,
    },
  },
};

export default DS;
