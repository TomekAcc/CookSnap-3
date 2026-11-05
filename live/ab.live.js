// A/B: recipe generation with the old request shape (rules sent twice) vs the current one (rules once).
// Run: LIVE_AB=1 EXPO_PUBLIC_GEMINI_PROXY_URL=https://<proxy> npx jest --config live/jest.config.js live/ab.live.js
import { generateRecipesWithGemini } from "../src/services/geminiRecipes";
import { clearRequestLog, getRequestLog } from "../src/services/geminiClient";

const enabled = process.env.LIVE_AB === "1";
(enabled ? describe : describe.skip)("A/B recipe quality", () => {
  jest.setTimeout(900000);
  const realFetch = global.fetch;
  let mode = "new";
  global.fetch = async (url, init) => {
    if (mode === "old" && init?.body) {
      try {
        const b = JSON.parse(init.body);
        const sys = b?.systemInstruction?.parts?.[0]?.text;
        if (sys && sys.startsWith("You are an experienced home cook")) {
          b.contents[0].parts[0].text = `${sys}\n\n${b.contents[0].parts[0].text}`;
          init = { ...init, body: JSON.stringify(b) };
        }
      } catch {}
    }
    return realFetch(url, init);
  };

  const SC = [
    { id: "en-dinner", lang: "English", unit: "us", meal: "dinner", diet: null, inv: ["Chicken thighs", "Rice", "Broccoli", "Garlic", "Lemon", "Eggs", "Onion"] },
    { id: "pl-gf", lang: "Polish", unit: "metric", meal: "dinner", diet: { glutenFree: true }, inv: ["Pierś z kurczaka", "Ryż", "Cytryna", "Czosnek", "Szpinak", "Jajka", "Cebula"] },
    { id: "de-veg-breakfast", lang: "German", unit: "metric", meal: "breakfast", diet: { vegetarian: true }, inv: ["Eier", "Milch", "Tomaten", "Käse", "Brot", "Butter", "Paprika"] },
    { id: "es-lunch", lang: "Spanish", unit: "metric", meal: "lunch", diet: null, inv: ["Pasta", "Carne picada", "Zanahorias", "Cebolla", "Tomates", "Queso"] },
    { id: "ja-nutfree", lang: "Japanese", unit: "metric", meal: "dinner", diet: { nutFree: true }, inv: ["豚肉", "キャベツ", "卵", "ご飯", "ねぎ", "しょうが"] },
    { id: "fr-vegan", lang: "French", unit: "metric", meal: "lunch", diet: { vegan: true }, inv: ["Pois chiches", "Riz", "Tomates", "Épinards", "Oignon", "Citron"] },
  ];
  const SALT = /(^|\W)(salt|sól|salz|sal|sel|塩|食塩)(\W|$)/i;
  const stats = { old: [], new: [] };

  it.each(SC)("$id", async (sc) => {
    for (const m of ["old", "new"]) {
      mode = m;
      clearRequestLog();
      const t0 = Date.now();
      const out = await generateRecipesWithGemini(sc.inv.map((name) => ({ name })), [{ name: "Salt", inStock: true }, { name: "Olive oil", inStock: true }], sc.meal, 2, "normal", sc.diet, "", 5, false, [], sc.unit, sc.lang);
      const log = getRequestLog().filter((e) => e.tokensIn != null);
      const toks = log.reduce((a, e) => ({ i: a.i + e.tokensIn, o: a.o + e.tokensOut + (e.tokensThinking || 0) }), { i: 0, o: 0 });
      const upper = sc.lang === "German" ? true : false;
      const q = {
        n: out.length,
        calls: log.length,
        tokIn: toks.i,
        tokOut: toks.o,
        sec: Math.round((Date.now() - t0) / 100) / 10,
        titleCap: out.filter((r) => /^\p{Lu}|^[^\p{L}]/u.test(r.title)).length,
        salt: out.filter((r) => (r.ingredientsList || []).some((l) => SALT.test(l))).length,
        steps3: out.filter((r) => (r.steps || []).length >= 3).length,
        dishTypes: new Set(out.map((r) => r.dishType)).size,
        catOk: out.filter((r) => (sc.meal === "all" ? true : r.category === sc.meal || (["lunch", "dinner"].includes(sc.meal) && ["lunch", "dinner"].includes(r.category)))).length,
        lowerIng: out.filter((r) => (r.ingredientsList || []).every((l) => upper || sc.lang === "Japanese" || !/^\d[\d.,/]*\s*\S*\s+\p{Lu}\p{Ll}/u.test(l))).length,
        titles: out.map((r) => r.title),
      };
      stats[m].push({ id: sc.id, ...q });
    }
  });

  afterAll(() => {
    const sum = (m, k) => stats[m].reduce((a, s) => a + s[k], 0);
    const rows = SC.map((sc) => {
      const o = stats.old.find((s) => s.id === sc.id), n = stats.new.find((s) => s.id === sc.id);
      return `${sc.id.padEnd(17)} recipes ${o?.n}/${n?.n}  calls ${o?.calls}/${n?.calls}  tokIn ${o?.tokIn}/${n?.tokIn}  dishTypes ${o?.dishTypes}/${n?.dishTypes}  salt ${o?.salt}/${n?.salt}  steps>=3 ${o?.steps3}/${n?.steps3}  cat ${o?.catOk}/${n?.catOk}  titleCap ${o?.titleCap}/${n?.titleCap}  lowerIng ${o?.lowerIng}/${n?.lowerIng}  sec ${o?.sec}/${n?.sec}`;
    });
    console.log("\n(old / new)\n" + rows.join("\n") + "\nTOTAL " + ["n", "calls", "tokIn", "tokOut", "dishTypes", "salt", "steps3", "catOk", "titleCap", "lowerIng"].map((k) => `${k} ${sum("old", k)}/${sum("new", k)}`).join("  ") + "\n\nTITLES\n" + SC.map((sc) => `${sc.id}\n  old: ${stats.old.find((s) => s.id === sc.id)?.titles.join(" | ")}\n  new: ${stats.new.find((s) => s.id === sc.id)?.titles.join(" | ")}`).join("\n"));
  });
});
