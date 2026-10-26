import { Asset } from "expo-asset";

/**
 * The onboarding "sample scan": a bundled illustration of the inside of a fridge and
 * the fixed list of what is in it. It runs through the real scanning animation
 * and then the real recipe generation, but never calls the vision API, never
 * uses up a daily free scan, and is never saved (see completeDemoScan in
 * ScanContext) — it exists so someone who installs the app away from their
 * kitchen still gets to see what it does.
 *
 * Every item below is drawn in the illustration, so what is "detected" matches what is on
 * screen. The picture was generated for this app by its owner (Google Flow) and cropped to the
 * inside of the fridge: no cabinet rim, no generator watermark. Replacing it means re-measuring
 * SAMPLE_FRIDGE_TAGS below.
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
 * Where to pin a label on the picture, as fractions of the image (x across, y down) at the
 * top-centre of the item. Only items with clear wall above them and nothing from the shelf above
 * in the way (the orange juice sits too close under the top shelf), on the upper shelves: the
 * onboarding card crops the bottom drawers on shorter phones. Names come from the
 * sampleFridge.<id> translations. Measured on assets/sample-fridge.jpg (1427 x 1716).
 */
export const SAMPLE_FRIDGE_TAGS = [
  { id: "cheese", x: 0.511, y: 0.21 },
  { id: "eggs", x: 0.154, y: 0.508 },
  { id: "tomatoes", x: 0.126, y: 0.741 },
  { id: "onion", x: 0.729, y: 0.71 },
];

// Everything on the onboarding screen that is not the picture card.
export const ONBOARDING_CHROME_HEIGHT = 416;

/**
 * Height of the onboarding picture card: what is left of the window after everything else on the
 * screen (header, fridge/pantry tabs, language row and pinned buttons, about 416pt, plus the notch and home-bar
 * insets), never less than 220 and never more than the whole picture. Calibrated by simulating
 * an iPhone's safe-area insets in a browser: with this much reserved the language row ends
 * about 8pt above the buttons on 375x812 up to 430x932 screens.
 */
export function sampleCardHeight(windowHeight, imageHeight, insets = { top: 0, bottom: 0 }) {
  const room = windowHeight - ONBOARDING_CHROME_HEIGHT - (insets.top || 0) - (insets.bottom || 0);
  return Math.round(Math.max(220, Math.min(imageHeight, room)));
}

/**
 * Pixel size of the bundled sample, known synchronously (Metro records it in the
 * asset's metadata). expo-asset rather than Image.resolveAssetSource, which does
 * not exist on react-native-web.
 */
export function sampleFridgeSize() {
  return sampleImageSize(SAMPLE_FRIDGE_IMAGE);
}

/** Pixel size of any bundled sample picture (see sampleFridgeSize). */
export function sampleImageSize(source) {
  try {
    const asset = Asset.fromModule(source);
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
