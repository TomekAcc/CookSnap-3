import en from "./translations/en";
import es from "./translations/es";
import zh from "./translations/zh";
import ja from "./translations/ja";
import de from "./translations/de";
import ko from "./translations/ko";
import hi from "./translations/hi";
import ar from "./translations/ar";
import pt from "./translations/pt";
import fr from "./translations/fr";
import ru from "./translations/ru";
import it from "./translations/it";
import nl from "./translations/nl";
import id from "./translations/id";
import sv from "./translations/sv";
import tr from "./translations/tr";
import vi from "./translations/vi";
import th from "./translations/th";
import pl from "./translations/pl";
import fi from "./translations/fi";
import uk from "./translations/uk";
import el from "./translations/el";
import da from "./translations/da";
import no from "./translations/no";
import he from "./translations/he";
import cs from "./translations/cs";
import ro from "./translations/ro";
import hu from "./translations/hu";
import sk from "./translations/sk";
import bg from "./translations/bg";
import hr from "./translations/hr";

/** One dictionary per LANGUAGE_OPTIONS id — see src/data/languageOptions.js. */
const TRANSLATIONS = {
  en, es, zh, ja, de, ko, hi, ar, pt, fr, ru, it, nl, id, sv,
  tr, vi, th, pl, fi, uk, el, da, no, he, cs, ro, hu, sk, bg, hr,
};

/**
 * Looks up `key` in the dictionary for `languageId`, falling back to
 * English for a missing language OR a missing key within a language
 * (same graceful-degradation principle used throughout the recipe-
 * language work — never show a raw key or blank text). `vars` fills in
 * "{name}"-style placeholders, e.g. translate("en", "profile.scansUsedUp",
 * { count: 3 }).
 */
export function translate(languageId, key, vars) {
  const dict = TRANSLATIONS[languageId] || TRANSLATIONS.en;
  let str = dict[key] ?? TRANSLATIONS.en[key] ?? key;
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
  const dict = TRANSLATIONS[languageId] || TRANSLATIONS.en;
  const isFew = isSlavicFewCount(languageId, count);
  let key = fallback;
  if (isFew && few && few in dict) key = few;
  if (!isFew && many && many in dict) key = many;
  return translate(languageId, key, { count, ...vars });
}

export { TRANSLATIONS };
