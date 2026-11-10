const { LIGHT_COLORS, DARK_COLORS } = require("../src/theme/colors");

describe("theme colors", () => {
  it("light and dark define exactly the same roles", () => {
    expect(Object.keys(DARK_COLORS).sort()).toEqual(Object.keys(LIGHT_COLORS).sort());
  });

  it("every role is a color string", () => {
    for (const theme of [LIGHT_COLORS, DARK_COLORS]) {
      for (const [role, value] of Object.entries(theme)) {
        expect([role, typeof value]).toEqual([role, "string"]);
        expect([role, /^(#[0-9A-Fa-f]{6}|rgba?\([^)]*\))$/.test(value)]).toEqual([role, true]);
      }
    }
  });

  it("keeps the roles components already rely on", () => {
    for (const role of ["bg", "card", "cardBorder", "textPrimary", "textSecondary", "inputBg", "accentGreen", "danger"]) {
      expect(LIGHT_COLORS[role]).toBeTruthy();
      expect(DARK_COLORS[role]).toBeTruthy();
    }
  });
});
