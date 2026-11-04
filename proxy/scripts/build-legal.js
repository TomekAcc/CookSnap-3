// Builds the public legal pages (privacy policy, terms, support) from docs/legal/*.md into src/legal-pages.js,
// which the Worker serves at /privacy, /terms and /support.
//
//   node scripts/build-legal.js --draft   keep placeholders, add a "draft" banner, tell search engines to stay away
//   node scripts/build-legal.js           final build: refuses to run while a [PLACEHOLDER] is left in the texts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { markdownToHtml } from "../src/markdown.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const legal = path.join(here, "../../docs/legal");
const draft = process.argv.includes("--draft");
const SUPPORT_EMAIL = "cooksnap.support@gmail.com";

// [COMPANY NAME ...], [DATE], [2], [PRICES: ...], [VERIFY ...], [**Payment provider** ...]; not a link label like [Privacy Policy](...)
const PLACEHOLDER = /\[(?:[A-Z][^\]\n]*|\d+(?:\.\d+)?|\*\*[^\]\n]*)\](?!\()/g;

function load(name) {
  let text = fs.readFileSync(path.join(legal, name), "utf8");
  const cut = text.indexOf("## Verify before publishing");
  if (cut !== -1) text = text.slice(0, cut).trimEnd() + "\n";
  // The "DRAFT for review" note at the top of each document is a blockquote; it is not part of a final page.
  if (!draft) text = text.replace(/^(#[^\n]*\n+)((?:>[^\n]*\n)+)/, "$1");
  return text.replace(/\[PRIVACY POLICY URL\]/g, "/privacy").replace(/\[Privacy Policy\]\(\/privacy\)/g, "[Privacy Policy](/privacy)");
}

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${draft ? '<meta name="robots" content="noindex,nofollow">' : ""}<title>${title} — CookSnap</title>
<style>
:root{--bg:#f7faf8;--card:#fff;--ink:#14231c;--soft:#4a5d54;--line:#dfe8e3;--accent:#047857;--warn:#fef3c7;--warnink:#78350f}
@media (prefers-color-scheme:dark){:root{--bg:#0c1511;--card:#121e18;--ink:#e8f1ec;--soft:#9db3a8;--line:#223229;--accent:#34d399;--warn:#3a2e0b;--warnink:#fde68a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding:28px 18px 80px}header{display:flex;gap:16px;align-items:baseline;flex-wrap:wrap;margin-bottom:8px}
header b{font-size:20px;color:var(--accent)}nav{display:flex;gap:14px;font-size:14px}a{color:var(--accent)}
h1{font-size:30px;line-height:1.2;margin:18px 0 6px}h2{font-size:20px;margin:30px 0 6px}h3{font-size:17px;margin:20px 0 4px}p,li{color:var(--ink)}
ul,ol{padding-left:22px}li{margin:4px 0}hr{border:0;border-top:1px solid var(--line);margin:26px 0}code{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:1px 5px;font-size:.92em}
blockquote{margin:14px 0;padding:12px 14px;border-radius:12px;background:var(--warn);color:var(--warnink)}
.table{overflow-x:auto;margin:14px 0}table{border-collapse:collapse;min-width:640px;background:var(--card);font-size:14px}th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}th{color:var(--soft)}
footer{margin-top:40px;color:var(--soft);font-size:13px}
</style></head><body><main><header><b>CookSnap</b><nav><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Support</a></nav></header>
${draft ? "<blockquote><strong>Draft.</strong> This page is not final and is not legal advice.</blockquote>" : ""}${body}
<footer>© CookSnap · <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></footer></main></body></html>`;

const supportMd = `# Support

Questions, problems or ideas about CookSnap? We read everything.

- **In the app:** Profile > Help & Feedback. Choose Problem, Idea, Bad recipe or Other, write a few words and send. A message with no connection is saved on your phone and sent when you are back online. To report a recipe, open it and tap "Report a problem with this recipe".
- **By email:** ${SUPPORT_EMAIL}

## Your data

CookSnap has no accounts. Your saved recipes, pantry and settings are on your phone; delete them in the app or by uninstalling. Photos you scan are sent to Google's AI through our server and are not kept by us. Read the [Privacy Policy](/privacy) for details, or write to us to ask about your data.

## Allergies and diets

Recipes are written by AI and can be wrong. If you have an allergy or a medical diet, always check the ingredients yourself. See the [Terms of Service](/terms).
`;

const sources = { privacy: ["Privacy Policy", load("PRIVACY_POLICY.md")], terms: ["Terms of Service", load("TERMS_OF_SERVICE.md")], support: ["Support", supportMd] };
const left = [];
for (const [key, [, text]] of Object.entries(sources)) for (const m of text.match(PLACEHOLDER) || []) left.push(`${key}: ${m}`);
if (!draft && left.length) {
  console.error(`Final build refused: ${left.length} placeholder(s) left:\n  ${[...new Set(left)].join("\n  ")}\nFill them in docs/legal, or build a draft with --draft.`);
  process.exit(1);
}
const pages = Object.fromEntries(Object.entries(sources).map(([key, [title, text]]) => [key, page(title, markdownToHtml(text))]));
const file = `// GENERATED by scripts/build-legal.js from docs/legal. Do not edit; run \`npm run build:legal\` (or \`build:legal:draft\`).
export const LEGAL_DRAFT = ${draft};
export const LEGAL_PAGES = ${JSON.stringify(pages, null, 1)};
`;
fs.writeFileSync(path.join(here, "../src/legal-pages.js"), file);
console.log(`${draft ? "Draft" : "Final"} legal pages written (${Object.keys(pages).join(", ")}); ${new Set(left).size} placeholder(s) ${draft ? "left in the draft" : "left"}.`);
