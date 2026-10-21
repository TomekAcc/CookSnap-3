// The app's one logging entry point (instead of ~130 bare console calls).
//   log.debug  development only — a no-op in production builds, so scan
//              diagnostics (including raw model responses) stay off devices.
//   log.warn / log.error  always on, and the single place to forward to a
//              crash reporter later.
// A message that already starts with its own "[Tag]" is printed as written;
// anything else gets the app tag so Metro/Xcode output is easy to filter.
const TAG = "[Cook AI]";

const emit = (fn) => (...args) => {
  if (typeof args[0] === "string" && args[0].startsWith("[")) fn(...args);
  else fn(TAG, ...args);
};

/* eslint-disable no-console */
export const log = {
  debug: __DEV__ ? emit(console.log) : () => {},
  warn: emit(console.warn),
  error: emit(console.error),
};
