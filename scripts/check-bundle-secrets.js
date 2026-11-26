/**
 * Fails if a Google API key is found anywhere in an exported app bundle.
 *   npx expo export --platform android --output-dir <dir>
 *   node scripts/check-bundle-secrets.js <dir>
 *
 * The Gemini key belongs on the proxy only. EXPO_PUBLIC_* variables are compiled into the
 * bundle, so a key left in .env (or in EAS environment variables) would ship to every phone.
 * Only the file name and a count are printed, never the key itself.
 */
const fs = require("fs");
const path = require("path");

const KEY = /AIza[0-9A-Za-z_-]{35}/g;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error("Usage: node scripts/check-bundle-secrets.js <exported-bundle-dir>");
  process.exit(2);
}

let found = 0;
for (const file of walk(dir)) {
  const hits = fs.readFileSync(file).toString("latin1").match(KEY);
  if (hits) {
    found += hits.length;
    console.log(`KEY FOUND: ${path.relative(dir, file)} (${hits.length} match${hits.length > 1 ? "es" : ""})`);
  }
}
console.log(found ? `\nFAILED: ${found} Google API key(s) in the bundle. Remove EXPO_PUBLIC_GEMINI_API_KEY from .env and EAS environment variables.` : "OK: no Google API key found in the bundle.");
process.exit(found ? 1 : 0);
