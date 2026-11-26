// Renders the SVG masters in this folder to the PNGs the app uses (run from the repo root: node assets/source/render-icon-pngs.js).
// Needs Playwright (any Chromium). Sizes: 1024 stores, Android foreground at the 66% safe zone, splash with rounded corners.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const SRC = __dirname;
const OUT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8").replace(/<svg[^>]*>/, (m) => m.replace(/ width="\d+" height="\d+"/, ' width="100%" height="100%"'));

async function shot(page, html, size, file, { transparent = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${transparent ? "transparent" : "#fff"}">${html}</body></html>`);
  await page.screenshot({ path: path.join(OUT, file), omitBackground: transparent });
}
const box = (svg, size, extra = "") => `<div style="width:${size}px;height:${size}px;${extra}">${svg}</div>`;
// the artwork scaled into the centre of a transparent canvas (Android adaptive icons keep the logo inside the 66% safe zone)
const safe = (svg, size) => `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center"><div style="width:${Math.round(size * 0.5456)}px;height:${Math.round(size * 0.5456)}px">${svg}</div></div>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await shot(page, box(read("icon-light.svg"), 1024), 1024, "icon.png");
  await shot(page, box(read("icon-dark.svg"), 1024), 1024, "icon-dark.png");
  await shot(page, box(read("icon-tinted.svg"), 1024), 1024, "icon-tinted.png");
  await shot(page, box(read("icon-light.svg"), 48), 48, "favicon.png");
  await shot(page, box(read("icon-light.svg"), 1024, "border-radius:22.37%;overflow:hidden"), 1024, "splash-icon.png", { transparent: true });
  await shot(page, safe(read("icon-glyph.svg"), 1024), 1024, "adaptive-icon.png", { transparent: true });
  await shot(page, safe(read("icon-glyph.svg"), 512), 512, "android-icon-foreground.png", { transparent: true });
  await shot(page, safe(read("icon-glyph-mono.svg"), 432), 432, "android-icon-monochrome.png", { transparent: true });
  await shot(page, `<div style="width:512px;height:512px;background:#10B981"></div>`, 512, "android-icon-background.png");
  await browser.close();
})();
