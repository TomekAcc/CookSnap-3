/* global afterAll */
// A/B: recipe "editor" (quality-check) pass on gemini-flash-latest (now) vs on gemini-flash-lite-latest.
// LIVE_AB=1 EXPO_PUBLIC_GEMINI_PROXY_URL=https://<proxy> npx jest --config live/jest.config.js live/ab3.live.js
import { generateRecipesWithGemini } from "../src/services/geminiRecipes";
import { clearRequestLog, getRequestLog } from "../src/services/geminiClient";

const PRICE = { // USD per million tokens [in, out]; Flash from 1.1.2027 is [1.5, 7.5]
  "gemini-flash-latest": [0.75, 3.75], "gemini-flash-lite-latest": [0.30, 2.50], "gemini-3.7-flash": [0.75, 3.75],
};
(process.env.LIVE_AB === "1" ? describe : describe.skip)("A/B editor model", () => {
  jest.setTimeout(900000);
  const realFetch = global.fetch;
  let mode = "flash";
  global.fetch = async (url, init) => {
    if (mode === "lite" && init?.body && String(url).includes("gemini-flash-latest:generateContent")) {
      try {
        const b = JSON.parse(init.body);
        if (String(b?.systemInstruction?.parts?.[0]?.text || "").includes("meticulous recipe editor")) {
          delete b.generationConfig?.thinkingConfig; // not accepted by the Lite model
          init = { ...init, body: JSON.stringify(b) };
          url = String(url).replace("gemini-flash-latest:", "gemini-flash-lite-latest:");
        }
      } catch {}
    }
    return realFetch(url, init);
  };
  const SC = [
    { id: "en-dinner", lang: "English", unit: "us", meal: "dinner", diet: null, inv: ["Chicken thighs", "Rice", "Broccoli", "Garlic", "Lemon", "Eggs", "Onion"] },
    { id: "pl-gf", lang: "Polish", unit: "metric", meal: "dinner", diet: { glutenFree: true }, inv: ["Pierś z kurczaka", "Ryż", "Cytryna", "Czosnek", "Szpinak", "Jajka", "Cebula"] },
    { id: "de-veg", lang: "German", unit: "metric", meal: "breakfast", diet: { vegetarian: true }, inv: ["Eier", "Milch", "Tomaten", "Käse", "Brot", "Butter", "Paprika"] },
    { id: "es-lunch", lang: "Spanish", unit: "metric", meal: "lunch", diet: null, inv: ["Pasta", "Carne picada", "Zanahorias", "Cebolla", "Tomates", "Queso"] },
    { id: "it-pasta", lang: "Italian", unit: "metric", meal: "dinner", diet: null, inv: ["Spaghetti", "Pomodori", "Aglio", "Basilico", "Riso", "Zucchine"] },
    { id: "fr-vegan", lang: "French", unit: "metric", meal: "lunch", diet: { vegan: true }, inv: ["Pois chiches", "Riz", "Tomates", "Épinards", "Oignon", "Citron"] },
  ];
  const stats = { flash: [], lite: [] };
  const saltGrams = (lines) => lines.reduce((a, l) => {
    const m = String(l).match(/^([\d.,/]+)\s*(g|tsp|łyżeczk\w*|cdt|cc|el)?\b.*\b(salt|sól|salz|sal|sel|sale)\b/i);
    if (!m) return a; const n = m[1].includes("/") ? m[1].split("/").reduce((x, y) => x / y) : parseFloat(m[1].replace(",", "."));
    return a + (m[2] && /^(tsp|cdt|cc|łyżeczk)/i.test(m[2]) ? n * 6 : n);
  }, 0);
  it.each(SC)("$id", async (sc) => {
    for (const m of ["flash", "lite"]) {
      mode = m; clearRequestLog();
      const out = await generateRecipesWithGemini(sc.inv.map((name) => ({ name })), [{ name: "Salt", inStock: true }], sc.meal, 2, "normal", sc.diet, "", 5, false, [], sc.unit, sc.lang);
      const log = getRequestLog().filter((e) => e.tokensIn != null);
      const cost = log.reduce((a, e) => { const p = PRICE[e.model] || PRICE["gemini-flash-latest"]; return a + (e.tokensIn * p[0] + (e.tokensOut + (e.tokensThinking || 0)) * p[1]) / 1e6; }, 0);
      const salts = out.map((r) => saltGrams(r.ingredientsList || []));
      stats[m].push({ id: sc.id, n: out.length, calls: log.length, cost, over: salts.filter((g) => g > 9).length, noSalt: salts.filter((g) => g === 0).length, steps3: out.filter((r) => (r.steps || []).length >= 3).length, dish: new Set(out.map((r) => r.dishType)).size, avgSteps: out.reduce((a, r) => a + (r.steps || []).join(" ").length, 0) / Math.max(1, out.length), sample: out.slice(0, 2).map((r) => `${r.title}: ${(r.ingredientsList || []).slice(0, 8).join("; ")}`) });
    }
  });
  afterAll(() => {
    const f = (m, k) => stats[m].reduce((a, s) => a + s[k], 0);
    console.log("\n(QA on flash / QA on lite)\n" + SC.map((sc) => { const a = stats.flash.find((s) => s.id === sc.id), b = stats.lite.find((s) => s.id === sc.id); return `${sc.id.padEnd(10)} recipes ${a?.n}/${b?.n} calls ${a?.calls}/${b?.calls} cost ${(a?.cost * 100).toFixed(2)}c/${(b?.cost * 100).toFixed(2)}c oversalted ${a?.over}/${b?.over} noSalt ${a?.noSalt}/${b?.noSalt} steps>=3 ${a?.steps3}/${b?.steps3} dishTypes ${a?.dish}/${b?.dish} stepChars ${Math.round(a?.avgSteps)}/${Math.round(b?.avgSteps)}`; }).join("\n") + `\nTOTAL recipes ${f("flash", "n")}/${f("lite", "n")} calls ${f("flash", "calls")}/${f("lite", "calls")} cost ${(f("flash", "cost") * 100).toFixed(2)}c/${(f("lite", "cost") * 100).toFixed(2)}c oversalted ${f("flash", "over")}/${f("lite", "over")} noSalt ${f("flash", "noSalt")}/${f("lite", "noSalt")} steps>=3 ${f("flash", "steps3")}/${f("lite", "steps3")}`);
  });
});
