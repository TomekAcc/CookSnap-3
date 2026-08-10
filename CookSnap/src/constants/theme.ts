export const colors = {
  slate: "#0F172A",
  offwhite: "#F8FAFC",
  white: "#FFFFFF",
  border: "#E2E8F0",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  success: "#22C55E",
  danger: "#EF4444",
  accents: {
    mint: "#B8F2E6",
    peach: "#FFD6BA",
    lavender: "#D9D2FF",
    sky: "#C9E4FF",
    butter: "#FFF3B0",
    coral: "#FFC2B4",
  },
} as const;

export const accentPalette = [
  colors.accents.mint,
  colors.accents.peach,
  colors.accents.lavender,
  colors.accents.sky,
  colors.accents.butter,
  colors.accents.coral,
];

export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const MODAL_HEIGHT_PERCENT = 0.8;
