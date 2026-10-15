/**
 * Web smoke test — catches crash-level bugs (bad imports, TDZ errors, bad
 * hooks, broken navigation) without touching a phone or Expo Go.
 *
 * This is NOT a substitute for on-device testing: gestures, BlurView,
 * camera scanning, and native Modal behavior either don't run on web or
 * behave differently there. Use this only to keep obvious JS-level
 * breakage (crashes, blank screens, broken tab navigation) out of the
 * manual testing loop — the feel/animation/native work still needs a real
 * device.
 *
 * Usage:
 *   1. In one terminal: npx expo start --web
 *      (wait for "Waiting on http://localhost:8081")
 *   2. In another:      node scripts/web-smoke-test.js
 *
 * Requires the `playwright` package and a Chromium install available to it
 * (set PLAYWRIGHT_CHROMIUM_PATH to override the default lookup).
 */
const { chromium } = require("playwright");
const path = require("path");

const BASE_URL = process.env.SMOKE_TEST_URL || "http://localhost:8081";
const SCREENSHOT_DIR = path.join(__dirname, "smoke-test-screenshots");
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

const TABS = [
  { label: "Scanner", file: "01-scanner" },
  { label: "Pantry", file: "02-pantry" },
  { label: "Saved", file: "03-saved" },
  { label: "Profile", file: "04-profile" },
];

(async () => {
  const fs = require("fs");
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });

  let errors = [];
  const errorsByStep = {};
  page.on("pageerror", (err) => errors.push(err.stack || err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
  });

  const recordStep = (label) => {
    // Ignore the known jsQR CDN worker fetch failure — expected on web in
    // network-restricted environments, unrelated to app code.
    errorsByStep[label] = errors.filter((e) => !e.includes("jsQR"));
    errors = [];
  };

  console.log(`Navigating to ${BASE_URL} ...`);
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000);

  // Fresh browser context = fresh AsyncStorage = the first-launch onboarding
  // gate (language + units picker on one page, then the skippable PRO
  // intro screen) blocks the tab shell until dismissed. Accept the
  // defaults and skip PRO so the rest of this smoke test can reach the
  // actual app underneath.
  try {
    const getStarted = page.getByText("Get Started", { exact: true });
    if (await getStarted.isVisible({ timeout: 5000 })) {
      await getStarted.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
    }
  } catch {
    // No onboarding gate shown (already completed in this context) — fine.
  }
  try {
    const maybeLater = page.getByText("Maybe later", { exact: true });
    if (await maybeLater.isVisible({ timeout: 5000 })) {
      await maybeLater.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
    }
  } catch {
    // No PRO intro screen shown (already completed in this context) — fine.
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${TABS[0].file}.png`) });
  recordStep(TABS[0].label);

  for (const tab of TABS.slice(1)) {
    try {
      await page.getByText(tab.label, { exact: true }).click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${tab.file}.png`) });
    } catch (err) {
      errors.push(`[navigation] Could not click tab "${tab.label}": ${err.message}`);
    }
    recordStep(tab.label);
  }

  // Open a shared modal (the Pro paywall, built on StandardModal like every
  // other sheet in the app) so a regression in StandardModal.jsx/
  // bottomSheet.js gets caught here too, not just plain tab navigation.
  const MODAL_STEP = "Pro Paywall Modal";
  try {
    await page.getByText("Upgrade to PRO", { exact: false }).click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-pro-modal.png") });
  } catch (err) {
    errors.push(`[navigation] Could not open the Pro paywall modal: ${err.message}`);
  }
  recordStep(MODAL_STEP);

  console.log("\n=== RESULTS ===");
  let anyErrors = false;
  for (const tab of [...TABS, { label: MODAL_STEP }]) {
    const errs = errorsByStep[tab.label] || [];
    console.log(`${tab.label}: ${errs.length === 0 ? "OK" : `${errs.length} error(s)`}`);
    errs.forEach((e) => {
      anyErrors = true;
      console.log(`  - ${e.slice(0, 300)}`);
    });
  }

  await browser.close();
  if (anyErrors) {
    console.log("\nSMOKE TEST: ISSUES FOUND");
    process.exit(1);
  }
  console.log("\nSMOKE TEST: ALL CLEAR");
})().catch((err) => {
  console.error("SMOKE TEST CRASHED:", err);
  process.exit(1);
});
