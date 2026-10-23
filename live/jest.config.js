// Plain node environment (not jest-expo): the live checks need the real
// global fetch, which jest-expo replaces with a stub.
module.exports = {
  rootDir: "..",
  testEnvironment: "node",
  testMatch: ["<rootDir>/live/*.live.js"],
  transform: { "\\.[jt]sx?$": "babel-jest" },
  moduleNameMapper: {
    "^expo-image-manipulator$": "<rootDir>/live/stubs/image-manipulator.js",
    // babel-preset-expo rewrites process.env.EXPO_PUBLIC_* to this ESM module.
    "^expo/virtual/env$": "<rootDir>/live/stubs/expo-env.js",
  },
  setupFiles: ["<rootDir>/live/setup.js"],
};
