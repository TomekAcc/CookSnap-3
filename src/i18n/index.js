import en from "./translations/en";

/**
 * One dictionary per LANGUAGE_OPTIONS id — see src/data/languageOptions.js.
 *
 * Only English (the fallback for every missing language or key) is imported
 * eagerly. The other 30 tables are ~1 MB of object literals that used to be
 * evaluated at launch although a user only ever reads one of them; each is now
 * required the first time its language is used, then cached. The `require`
 * calls are static strings, so Metro still bundles every table.
 */
const LOADERS = {
  es: () => require("./translations/es").default,
  zh: () => require("./translations/zh").default,
  ja: () => require("./translations/ja").default,
  de: () => require("./translations/de").default,
  ko: () => require("./translations/ko").default,
  hi: () => require("./translations/hi").default,
  ar: () => require("./translations/ar").default,
  pt: () => require("./translations/pt").default,
  fr: () => require("./translations/fr").default,
  ru: () => require("./translations/ru").default,
  it: () => require("./translations/it").default,
  nl: () => require("./translations/nl").default,
  id: () => require("./translations/id").default,
  sv: () => require("./translations/sv").default,
  tr: () => require("./translations/tr").default,
  vi: () => require("./translations/vi").default,
  th: () => require("./translations/th").default,
  pl: () => require("./translations/pl").default,
  fi: () => require("./translations/fi").default,
  uk: () => require("./translations/uk").default,
  el: () => require("./translations/el").default,
  da: () => require("./translations/da").default,
  no: () => require("./translations/no").default,
  he: () => require("./translations/he").default,
  cs: () => require("./translations/cs").default,
  ro: () => require("./translations/ro").default,
  hu: () => require("./translations/hu").default,
  sk: () => require("./translations/sk").default,
  bg: () => require("./translations/bg").default,
  hr: () => require("./translations/hr").default,
};

const DICTIONARIES = { en };

function dictionaryFor(languageId) {
  const cached = DICTIONARIES[languageId];
  if (cached) return cached;
  const load = LOADERS[languageId];
  if (!load) return en;
  return (DICTIONARIES[languageId] = load());
}

/**
 * Looks up `key` in the dictionary for `languageId`, falling back to
 * English for a missing language OR a missing key within a language
 * (same graceful-degradation principle used throughout the recipe-
 * language work — never show a raw key or blank text). `vars` fills in
 * "{name}"-style placeholders, e.g. translate("en", "profile.scansUsedUp",
 * { count: 3 }).
 */
export function translate(languageId, key, vars) {
  const dict = dictionaryFor(languageId);
  let str = dict[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.split(`{${k}}`).join(String(v));
    }
  }
  return str;
}

// These 6 languages grammatically need a THIRD noun form for counts of
// 2-4 (excluding 12-14) — distinct from both "1" and the form used for
// everywhere else (5+, 0, and 11-14) — that the app's usual one/other
// split can't represent. Confirmed live in Polish: "10 produkty" (using
// the 2-4 form for 10) and "2 OSÓB" (using the 5+ form for 2) were both
// grammatically wrong before this.
const SLAVIC_FEW_LANGS = new Set(["pl", "ru", "uk", "cs", "sk", "hr"]);

/** True when `n` needs that distinct 2-4 noun form in `languageId`. */
export function isSlavicFewCount(languageId, n) {
  if (!SLAVIC_FEW_LANGS.has(languageId)) return false;
  const count = Math.abs(Number(n) || 0);
  const mod10 = count % 10;
  const mod100 = count % 100;
  return mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14);
}

/**
 * Resolves a pluralized key with an optional extra "few" and/or "many"
 * form for the languages in SLAVIC_FEW_LANGS, falling back to `fallback`
 * for both count ranges that don't need the extra form AND any language
 * that hasn't defined it — so adding e.g. `keys.many` for Polish never
 * affects any other language, and `fallback` alone reproduces today's
 * plain one/other behavior everywhere else.
 */
export function translateCount(languageId, count, { few, many, fallback }, vars) {
  const dict = dictionaryFor(languageId);
  const isFew = isSlavicFewCount(languageId, count);
  let key = fallback;
  if (isFew && few && few in dict) key = few;
  if (!isFew && many && many in dict) key = many;
  return translate(languageId, key, { count, ...vars });
}
