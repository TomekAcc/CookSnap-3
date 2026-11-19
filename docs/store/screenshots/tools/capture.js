// Captures the REAL CookSnap screen (the web build served by Metro on :8081) at the phone frame of the slides (430 x 873 pt @3x
// = 1290 x 2619 px, the same shape as the frame screen) and draws the iOS status bar (9:41, signal, Wi-Fi, full battery) on top, because a browser has none.
//
//   NODE_PATH=<dir with playwright> node capture.js <scan|recipes|steps|diets|planner|pantry|modify> <en|pl> <out.png> [fridge-photo.jpg|png]
//
// Needs `EXPO_PUBLIC_GEMINI_PROXY_URL=... npx expo start --web --port 8081` running. Nothing in the app is changed: the
// screen is put in its normal "just scanned" state by writing the app's own saved data (same keys the app uses), and
// "recipes" really taps "Generate AI Recipes" so the recipes are genuinely written by the AI through the proxy.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [slide, lang, out, photo] = process.argv.slice(2);
if (!slide || !lang || !out) { console.error('usage: capture.js <scan|recipes> <en|pl> <out.png> [photo]'); process.exit(1); }

const TR = require('child_process').execFileSync('node', ['--input-type=module', '-e', `import('${path.resolve(__dirname, '../../../../src/i18n/translations/' + lang + '.js')}').then(m=>process.stdout.write(JSON.stringify(m.default)))`], { maxBuffer: 1 << 24, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const K = JSON.parse(TR);
const zw = (str) => str.split('').join('\u200c?'); // the app puts a zero-width joiner inside some tab labels
const T = { nav_scanner: K['nav.scanner'], generate: K['scanner.generateRecipes'], recipesTitle: K['recipeFeed.title'] };
const ING = {
  en: ['Eggs', 'Milk', 'Cheese', 'Butter', 'Tomatoes', 'Bell Pepper', 'Spinach', 'Lemons', 'Strawberries', 'Carrots', 'Cucumber', 'Broccoli', 'Chicken', 'Olives'],
  pl: ['Jajka', 'Mleko', 'Ser', 'Masło', 'Pomidory', 'Papryka', 'Szpinak', 'Cytryny', 'Truskawki', 'Marchewki', 'Ogórek', 'Brokuły', 'Kurczak', 'Oliwki'],
};
const EMOJI = ['🥚', '🥛', '🧀', '🧈', '🍅', '🫑', '🥬', '🍋', '🍓', '🥕', '🥒', '🥦', '🍗', '🫒'];
const items = ING[lang].map((name, i) => ({ id: `ing-${i}`, name, emoji: EMOJI[i], icon: EMOJI[i] }));

const PANTRY = {
  en: ['Pasta', 'Rice', 'Flour', 'Rolled oats', 'Sugar', 'Olive oil', 'Soy sauce', 'Honey', 'Tomato paste', 'Salt', 'Black pepper', 'Paprika', 'Oregano', 'Cinnamon', 'Mustard', 'Ketchup'],
  pl: ['Makaron', 'Ryż', 'Mąka', 'Płatki owsiane', 'Cukier', 'Oliwa z oliwek', 'Sos sojowy', 'Miód', 'Koncentrat pomidorowy', 'Sól', 'Czarny pieprz', 'Papryka słodka', 'Oregano', 'Cynamon', 'Musztarda', 'Ketchup'],
}[lang];
const PANTRY_META = [['Grains & Baking', '🍝'], ['Grains & Baking', '🍚'], ['Grains & Baking', '🌾'], ['Grains & Baking', '🥣'], ['Grains & Baking', '🍬'], ['Oils & Sauces', '🫒'], ['Oils & Sauces', '🍾'], ['Oils & Sauces', '🍯'], ['Oils & Sauces', '🍅'], ['Spices & Herbs', '🧂'], ['Spices & Herbs', '🧂'], ['Spices & Herbs', '🌶️'], ['Spices & Herbs', '🌿'], ['Spices & Herbs', '🍂'], ['Condiments', '🟡'], ['Condiments', '🍅']];
const pantryItems = PANTRY.map((name, i) => ({ id: `p-${i}`, name, category: PANTRY_META[i][0], icon: PANTRY_META[i][1], emoji: PANTRY_META[i][1], inStock: i !== 15 }));
const MODIFY = { en: 'Make it dairy-free', pl: 'Zrób to bez nabiału' }[lang];
const USES = { en: /Uses \d+ fridge item/, pl: /Wykorzystuje \d+ składnik/ }[lang];

const STATUS_BAR = `
<div id="ios-status" style="position:fixed;left:0;top:0;width:430px;height:54px;z-index:2147483647;pointer-events:none;__BG__font-family:Inter,'SF Pro Text',-apple-system,Helvetica,Arial,sans-serif;color:#000">
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
    'cooksnap:isPro:v1': slide === 'scan' ? 'false' : 'true',
    'cooksnap:pantryItems:v1': JSON.stringify(pantryItems),
  };
  if (slide === 'diets') seed['cooksnap:dietaryRestrictions:v1'] = JSON.stringify({ vegetarian: true, vegan: false, gluten_free: true, lactose_free: false, dairy_free: false, keto: false, nut_free: false, pescatarian: false, diabetic: false });
  if (photo) { seed['cooksnap:fridgePhoto:v1'] = JSON.stringify('/__shot/fridge'); await page.route('**/__shot/fridge', (r) => r.fulfill({ body: fs.readFileSync(photo), contentType: photo.endsWith('.png') ? 'image/png' : 'image/jpeg' })); }
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 54, bottom: 34 } }).catch(() => {});
  await page.goto('http://localhost:8081/', { waitUntil: 'load' });
  await page.getByText(T.nav_scanner, { exact: true }).last().waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  const generate = async () => {
    await page.getByText(T.generate, { exact: true }).first().click();
    await page.getByText(T.recipesTitle, { exact: true }).first().waitFor({ timeout: 180000 });
    await page.waitForTimeout(6000); // let the cards and their emoji settle
  };
  // Scrolls only the container that holds the text (so a sheet's own list moves, not the page behind it).
  const scrollTo = (text, offset = 64) => page.evaluate(([title, off]) => {
    const el = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && d.textContent.trim() === title);
    if (!el) return;
    let sc = el.parentElement;
    while (sc && !(sc.scrollHeight > sc.clientHeight + 50 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    if (sc) sc.scrollTop += el.getBoundingClientRect().top - off;
  }, [text, offset]);
  const tab = async (key) => { await page.getByText(new RegExp('^' + zw(K[key]) + '$')).last().click(); await page.waitForTimeout(1500); };
  const openFirstRecipe = async () => { await page.getByText(USES).first().click(); await page.waitForTimeout(2500); };

  if (slide === 'recipes') { await generate(); await scrollTo(T.recipesTitle); }
  if (slide === 'steps') { await generate(); await openFirstRecipe(); await scrollTo(K['recipeDetail.instructionsTitle'], 250); }
  if (slide === 'modify') {
    await generate(); await openFirstRecipe();
    await page.getByText(K['recipeDetail.modifyWithAI'], { exact: true }).first().click();
    await page.waitForTimeout(800);
    await page.getByPlaceholder(K['recipeDetail.modifyPlaceholder']).fill(MODIFY);
    await page.waitForTimeout(500);
  }
  if (slide === 'planner') {
    await tab('nav.profile');
    await page.getByText(K['menu.mealPlanner'], { exact: true }).first().click();
    await page.waitForTimeout(1500);
    await page.getByText(K['mealPlanner.autoFillWeek'], { exact: true }).first().click();
    await page.getByText(K['mealPlanner.regenerateWeek'], { exact: true }).first().waitFor({ timeout: 240000 });
    await page.waitForTimeout(4000);
  }
  if (slide === 'diets') {
    await tab('nav.profile');
    await page.getByText(new RegExp('^' + K['diet.vegetarian.name'])).first().click();   // open the diet list
    await page.waitForTimeout(1200);
    await scrollTo(K['profile.dietPreferences'], 74);
    await page.waitForTimeout(800);
  }
  if (slide === 'pantry') { await tab('nav.pantry'); await page.waitForTimeout(1500); }
  // Behind the status bar: plain screens show the app background (content scrolled under it is hidden, like a real
  // iOS nav bar); sheets show the same dim colour the app puts over the page, so nothing peeks through behind the clock.
  const modal = ['steps', 'modify', 'planner'].includes(slide);
  let barBg = '#F5F5F7';
  if (modal) {
    const px = await page.screenshot({ clip: { x: 200, y: 8, width: 1, height: 1 }, type: 'png' });
    const png = require('zlib').inflateSync(Buffer.concat((() => { const out = []; let o = 8; while (o < px.length) { const len = px.readUInt32BE(o); const type = px.toString('ascii', o + 4, o + 8); if (type === 'IDAT') out.push(px.subarray(o + 8, o + 8 + len)); o += 12 + len; } return out; })()));
    barBg = `rgb(${png[1]},${png[2]},${png[3]})`;
  }
  await page.evaluate((html) => { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d.firstElementChild); }, STATUS_BAR.replace('__BG__', `background:${barBg};`));
  await page.waitForTimeout(500);
  await page.screenshot({ path: out });
  await browser.close();
  console.log('saved', out);
})().catch((e) => { console.error(e); process.exit(1); });
