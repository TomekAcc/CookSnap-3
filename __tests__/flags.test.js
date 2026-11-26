// The Settings "Testing" tools must be absent from a production build: no __DEV__ and no
// EXPO_PUBLIC_SHOW_TESTING means they are not shown, and either one turns them on.
const load = (dev, flag) => {
  const prevDev = global.__DEV__;
  const prevFlag = process.env.EXPO_PUBLIC_SHOW_TESTING;
  global.__DEV__ = dev;
  if (flag === undefined) delete process.env.EXPO_PUBLIC_SHOW_TESTING;
  else process.env.EXPO_PUBLIC_SHOW_TESTING = flag;
  let value;
  jest.isolateModules(() => {
    value = require("../src/config/flags").SHOW_TESTING_TOOLS;
  });
  global.__DEV__ = prevDev;
  if (prevFlag === undefined) delete process.env.EXPO_PUBLIC_SHOW_TESTING;
  else process.env.EXPO_PUBLIC_SHOW_TESTING = prevFlag;
  return value;
};

describe("SHOW_TESTING_TOOLS", () => {
  it("is off in a production build", () => expect(load(false, undefined)).toBe(false));
  it("is off for any other value of the flag", () => expect(load(false, "0")).toBe(false));
  it("is on in development", () => expect(load(true, undefined)).toBe(true));
  it("is on when the preview environment sets the flag", () => expect(load(false, "1")).toBe(true));
});
