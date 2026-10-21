/**
 * Raw colors — the only place hex values live (besides the dish-badge data table in
 * utils/imageUtils.js). Names follow the Tailwind scales the app already used, plus the
 * Apple system grays/blues/reds the base theme is built on.
 *
 * Components don't import these for anything that changes between light and dark: that goes
 * through the theme tokens in colors.js (`useTheme().colors`). Import from here only for a
 * color that is deliberately the same in both themes (white text on a green button, a
 * fixed status-bar tint).
 */
export const WHITE = "#FFFFFF";
export const BLACK = "#000000";

export const SLATE = {
  50: "#F8FAFC",
  100: "#F1F5F9",
  200: "#E2E8F0",
  300: "#CBD5E1",
  400: "#94A3B8",
  500: "#64748B",
  700: "#334155",
  800: "#1E293B",
  900: "#0F172A",
};
export const GRAY = { 200: "#E5E7EB" };
export const STONE = { 200: "#E7E5E4", 300: "#D6D3D1" };

export const EMERALD = {
  50: "#ECFDF5",
  100: "#D1FAE5",
  200: "#A7F3D0",
  300: "#6EE7B7",
  400: "#34D399",
  500: "#10B981",
  600: "#059669",
  700: "#047857",
  800: "#065F46",
  900: "#064E3B",
};
export const GREEN = { 500: "#22C55E", 600: "#16A34A" };
export const AMBER = {
  50: "#FFFBEB",
  100: "#FEF3C7",
  200: "#FDE68A",
  300: "#FCD34D",
  400: "#FBBF24",
  500: "#F59E0B",
  600: "#D97706",
  700: "#B45309",
  800: "#92400E",
  900: "#78350F",
};
export const YELLOW = { 100: "#FEF9C3" };
export const ORANGE = { 100: "#FFEDD5", 200: "#FED7AA", 600: "#EA580C" };
export const RED = { 100: "#FEE2E2", 200: "#FECACA", 400: "#F87171", 500: "#EF4444", 600: "#DC2626" };
export const ROSE = {
  100: "#FFE4E6",
  200: "#FECDD3",
  300: "#FDA4AF",
  600: "#E11D48",
  700: "#BE123C",
  900: "#881337",
  950: "#4C0519",
};
export const PINK = { 500: "#EC4899", 700: "#BE185D" };
export const SKY = { 100: "#E0F2FE", 200: "#BAE6FD", 300: "#7DD3FC", 600: "#0284C7", 700: "#0369A1" };
export const VIOLET = { 100: "#EDE9FE", 200: "#DDD6FE" };
export const INDIGO = { 600: "#4F46E5" };

/** Apple-system neutrals and accents behind the base light/dark themes. */
export const APPLE = {
  canvas: "#F5F5F7",
  label: "#1D1D1F",
  secondary: "#6E6E73",
  tertiary: "#86868B",
  gray: "#8E8E93",
  separator: "#D2D2D7",
  darkCard: "#1C1C1E",
  darkInset: "#2C2C2E",
  darkHandle: "#636366",
  darkSecondary: "#A1A1A6",
  blue: "#007AFF",
  blueDark: "#0A84FF",
  blueSoft: "#EAF2FF",
  blueSoftDark: "#0A2540",
  blueBorder: "#B3D4FF",
  blueBorderDark: "#0A4A8A",
  green: "#34C759",
  greenDark: "#30D158",
  orange: "#FF9F0A",
  red: "#FF3B30",
  redDark: "#FF453A",
  redText: "#D70015",
  redSoft: "#FFECEA",
  redBorder: "#FFC4C0",
  redSoftDark: "#3A0A08",
  redBorderDark: "#8A1C16",
};

/** Off-scale one-offs that appear in the UI. */
export const MISC = { paleBlueGray: "#E6EDF2", mutedFill: "#F3F5F8" };
