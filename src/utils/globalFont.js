/**
 * Applies Plus Jakarta Sans to every <Text>/<TextInput> in the app without
 * touching each screen's own StyleSheet. The app renders JSX through
 * react-native-css-interop's jsx-runtime (NativeWind's className support
 * swaps `jsxImportSource` to it — confirmed via a direct Babel transpile of
 * a sample component), not the plain `react/jsx-runtime`, so patching
 * `React.createElement` — the usual trick for this — is a silent no-op
 * here. `Text.render` (the other classic trick) is also dead: RN 0.81's
 * Text is a plain function component, not `React.forwardRef`, so it has no
 * `.render` static to hook.
 *
 * Instead this reassigns the `jsx`/`jsxs`/`jsxDEV` exports on the actual
 * runtime module in place. Those exports are plain `exports.jsx = ...`
 * assignments (verified in the compiled dist file), not getter-only
 * bindings, so reassignment is safe — and every call site accesses them as
 * `_jsxRuntime.jsx(...)`, a live property read per call, not a value
 * captured once at import time, so patching after those modules first load
 * still reaches every subsequent element.
 */
import { Text, TextInput } from "react-native";

const FONT_BY_WEIGHT = {
  "100": "PlusJakartaSans_400Regular",
  "200": "PlusJakartaSans_400Regular",
  "300": "PlusJakartaSans_400Regular",
  "400": "PlusJakartaSans_400Regular",
  normal: "PlusJakartaSans_400Regular",
  "500": "PlusJakartaSans_500Medium",
  "600": "PlusJakartaSans_600SemiBold",
  "700": "PlusJakartaSans_700Bold",
  bold: "PlusJakartaSans_700Bold",
  "800": "PlusJakartaSans_800ExtraBold",
  "900": "PlusJakartaSans_800ExtraBold",
};
const DEFAULT_FAMILY = FONT_BY_WEIGHT["400"];

function flattenStyle(style) {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce((acc, s) => Object.assign(acc, flattenStyle(s)), {});
  }
  return style;
}

function withFontDefault(type, props) {
  if ((type !== Text && type !== TextInput) || !props || typeof props !== "object") {
    return props;
  }
  const flat = flattenStyle(props.style);
  // An element that already sets its own fontFamily (rare in this codebase,
  // but respected) keeps it — this only fills in the gap left by the
  // system-default font every other Text currently renders in.
  if (flat.fontFamily) return props;
  const family = FONT_BY_WEIGHT[String(flat.fontWeight || "400")] || DEFAULT_FAMILY;
  return { ...props, style: [{ fontFamily: family }, props.style] };
}

function wrapJsxFn(originalFn) {
  if (typeof originalFn !== "function") return originalFn;
  return function patchedJsx(type, props, ...rest) {
    return originalFn(type, withFontDefault(type, props), ...rest);
  };
}

let installed = false;

export function installGlobalFont() {
  if (installed) return;
  installed = true;

  // Primary path: NativeWind's active jsxImportSource.
  try {
    const cssInteropRuntime = require("react-native-css-interop/jsx-runtime");
    cssInteropRuntime.jsx = wrapJsxFn(cssInteropRuntime.jsx);
    cssInteropRuntime.jsxs = wrapJsxFn(cssInteropRuntime.jsxs);
    cssInteropRuntime.jsxDEV = wrapJsxFn(cssInteropRuntime.jsxDEV);
  } catch (err) {
    console.warn("[Cook AI] global font: css-interop runtime patch failed:", err?.message);
  }

  // Defensive fallback: any code path still on the plain React runtime
  // (unlikely given a single project-wide babel config, but harmless to
  // cover — this is a separate, independently-called module).
  try {
    const reactJsxRuntime = require("react/jsx-runtime");
    reactJsxRuntime.jsx = wrapJsxFn(reactJsxRuntime.jsx);
    reactJsxRuntime.jsxs = wrapJsxFn(reactJsxRuntime.jsxs);
    // eslint-disable-next-line camelcase
    if (reactJsxRuntime.jsxDEV) reactJsxRuntime.jsxDEV = wrapJsxFn(reactJsxRuntime.jsxDEV);
  } catch (err) {
    console.warn("[Cook AI] global font: react jsx-runtime patch failed:", err?.message);
  }
}
