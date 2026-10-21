const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  { ignores: ["dist/**", ".expo/**", "node_modules/**", "scripts/smoke-test-screenshots/**"] },
  {
    // Use src/utils/log.js (log.debug / log.warn / log.error) instead.
    files: ["src/**/*.{js,jsx}", "App.jsx", "index.js"],
    rules: { "no-console": "error" },
  },
  {
    // Colors live in src/theme (palette.js, colors.js). Components read `useTheme().colors` for
    // anything that differs between light and dark, and import from the palette for fixed colors.
    // imageUtils.js is the dish-badge data table, which carries its own per-dish colors.
    files: ["src/**/*.{js,jsx}", "App.jsx"],
    ignores: ["src/theme/**", "src/utils/imageUtils.js"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#[0-9A-Fa-f]{3,8}$/]",
          message: "No hex colors outside src/theme. Use useTheme().colors, or a name from theme/palette.js.",
        },
      ],
    },
  },
  {
    files: ["__tests__/**/*.js", "test-utils/**/*.js", "live/**/*.js", "jest.setup.js"],
    languageOptions: {
      globals: { describe: "readonly", it: "readonly", test: "readonly", expect: "readonly", jest: "readonly", beforeEach: "readonly", afterEach: "readonly", __dirname: "readonly" },
    },
  },
  {
    // Node-side scripts and config files (CommonJS, not bundled into the app).
    files: ["scripts/**/*.js", "*.config.js", "live/*.js", "jest.setup.js"],
    languageOptions: { globals: { __dirname: "readonly", process: "readonly", module: "writable", global: "writable" } },
  },
];
