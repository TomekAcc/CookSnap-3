// Captures the REAL CookSnap screen (the web build served by Metro on :8081) at the phone frame of the slides (430 x 873 pt @3x
// = 1290 x 2619 px, the same shape as the frame screen) and draws the iOS status bar (9:41, signal, Wi-Fi, full battery) on top, because a browser has none.
//
//   NODE_PATH=<dir with playwright> node capture.js <scan|recipes> <en|pl> <out.png> [fridge-photo.jpg|png]
//
// Needs `EXPO_PUBLIC_GEMINI_PROXY_URL=... npx expo start --web --port 8081` running. Nothing in the app is changed: the
// screen is put in its normal "just scanned" state by writing the app's own saved data (same keys the app uses), and
// "recipes" really taps "Generate AI Recipes" so the recipes are genuinely written by the AI through the proxy.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [slide, lang, out, photo] = process.argv.slice(2);
if (!slide || !lang || !out) { console.error('usage: capture.js <scan|recipes> <en|pl> <out.png> [photo]'); process.exit(1); }

const T = require(path.join(__dirname, 'strings.js'))[lang];
const ING = {
  en: ['Eggs', 'Milk', 'Cheese', 'Butter', 'Tomatoes', 'Bell Pepper', 'Spinach', 'Lemons', 'Strawberries', 'Carrots', 'Cucumber', 'Broccoli', 'Chicken', 'Olives'],
  pl: ['Jajka', 'Mleko', 'Ser', 'Masło', 'Pomidory', 'Papryka', 'Szpinak', 'Cytryny', 'Truskawki', 'Marchewki', 'Ogórek', 'Brokuły', 'Kurczak', 'Oliwki'],
};
const EMOJI = ['🥚', '🥛', '🧀', '🧈', '🍅', '🫑', '🥬', '🍋', '🍓', '🥕', '🥒', '🥦', '🍗', '🫒'];
const items = ING[lang].map((name, i) => ({ id: `ing-${i}`, name, emoji: EMOJI[i], icon: EMOJI[i] }));

const STATUS_BAR = `
<div id="ios-status" style="position:fixed;left:0;top:0;width:430px;height:54px;z-index:2147483647;pointer-events:none;font-family:Inter,'SF Pro Text',-apple-system,Helvetica,Arial,sans-serif;color:#000">
  <div style="position:absolute;left:0;top:0;width:150px;height:54px;display:flex;align-items:center;justify-content:center;padding-top:6px;font-weight:600;font-size:17px;letter-spacing:-0.2px">9:41</div>
  <div style="position:absolute;right:30px;top:0;height:54px;display:flex;align-items:center;gap:7px;padding-top:6px">
    <svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3.2" height="4" rx="1" fill="#000"/><rect x="5" y="5.5" width="3.2" height="6.5" rx="1" fill="#000"/><rect x="10" y="3" width="3.2" height="9" rx="1" fill="#000"/><rect x="15" y="0" width="3.2" height="12" rx="1" fill="#000"/></svg>
    <svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 2.3c2.3 0 4.4.9 6 2.4l.9-1A10.3 10.3 0 0 0 8.5.9C5.7.9 3.2 2 1.2 3.8l.9 1a8.9 8.9 0 0 1 6.4-2.5z" fill="#000"/><path d="M8.5 5.9c1.3 0 2.5.5 3.5 1.3l.9-1a7.4 7.4 0 0 0-8.8 0l.9 1c1-.8 2.2-1.3 3.5-1.3z" fill="#000"/><path d="M8.5 9.4c.6 0 1.2.2 1.6.6L8.5 11.8 6.9 10c.4-.4 1-.6 1.6-.6z" fill="#000"/></svg>
    <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="22.5" height="12" rx="3.6" fill="none" stroke="#000" opacity="0.4"/><rect x="2" y="2" width="19.5" height="9" rx="2.3" fill="#000"/><path d="M24.4 4.4v4.2c.9-.3 1.6-1.2 1.6-2.1s-.7-1.8-1.6-2.1z" fill="#000" opacity="0.45"/></svg>
  </div>
</div>`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 430, height: 873 }, deviceScaleFactor: 3, locale: lang === 'pl' ? 'pl-PL' : 'en-US', colorScheme: 'light' });
  const page = await ctx.newPage();
  const seed = {
    'cooksnap:onboardingComplete:v1': 'true', 'cooksnap:recipeLanguage:v1': lang, 'cooksnap:unitSystem:v1': lang === 'pl' ? 'metric' : 'us',
    'cooksnap:firstScanHintShown:v1': 'true', 'cooksnap:settingsDoneHintShown:v1': 'true', 'cooksnap:aiConsent:v1': 'true',
    'cooksnap:ingredients:v1': JSON.stringify(items),
    'cooksnap:isPro:v1': slide === 'recipes' ? 'true' : 'false',
  };
  if (photo) { seed['cooksnap:fridgePhoto:v1'] = JSON.stringify('/__shot/fridge'); await page.route('**/__shot/fridge', (r) => r.fulfill({ body: fs.readFileSync(photo), contentType: photo.endsWith('.png') ? 'image/png' : 'image/jpeg' })); }
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 54, bottom: 34 } }).catch(() => {});
  await page.goto('http://localhost:8081/', { waitUntil: 'load' });
  await page.getByText(T.nav_scanner, { exact: true }).last().waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  if (slide === 'recipes') {
    await page.getByText(T.generate, { exact: true }).first().click();
    await page.getByText(T.recipesTitle, { exact: true }).first().waitFor({ timeout: 180000 });
    await page.waitForTimeout(6000); // let the cards and their emoji settle
    await page.evaluate((title) => {
      const el = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && d.textContent.trim() === title);
      const sc = [...document.querySelectorAll('div')].filter((e) => e.scrollHeight > e.clientHeight + 50);
      if (el) for (const s of sc) s.scrollTop += el.getBoundingClientRect().top - 64;
    }, T.recipesTitle);
    await page.waitForTimeout(1200);
  }
  await page.evaluate((html) => { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d.firstElementChild); }, STATUS_BAR);
  await page.waitForTimeout(500);
  await page.screenshot({ path: out });
  await browser.close();
  console.log('saved', out);
})().catch((e) => { console.error(e); process.exit(1); });
