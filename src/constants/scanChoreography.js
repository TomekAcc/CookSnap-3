/** Canonical fridge-scan choreography length (ms). */
export const TOTAL_SCAN_DURATION = 3200;

/**
 * How long the full bar stays before the scan card turns into the result. The bar's own fill to 100% is now an
 * eased 0.5-1.5s, so the finish is already a visible moment; a longer hold (it was 650ms) read as the app
 * hanging on a full bar. Just enough for the eye to see "full" before the card moves on.
 */
export const SCAN_DONE_HOLD_MS = 120;

export const SCAN_STEPS = [
  {
    id: 1,
    textKey: "scanner.step1TopShelves",
    icon: "🥛",
  },
  {
    id: 2,
    textKey: "scanner.step2MiddleShelves",
    icon: "🫙",
  },
  {
    id: 3,
    textKey: "scanner.step3ProduceDrawers",
    icon: "🥬",
  },
  {
    id: 4,
    textKey: "scanner.step4Finalizing",
    icon: "⚡",
  },
];

/**
 * Pantry-shelf equivalent of SCAN_STEPS — same 4-beat shape and timing
 * (shares TOTAL_SCAN_DURATION), but with wording that fits a pantry shelf
 * rather than a fridge (no "produce drawers" here). Step 4 reuses the
 * fridge flow's own generic "Finalizing ingredients" text/icon since
 * nothing about it is fridge-specific.
 */
export const PANTRY_SCAN_STEPS = [
  { id: 1, textKey: "pantry.scanStep1", icon: "📦" },
  { id: 2, textKey: "pantry.scanStep2", icon: "🏷️" },
  { id: 3, textKey: "pantry.scanStep3", icon: "🫙" },
  { id: 4, textKey: "scanner.step4Finalizing", icon: "⚡" },
];

/** Soft demo list only — Vision pipeline must never inject these as real detections. */
export const FALLBACK_FRIDGE_ITEMS = [
  { id: "fallback-milk", name: "Milk", icon: "🥛", emoji: "🥛" },
  { id: "fallback-eggs", name: "Eggs", icon: "🥚", emoji: "🥚" },
  { id: "fallback-yogurt", name: "Greek Yogurt", icon: "🥣", emoji: "🥣" },
  { id: "fallback-butter", name: "Butter", icon: "🧈", emoji: "🧈" },
  { id: "fallback-tomatoes", name: "Tomatoes", icon: "🍅", emoji: "🍅" },
  { id: "fallback-cabbage", name: "Cabbage", icon: "🥬", emoji: "🥬" },
  { id: "fallback-cheese", name: "Cheese", icon: "🧀", emoji: "🧀" },
  { id: "fallback-oil", name: "Olive Oil", icon: "🫒", emoji: "🫒" },
  { id: "fallback-soy", name: "Soy Sauce", icon: "🍾", emoji: "🍾" },
  { id: "fallback-apple", name: "Apple", icon: "🍎", emoji: "🍎" },
  { id: "fallback-potatoes", name: "Potatoes", icon: "🥔", emoji: "🥔" },
  { id: "fallback-juice", name: "Juice", icon: "🧃", emoji: "🧃" },
];

// What the scan screen says while the AI works, and when each line appears
// (ms after the scan starts). Deliberately generic: the model sees the whole
// photo at once, so it never "scans shelves" one after another.
export const SCAN_STATUS_KEYS = [
  "scanner.statusLooking",
  "scanner.statusSpotting",
  "scanner.statusAlmost",
  "scanner.statusSlow",
];
export const SCAN_STATUS_AT_MS = [0, 2500, 6500, 14000];
