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
    files: ["__tests__/**/*.js", "test-utils/**/*.js", "live/**/*.js", "jest.setup.js"],
    languageOptions: {
      globals: { describe: "readonly", it: "readonly", test: "readonly", expect: "readonly", jest: "readonly", beforeEach: "readonly", afterEach: "readonly" },
    },
  },
  {
    // Node-side scripts and config files (CommonJS, not bundled into the app).
    files: ["scripts/**/*.js", "*.config.js", "live/*.js", "jest.setup.js"],
    languageOptions: { globals: { __dirname: "readonly", process: "readonly", module: "writable", global: "writable" } },
  },
];
