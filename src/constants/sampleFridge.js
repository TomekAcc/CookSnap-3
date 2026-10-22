import { Asset } from "expo-asset";

/**
 * The onboarding "sample scan": a bundled illustration of an open fridge and
 * the fixed list of what is in it. It runs through the real scanning animation
 * and then the real recipe generation, but never calls the vision API, never
 * uses up a daily free scan, and is never saved (see completeDemoScan in
 * ScanContext) — it exists so someone who installs the app away from their
 * kitchen still gets to see what it does.
 *
 * Every item below is drawn in the illustration (scripts/sample-fridge-
 * illustration.js), so what is "detected" matches what is on screen.
 */
export const SAMPLE_FRIDGE_IMAGE = require("../../assets/sample-fridge.jpg");

// id doubles as the translation key suffix: sampleFridge.<id>
export const SAMPLE_FRIDGE_ITEMS = [
  { id: "milk", icon: "🥛" },
  { id: "yogurt", icon: "🥣" },
  { id: "cheese", icon: "🧀" },
  { id: "butter", icon: "🧈" },
  { id: "eggs", icon: "🥚" },
  { id: "orangeJuice", icon: "🍊" },
  { id: "tomatoes", icon: "🍅" },
  { id: "bellPepper", icon: "🫑" },
  { id: "lemon", icon: "🍋" },
  { id: "onion", icon: "🧅" },
  { id: "spinach", icon: "🥬" },
  { id: "carrots", icon: "🥕" },
];

/**
 * Where to pin a label on the illustration, as fractions of the image (x across, y down) at
 * the top-centre of the item. Only items on the top three shelves: the onboarding card crops
 * the bottom drawers on shorter phones. Names come from the sampleFridge.<id> translations.
 */
export const SAMPLE_FRIDGE_TAGS = [
  { id: "cheese", x: 0.511, y: 0.196 },
  { id: "eggs", x: 0.233, y: 0.45 },
  { id: "orangeJuice", x: 0.633, y: 0.371 },
  { id: "tomatoes", x: 0.167, y: 0.68 },
  { id: "onion", x: 0.684, y: 0.6875 },
];

/**
 * Pixel size of the bundled sample, known synchronously (Metro records it in the
 * asset's metadata). expo-asset rather than Image.resolveAssetSource, which does
 * not exist on react-native-web.
 */
export function sampleFridgeSize() {
  try {
    const asset = Asset.fromModule(SAMPLE_FRIDGE_IMAGE);
    if (asset?.width && asset?.height) return { width: asset.width, height: asset.height };
  } catch {
    // fall through
  }
  return null;
}

/**
 * Height the sample needs at the scan card's width, known up front, so the
 * scanning frame can open at its final shape instead of resizing once the image
 * loads.
 */
export function sampleFridgeFitHeight(contentWidth) {
  const size = sampleFridgeSize();
  return size ? Math.max(240, Math.round((contentWidth * size.height) / size.width)) : null;
}
