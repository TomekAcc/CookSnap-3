// Measures what one real scan and one real recipe generation cost in tokens (what Google bills for), so prices and
// fair-use limits rest on numbers, not guesses. Spends about 8 requests. Not part of `npm run test:live`; run it with:
//
//   LIVE_USAGE=1 EXPO_PUBLIC_GEMINI_PROXY_URL=https://<your-proxy> npx jest --config live/jest.config.js live/usage.live.js
//
// (or with EXPO_PUBLIC_GEMINI_API_KEY instead of the proxy). It prints a table; multiply the tokens by the
// per-million prices on Google's pricing page for the models named in the table.
import fs from "fs";
import path from "path";
import { analyzeFridgeImage } from "../src/services/geminiVision";
import { generateRecipesWithGemini, modifyRecipeWithGemini } from "../src/services/geminiRecipes";
import { clearRequestLog, getRequestLog } from "../src/services/geminiClient";

const enabled = process.env.LIVE_USAGE === "1" && (process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_PROXY_URL);
const run = enabled ? describe : describe.skip;
jest.setTimeout(240000);

const base64 = () => fs.readFileSync(path.join(__dirname, "../assets/sample-fridge.jpg")).toString("base64");

function report(label) {
  const rows = getRequestLog().filter((e) => e.tokensIn != null).reverse();
  const total = rows.reduce((a, e) => ({ inT: a.inT + e.tokensIn, outT: a.outT + e.tokensOut + (e.tokensThinking || 0), cached: a.cached + (e.tokensCached || 0) }), { inT: 0, outT: 0, cached: 0 });
  console.log(
    `\n== ${label}: ${rows.length} request(s), tokens in ${total.inT} (cached ${total.cached}), out ${total.outT}\n` +
      rows.map((e) => `   ${String(e.model).padEnd(26)} in ${String(e.tokensIn).padStart(6)} (cached ${String(e.tokensCached || 0).padStart(5)})  out ${String(e.tokensOut).padStart(5)}  thinking ${String(e.tokensThinking || 0).padStart(5)}  ${(e.ms / 1000).toFixed(1)}s`).join("\n")
  );
}

run("token usage per action", () => {
  let items = [];
  it("one fridge scan", async () => {
    clearRequestLog();
    items = await analyzeFridgeImage(base64());
    report("fridge scan");
    expect(items.length).toBeGreaterThan(0);
  });
  let recipes = [];
  const SETS = [
    ["Chicken breast", "Rice", "Lemon", "Garlic", "Spinach"],
    ["Eggs", "Milk", "Cheese", "Tomatoes", "Onion", "Bell pepper"],
    ["Pasta", "Ground beef", "Carrots", "Yogurt", "Butter", "Potatoes"],
  ];
  it.each([0, 1, 2])("recipe generation #%i (5 recipes, as PRO gets)", async (n) => {
    clearRequestLog();
    const inv = n === 0 ? items.slice(0, 12) : SETS[n].map((name) => ({ name }));
    const out = await generateRecipesWithGemini(inv, [{ name: "Salt", inStock: true }, { name: "Olive oil", inStock: true }], "dinner", 2, "normal", null, "", 5);
    report(`recipe generation #${n} (5 recipes)`);
    expect(out.length).toBeGreaterThan(0);
    if (n === 0) recipes = out;
  });
  it("one AI change to a recipe", async () => {
    clearRequestLog();
    await modifyRecipeWithGemini(recipes[0], "make it vegetarian", { vegetarian: true });
    report("modify recipe");
  });
});
