// AsyncStorage's native module doesn't exist under Jest; use its official mock.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The icon set ships ESM-only files Jest can't parse; component tests don't need the glyphs.
jest.mock("./src/icons", () => {
  const React = require("react");
  const Icon = () => React.createElement("Icon");
  return new Proxy({ __esModule: true }, { get: (target, key) => (key in target ? target[key] : Icon) });
});
