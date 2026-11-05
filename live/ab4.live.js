/* global afterAll */
// A/B: which model writes the recipes (the main, expensive call). Compares gemini-flash-lite-latest (now),
// the same generation pinned (gemini-3.5-flash-lite) and the cheaper gemini-3.1-flash-lite.
// Needs the proxy to allow the two pinned models (proxy/src/policy.js, then `npx wrangler deploy`).
// LIVE_AB=1 EXPO_PUBLIC_GEMINI_PROXY_URL=https://<proxy> npx jest --config live/jest.config.js live/ab4.live.js
import { generateRecipesWithGemini } from "../src/services/geminiRecipes";
import { clearRequestLog, getRequestLog } from "../src/services/geminiClient";

const PRICE = { "gemini-flash-latest": [0.75, 3.75], "gemini-flash-lite-latest": [0.30, 2.50], "gemini-3.5-flash-lite": [0.30, 2.50], "gemini-3.1-flash-lite": [0.25, 1.50], "gemini-3.7-flash": [0.75, 3.75] };
const MODES = { latest: "gemini-flash-lite-latest", pinned35: "gemini-3.5-flash-lite", lite31: "gemini-3.1-flash-lite" };
(process.env.LIVE_AB === "1" ? describe : describe.skip)("A/B generation model", () => {
  jest.setTimeout(1200000);
  const realFetch = global.fetch;
  let mode = "latest";
  global.fetch = async (url, init) => {
    if (mode !== "latest" && init?.body && String(url).includes("gemini-flash-lite-latest:generateContent")) url = String(url).replace("gemini-flash-lite-latest:", `${MODES[mode]}:`);
    return realFetch(url, init);
  };
  const SC = [
    { id: "en-dinner", lang: "English", unit: "us", meal: "dinner", diet: null, inv: ["Chicken thighs", "Rice", "Broccoli", "Garlic", "Lemon", "Eggs", "Onion"] },
    { id: "pl-gf", lang: "Polish", unit: "metric", meal: "dinner", diet: { glutenFree: true }, inv: ["Pierś z kurczaka", "Ryż", "Cytryna", "Czosnek", "Szpinak", "Jajka", "Cebula"] },
    { id: "de-veg", lang: "German", unit: "metric", meal: "breakfast", diet: { vegetarian: true }, inv: ["Eier", "Milch", "Tomaten", "Käse", "Brot", "Butter", "Paprika"] },
    { id: "es-lunch", lang: "Spanish", unit: "metric", meal: "lunch", diet: null, inv: ["Pasta", "Carne picada", "Zanahorias", "Cebolla", "Tomates", "Queso"] },
    { id: "it-pasta", lang: "Italian", unit: "metric", meal: "dinner", diet: null, inv: ["Spaghetti", "Pomodori", "Aglio", "Basilico", "Riso", "Zucchine"] },
    { id: "fr-vegan", lang: "French", unit: "metric", meal: "lunch", diet: { vegan: true }, inv: ["Pois chiches", "Riz", "Tomates", "Épinards", "Oignon", "Citron"] },
    { id: "ja-nutfree", lang: "Japanese", unit: "metric", meal: "dinner", diet: { nutFree: true }, inv: ["豚肉", "キャベツ", "卵", "ご飯", "ねぎ", "しょうが"] },
    { id: "pl-breakfast", lang: "Polish", unit: "metric", meal: "breakfast", diet: null, inv: ["Jajka", "Mleko", "Pomidory", "Ser", "Chleb", "Masło"] },
  ];
  const SALT = /(^|\W)(salt|sól|salz|sal|sel|sale|塩)(\W|$)/i;
  const stats = Object.fromEntries(Object.keys(MODES).map((m) => [m, []]));
  it.each(SC)("$id", async (sc) => {
    for (const m of Object.keys(MODES)) {
      mode = m; clearRequestLog();
      const out = await generateRecipesWithGemini(sc.inv.map((name) => ({ name })), [{ name: "Salt", inStock: true }], sc.meal, 2, "normal", sc.diet, "", 5, false, [], sc.unit, sc.lang);
      const log = getRequestLog().filter((e) => e.tokensIn != null);
      const cost = log.reduce((a, e) => { const p = PRICE[e.model] || PRICE["gemini-flash-latest"]; return a + (e.tokensIn * p[0] + (e.tokensOut + (e.tokensThinking || 0)) * p[1]) / 1e6; }, 0);
      const bigCalls = log.filter((e) => e.tokensIn > 5000);
      stats[m].push({ id: sc.id, n: out.length, calls: log.length, big: bigCalls.length, cost, models: [...new Set(log.map((e) => e.model))].join(","), salt: out.filter((r) => (r.ingredientsList || []).some((l) => SALT.test(l))).length, steps3: out.filter((r) => (r.steps || []).length >= 3).length, dish: new Set(out.map((r) => r.dishType)).size, cat: out.filter((r) => sc.meal === "all" || r.category === sc.meal || (["lunch", "dinner"].includes(sc.meal) && ["lunch", "dinner"].includes(r.category))).length, stepLen: out.reduce((a, r) => a + (r.steps || []).join(" ").length, 0) / Math.max(1, out.length), titles: out.map((r) => r.title), sample: out[0] ? `${out[0].title}: ${(out[0].ingredientsList || []).slice(0, 7).join("; ")} || ${(out[0].steps || [])[0]}` : "" });
    }
  });
  afterAll(() => {
    const f = (m, k) => stats[m].reduce((a, s) => a + s[k], 0);
    const head = Object.keys(MODES);
    console.log("\n(" + head.join(" / ") + ")\n" + SC.map((sc) => `${sc.id.padEnd(13)} ` + ["n", "calls", "big", "salt", "steps3", "dish", "cat"].map((k) => `${k} ${head.map((m) => stats[m].find((s) => s.id === sc.id)?.[k]).join("/")}`).join("  ") + `  cost(c) ${head.map((m) => ((stats[m].find((s) => s.id === sc.id)?.cost || 0) * 100).toFixed(2)).join("/")}`).join("\n") + "\nTOTAL " + ["n", "calls", "big", "salt", "steps3", "dish", "cat"].map((k) => `${k} ${head.map((m) => f(m, k)).join("/")}`).join("  ") + `  cost(c) ${head.map((m) => (f(m, "cost") * 100).toFixed(2)).join("/")}  stepLen ${head.map((m) => Math.round(f(m, "stepLen") / SC.length)).join("/")}\n\nSAMPLES\n` + SC.slice(0, 4).map((sc) => `${sc.id}\n` + head.map((m) => `  ${m}: ${stats[m].find((s) => s.id === sc.id)?.sample}`).join("\n")).join("\n") + "\n\nTITLES\n" + SC.map((sc) => `${sc.id}\n` + head.map((m) => `  ${m}: ${stats[m].find((s) => s.id === sc.id)?.titles.join(" | ")}`).join("\n")).join("\n"));
  });
});
