// Renders scripts/sample-fridge-illustration.js to assets/sample-fridge.jpg.
//   node scripts/render-sample-fridge.js [out.jpg]
// Needs Playwright with a Chromium (the same one scripts/web-smoke-test.js uses).
const fs = require("fs");
const path = require("path");
const { svg, W, H, RENDER_SCALE } = require("./sample-fridge-illustration");

(async () => {
  const { chromium } = require("playwright");
  const out = process.argv[2] || path.join(__dirname, "..", "assets", "sample-fridge.jpg");
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: Math.round(W * RENDER_SCALE), height: Math.round(H * RENDER_SCALE) } });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  await page.screenshot({ path: out, type: "jpeg", quality: 88 });
  await browser.close();
  console.log(`${out}: ${Math.round(fs.statSync(out).size / 1024)} KB`);
})();
