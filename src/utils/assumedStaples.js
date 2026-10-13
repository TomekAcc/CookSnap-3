/**
 * Detects whether a recipe ingredient line is one of the handful of basic
 * staples (salt, pepper, cooking oil) the generator ALWAYS assumes the user
 * has — see BASIC_STAPLES in geminiRecipes.js — rather than something they
 * actually scanned or added to Pantry. Matching happens on the final,
 * already-translated ingredientsList string, so it needs a per-language
 * word list instead of a single English keyword.
 *
 * Deliberately excludes "basic spices" (the 4th assumed category): unlike
 * salt/pepper/oil, the model essentially never writes a line item literally
 * named "spices" — it names the specific spice instead (oregano, cumin...),
 * which usually IS something genuinely scanned, so there's no reliable,
 * low-false-positive way to tag it.
 */

// Spaceless scripts (no word-boundary tokens to split on) — matched by
// plain substring instead of whole-word comparison.
const SPACELESS_LANGS = new Set(["zh", "ja", "th"]);

const STAPLE_WORDS = {
  salt: {
    en: "salt", es: "sal", zh: "盐", ja: "塩", de: "salz", ko: "소금",
    hi: "नमक", ar: "ملح", pt: "sal", fr: "sel", ru: "соль", it: "sale",
    nl: "zout", id: "garam", sv: "salt", tr: "tuz", vi: "muối", th: "เกลือ",
    pl: "sól", fi: "suola", uk: "сіль", el: "αλάτι", da: "salt", no: "salt",
    he: "מלח", cs: "sůl", ro: "sare", hu: "só", sk: "soľ", bg: "сол",
    hr: "sol",
  },
  pepper: {
    en: "pepper", es: "pimienta", zh: "胡椒", ja: "胡椒", de: "pfeffer",
    ko: "후추", hi: "काली मिर्च", ar: "فلفل", pt: "pimenta", fr: "poivre",
    ru: "перец", it: "pepe", nl: "peper", id: "lada", sv: "peppar",
    tr: "karabiber", vi: "tiêu", th: "พริกไทย", pl: "pieprz", fi: "pippuri",
    uk: "перець", el: "πιπέρι", da: "peber", no: "pepper", he: "פלפל",
    cs: "pepř", ro: "piper", hu: "bors", sk: "čierne korenie",
    bg: "черен пипер", hr: "papar",
  },
  oil: {
    en: "oil", es: "aceite", zh: "油", ja: "油", de: "öl", ko: "기름",
    hi: "तेल", ar: "زيت", pt: ["óleo", "azeite"], fr: "huile", ru: "масло",
    it: "olio", nl: "olie", id: "minyak", sv: "olja", tr: "yağ", vi: "dầu",
    th: "น้ำมัน", pl: ["olej", "oliwa"], fi: "öljy", uk: "олія",
    el: "λάδι", da: "olie", no: "olje", he: "שמן", cs: "olej", ro: "ulei",
    hu: "olaj", sk: "olej", bg: "олио", hr: "ulje",
  },
};

function toWordList(entry, languageId) {
  const value = entry[languageId] || entry.en;
  return Array.isArray(value) ? value : [value];
}

/** Checks `line` (already lowercased) for `word` as a standalone token,
 * tolerating multi-word phrases (e.g. Slovak "čierne korenie") via
 * space-padded substring matching instead of regex \b — JS word-boundary
 * regex misclassifies accented first/last characters (ö, ł, ü...) as
 * non-word, which would silently break matching for exactly the languages
 * most likely to need it (Finnish "öljy", German "Öl", Polish "sól"...). */
function hasWord(line, word, spaceless) {
  const w = word.toLowerCase();
  if (spaceless) return line.includes(w);
  const padded = ` ${line.replace(/\s+/g, " ").trim()} `;
  return padded.includes(` ${w} `);
}

export function isAssumedStapleIngredient(ingredientLine, languageId = "en") {
  if (!ingredientLine) return false;
  const line = String(ingredientLine).toLowerCase();
  const spaceless = SPACELESS_LANGS.has(languageId);

  return Object.values(STAPLE_WORDS).some((entry) =>
    toWordList(entry, languageId).some((word) => hasWord(line, word, spaceless))
  );
}
