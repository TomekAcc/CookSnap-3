// AsyncStorage's native module doesn't exist under Jest; use its official mock.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The icon set ships ESM-only files Jest can't parse, so stub it with exactly the names it
// exports: a component importing a name that doesn't exist still gets `undefined`, as in the app.
jest.mock("./src/icons", () => {
  const React = require("react");
  const source = require("fs").readFileSync(require("path").join(__dirname, "src/icons.js"), "utf8");
  const stub = { __esModule: true };
  for (const [, name] of source.matchAll(/default as (\w+) \}/g)) {
    stub[name] = () => React.createElement("Icon");
  }
  return stub;
});
